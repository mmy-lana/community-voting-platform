"""Aggregation service + serializers for results/analytics."""
from rest_framework import serializers

from apps.results.models import TallySnapshot


class ResultBucketSerializer(serializers.Serializer):
    option_id = serializers.IntegerField()
    label = serializers.CharField()
    vote_count = serializers.IntegerField()
    percentage = serializers.FloatField()


class ResultSerializer(serializers.Serializer):
    poll_id = serializers.IntegerField()
    status = serializers.CharField()
    total_votes = serializers.IntegerField()
    results = ResultBucketSerializer(many=True)
    winner = serializers.DictField(allow_null=True, required=False)


class TimeSeriesPointSerializer(serializers.Serializer):
    bucket_start = serializers.DateTimeField()
    vote_count = serializers.IntegerField()


class TimeSeriesResponseSerializer(serializers.Serializer):
    window_from = serializers.DateTimeField()
    window_to = serializers.DateTimeField()
    points = TimeSeriesPointSerializer(many=True)


def build_result_dto(poll):
    """Relational GROUP BY aggregation -> ResultDTO dict."""
    from django.db.models import Count
    from django.db.models.functions import Coalesce

    options = list(
        poll.options
        .annotate(vote_count=Coalesce(Count("votes"), 0))
        .order_by("position", "id")
    )
    total = sum(o.vote_count for o in options)
    buckets = []
    for option in options:
        pct = round((option.vote_count / total) * 100, 1) if total else 0.0
        buckets.append(
            {
                "option_id": option.id,
                "label": option.label,
                "vote_count": option.vote_count,
                "percentage": pct,
            }
        )
    winner = None
    if total:
        top = max(options, key=lambda o: o.vote_count)
        leaders = [o for o in options if o.vote_count == top.vote_count]
        if len(leaders) == 1:
            winner = {"optionId": top.id, "label": top.label}
    return {
        "poll_id": poll.id,
        "status": poll.status,
        "total_votes": total,
        "results": buckets,
        "winner": winner,
    }


__all__ = [
    "ResultSerializer",
    "TimeSeriesPointSerializer",
    "TimeSeriesResponseSerializer",
    "build_result_dto",
    "TallySnapshot",
]
