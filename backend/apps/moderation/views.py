import csv

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffOrBearerToken
from apps.core.rendering import APIError, EnvelopePagination
from apps.moderation.models import AuditLog
from apps.moderation.serializers import (
    ALLOWED_ACTIONS,
    AuditLogSerializer,
    ModerationActionSerializer,
)
from apps.polls.models import Poll, Vote


class AuditLogPagination(EnvelopePagination):
    page_size = 20
    page_size_query_param = "pageSize"
    max_page_size = 50


def _actor_name(request):
    user = request.user
    if user and user.is_authenticated and user.is_staff:
        return user.username
    return "api-token"


def parse_iso(value):
    from datetime import datetime, timezone as dt_timezone

    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt_timezone.utc)
    return parsed


class ModerationActionView(APIView):
    """POST /moderation/actions/ — poll.close, poll.reopen, vote.delete."""

    permission_classes = [IsStaffOrBearerToken]

    def post(self, request):
        serializer = ModerationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        entity_id = serializer.validated_data["entity_id"]
        reason = serializer.validated_data.get("reason") or None
        entity_type, new_status = ALLOWED_ACTIONS[action]

        with transaction.atomic():
            if action in ("poll.close", "poll.reopen"):
                poll = Poll.objects.filter(pk=entity_id).first()
                if poll is None:
                    raise APIError("NOT_FOUND", f"Poll {entity_id} not found.", 404)
                poll.status = new_status
                poll.save(update_fields=["status", "updated_at"])
            elif action == "vote.delete":
                vote = Vote.objects.filter(pk=entity_id).first()
                if vote is None:
                    raise APIError("NOT_FOUND", f"Vote {entity_id} not found.", 404)
                entity_id = vote.id
                vote.delete()

            log = AuditLog.objects.create(
                actor=_actor_name(request),
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                reason=reason,
            )
        data = AuditLogSerializer(log).data
        # camelCase wire format handled by renderer; keys are snake in source.
        return Response(
            {
                "id": data["id"],
                "actor": data["actor"],
                "action": data["action"],
                "entityType": data["entity_type"],
                "entityId": data["entity_id"],
                "reason": data["reason"],
                "createdAt": data["created_at"],
            }
        )


class AuditLogListView(generics.ListAPIView):
    """GET /moderation/audit-log/ — paginated, filterable audit trail."""

    serializer_class = AuditLogSerializer
    permission_classes = [IsStaffOrBearerToken]
    pagination_class = AuditLogPagination

    def get_queryset(self):
        qs = AuditLog.objects.all().order_by("-created_at")
        params = self.request.query_params
        for field in ("entity_type", "action"):
            value = params.get(field)
            if value:
                qs = qs.filter(**{field: value})
        entity_id = params.get("entity_id")
        if entity_id:
            try:
                qs = qs.filter(entity_id=int(entity_id))
            except ValueError:
                raise APIError("VALIDATION_ERROR", "entity_id must be an integer.", 400)
        return qs


class ModerationVotePagination(AuditLogPagination):
    pass


class ModerationVoteListView(generics.ListAPIView):
    """GET /moderation/votes/ — filter by poll, voter_ip hash, date range."""

    permission_classes = [IsStaffOrBearerToken]
    pagination_class = ModerationVotePagination

    def list(self, request, *args, **kwargs):
        qs = Vote.objects.all().order_by("-created_at")
        params = request.query_params
        poll_id = params.get("poll")
        if poll_id:
            try:
                qs = qs.filter(poll_id=int(poll_id))
            except ValueError:
                raise APIError("VALIDATION_ERROR", "poll must be an integer.", 400)
        voter_ip = params.get("voter_ip")
        if voter_ip:
            qs = qs.filter(voter_ip=voter_ip)
        date_from = params.get("from")
        date_to = params.get("to")
        try:
            if date_from:
                qs = qs.filter(created_at__gte=parse_iso(date_from))
            if date_to:
                qs = qs.filter(created_at__lte=parse_iso(date_to))
        except ValueError:
            raise APIError("VALIDATION_ERROR", "Invalid from/to ISO datetime.", 400)

        page = self.paginate_queryset(qs)
        results = [
            {
                "id": v.id,
                "pollId": v.poll_id,
                "optionId": v.option_id,
                "voterIp": v.voter_ip,
                "idempotencyKey": v.idempotency_key,
                "createdAt": v.created_at,
            }
            for v in page
        ]
        return self.get_paginated_response(results)


class ModerationVoteExportView(APIView):
    """GET /moderation/votes/export.csv — CSV export (hard cap 100k rows)."""

    permission_classes = [IsStaffOrBearerToken]

    def get(self, request):
        qs = Vote.objects.all().order_by("created_at")
        poll_id = request.query_params.get("poll")
        if poll_id:
            try:
                qs = qs.filter(poll_id=int(poll_id))
            except ValueError:
                raise APIError("VALIDATION_ERROR", "poll must be an integer.", 400)
        if qs.count() > 100_000:
            raise APIError("VALIDATION_ERROR", "Export too large (cap 100k rows).", 400)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="votes.csv"'
        writer = csv.writer(response)
        writer.writerow(["id", "poll_id", "option_id", "voter_ip", "idempotency_key", "created_at"])
        for vote in qs.iterator():
            writer.writerow(
                [
                    vote.id,
                    vote.poll_id,
                    vote.option_id,
                    vote.voter_ip,
                    vote.idempotency_key or "",
                    vote.created_at.isoformat(),
                ]
            )
        return response
