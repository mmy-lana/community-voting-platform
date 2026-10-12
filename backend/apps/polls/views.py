from django.db.models import Count, OuterRef, Subquery
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.permissions import IsStaffOrBearerToken, is_staff_request
from apps.core.rendering import APIError
from apps.core.utils import client_ip, hash_voter_ip
from apps.polls.models import Poll, PollOption, Vote
from apps.polls.serializers import (
    PollDetailSerializer,
    PollListSerializer,
    PollWriteSerializer,
    VoteCreateSerializer,
)
from apps.results.serializers import build_result_dto


def _annotated_queryset():
    lead = (
        PollOption.objects.filter(poll=OuterRef("pk"))
        .annotate(vote_count=Count("votes"))
        .order_by("-vote_count", "position")
        .values("label")[:1]
    )
    return (
        Poll.objects.annotate(
            total_votes=Count("votes", distinct=False),
            lead_option_label=Subquery(lead),
        )
        .select_related()
        .prefetch_related("options")
    )


class PollViewSet(viewsets.ModelViewSet):
    serializer_class = PollDetailSerializer
    permission_classes = [AllowAny]

    def get_throttles(self):
        if self.action in ("results", "live_results", "timeseries"):
            self.throttle_scope = "results"
        elif self.action == "vote":
            self.throttle_scope = "vote"
        else:
            self.throttle_scope = None
        if self.throttle_scope:
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = _annotated_queryset()
        is_staff = is_staff_request(self.request)
        requested_status = self.request.query_params.get("status")
        if requested_status:
            # Drafts are never public; open/closed listings are readable
            # anonymously (frontend status filter tabs rely on this).
            if not is_staff and requested_status not in ("open", "closed"):
                raise APIError("PERMISSION_DENIED", "Draft polls are not public.", 403)
            qs = qs.filter(status=requested_status)
        elif not is_staff:
            qs = qs.exclude(status="draft")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(title__icontains=search)
        ordering = self.request.query_params.get("ordering")
        if ordering:
            fields = []
            for raw in ordering.split(","):
                field = raw.strip().lstrip("-")
                if field in ("created_at", "total_votes", "title"):
                    fields.append("-" + field if raw.startswith("-") else field)
            if fields:
                qs = qs.order_by(*fields)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PollWriteSerializer
        if self.action == "list":
            return PollListSerializer
        return PollDetailSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsStaffOrBearerToken()]
        return super().get_permissions()

    def retrieve(self, request, *args, **kwargs):
        try:
            poll = self.get_object()
        except (Poll.DoesNotExist, ValueError):
            raise APIError("NOT_FOUND", "Poll not found.", 404)
        serializer = self.get_serializer(poll)
        return Response(serializer.data)

    def _detail_response(self, poll, status_code):
        """Re-serialize a written poll as PollDetailDTO with annotations."""
        from rest_framework import status as http_status

        poll = _annotated_queryset().get(pk=poll.pk)
        data = PollDetailSerializer(poll, context={"request": self.request}).data
        return Response(data, status=status_code if status_code else http_status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = PollWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        poll = serializer.create(serializer.validated_data)
        return self._detail_response(poll, 201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        poll = self.get_object()
        serializer = PollWriteSerializer(poll, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        poll = serializer.save()
        return self._detail_response(poll, 200)

    def perform_create(self, serializer):
        user = self.request.user
        created_by = (
            user.username if user and user.is_authenticated and user.is_staff else "system"
        )
        serializer.save(created_by=created_by)

    @action(detail=True, methods=["post"], url_path="vote")
    def vote(self, request, pk=None):
        from django.core.cache import cache

        poll = Poll.objects.filter(pk=pk).first()
        if poll is None:
            raise APIError("NOT_FOUND", "Poll not found.", 404)

        serializer = VoteCreateSerializer(
            data=request.data, context={"poll": poll, "request": request}
        )
        serializer.is_valid(raise_exception=True)

        idempotency_key = request.headers.get("Idempotency-Key")
        cache_key = f"idempotency:{poll.pk}:{idempotency_key}" if idempotency_key else None
        prior_cache_key = None
        if idempotency_key:
            cached_payload = cache.get(cache_key)
            if cached_payload is not None:
                return Response(
                    cached_payload,
                    status=status.HTTP_201_CREATED,
                    headers={"Idempotency-Replayed": "true"},
                )
            existing = Vote.objects.filter(
                poll_id=poll.pk, idempotency_key=idempotency_key
            ).first()
            if existing is not None:
                # Cache TTL expired but the vote row exists: reconstruct the
                # original VoteDTO and replay it — never a false 409.
                replay_payload = {
                    "id": existing.id,
                    "pollId": existing.poll_id,
                    "optionId": existing.option_id,
                    "createdAt": existing.created_at.isoformat(),
                }
                cache.set(cache_key, replay_payload, timeout=600)
                return Response(
                    replay_payload,
                    status=status.HTTP_201_CREATED,
                    headers={"Idempotency-Replayed": "true"},
                )
            # allow_revote revisions: remember the vote's previous key so its
            # stale cache entry can be invalidated after the update.
            prior_vote = Vote.objects.filter(
                poll_id=poll.pk, voter_ip=hash_voter_ip(client_ip(request))
            ).first()
            if prior_vote is not None and prior_vote.idempotency_key:
                prior_cache_key = f"idempotency:{poll.pk}:{prior_vote.idempotency_key}"
            vote, _ = serializer.cast_vote(
                poll, hash_voter_ip(client_ip(request)), idempotency_key
            )
        else:
            vote, _ = serializer.cast_vote(poll, hash_voter_ip(client_ip(request)), None)

        data = {
            "id": vote.id,
            "pollId": vote.poll_id,
            "optionId": vote.option_id,
            # ISO string up front so the cached payload serializes identically
            # to the fresh-response path (no datetime drift on replay).
            "createdAt": vote.created_at.isoformat(),
        }
        # A revote changed the stored vote: evict the previous key's cache entry
        # so replays of the old key can never serve a stale option reference.
        if prior_cache_key is not None and prior_cache_key != cache_key:
            cache.delete(prior_cache_key)
        if cache_key is not None:
            cache.set(cache_key, data, timeout=600)
        response = Response(data, status=status.HTTP_201_CREATED)
        response["Idempotency-Replayed"] = "false"
        return response

    @action(detail=True, methods=["get"], url_path="results")
    def results(self, request, pk=None):
        from apps.results.serializers import ResultSerializer

        poll = Poll.objects.filter(pk=pk).first()
        if poll is None:
            raise APIError("NOT_FOUND", "Poll not found.", 404)
        # Draft polls are invisible to non-staff, including their tallies.
        if poll.status == "draft" and not is_staff_request(request):
            raise APIError("NOT_FOUND", "Poll not found.", 404)
        return Response(build_result_dto(poll))

    @action(detail=True, methods=["get"], url_path="results/live")
    def live_results(self, request, pk=None):
        return self.results(request, pk)

