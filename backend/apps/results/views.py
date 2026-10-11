from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.rendering import APIError
from apps.core.permissions import is_staff_request
from apps.polls.models import Poll, Vote
from apps.results.serializers import (
    TimeSeriesResponseSerializer,
    build_result_dto,
)

GRANULARITIES = {"hourly": "hour", "daily": "day"}


class TimeSeriesView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "results"

    def get(self, request, pk=None):
        from django.db.models import Count
        from django.db.models.functions import Trunc
        from datetime import datetime, timedelta, timezone as dt_timezone

        poll = Poll.objects.filter(pk=pk).first()
        if poll is None:
            raise APIError("NOT_FOUND", "Poll not found.", 404)
        # Draft polls are invisible to non-staff, including their time series.
        if poll.status == "draft" and not is_staff_request(request):
            raise APIError("NOT_FOUND", "Poll not found.", 404)

        granularity = request.query_params.get("granularity", "hourly")
        if granularity not in GRANULARITIES:
            raise APIError(
                "VALIDATION_ERROR",
                "granularity must be 'hourly' or 'daily'.",
                400,
            )

        to = request.query_params.get("to")
        from_param = request.query_params.get("from")
        from django.utils import timezone as dj_tz

        now = dj_tz.now()
        try:
            window_to = datetime.fromisoformat(to) if to else now
            window_from = (
                datetime.fromisoformat(from_param)
                if from_param
                else window_to - timedelta(days=7)
            )
        except ValueError:
            raise APIError("VALIDATION_ERROR", "Invalid from/to ISO datetime.", 400)
        if window_from.tzinfo is None:
            window_from = window_from.replace(tzinfo=dt_timezone.utc)
        if window_to.tzinfo is None:
            window_to = window_to.replace(tzinfo=dt_timezone.utc)
        if window_to < window_from:
            raise APIError("VALIDATION_ERROR", "to must be after from.", 400)
        if window_to - window_from > timedelta(days=30):
            raise APIError("VALIDATION_ERROR", "Window capped at 30 days.", 400)

        trunc = Trunc("created_at", GRANULARITIES[granularity], tzinfo=dt_timezone.utc)
        rows = (
            Vote.objects.filter(poll_id=poll.pk, created_at__range=(window_from, window_to))
            .annotate(bucket=trunc)
            .values("bucket")
            .annotate(vote_count=Count("id"))
            .order_by("bucket")
        )
        points = [
            {"bucket_start": row["bucket"], "vote_count": row["vote_count"]}
            for row in rows
        ]
        data = {
            "window_from": window_from,
            "window_to": window_to,
            "points": points,
        }
        serializer = TimeSeriesResponseSerializer(data)
        return Response(serializer.data)


__all__ = ["TimeSeriesView", "build_result_dto", "Poll"]
