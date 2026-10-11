from rest_framework import serializers

from apps.core.rendering import APIError
from apps.core.utils import hash_voter_ip
from apps.polls.models import Poll, PollOption, Vote


class OptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PollOption
        fields = ["id", "label", "position", "vote_count"]
        read_only_fields = ["id", "vote_count"]


class PollListSerializer(serializers.ModelSerializer):
    total_votes = serializers.IntegerField(read_only=True)
    lead_option_label = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = Poll
        fields = [
            "id", "title", "status", "opens_at", "closes_at",
            "total_votes", "lead_option_label",
        ]


class PollDetailSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)
    total_votes = serializers.IntegerField(read_only=True, default=0)
    lead_option_label = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = Poll
        fields = [
            "id", "title", "description", "status", "is_anonymous", "allow_revote",
            "opens_at", "closes_at", "total_votes", "lead_option_label",
            "options", "created_by", "created_at",
        ]


class PollOptionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollOption
        fields = ["label", "position"]


class PollWriteSerializer(serializers.ModelSerializer):
    options = PollOptionWriteSerializer(many=True, required=False)

    class Meta:
        model = Poll
        fields = [
            "title", "description", "status", "is_anonymous", "allow_revote",
            "opens_at", "closes_at", "options",
        ]

    def validate(self, attrs):
        opens_at = attrs.get("opens_at", getattr(self.instance, "opens_at", None))
        closes_at = attrs.get("closes_at", getattr(self.instance, "closes_at", None))
        if opens_at and closes_at and closes_at <= opens_at:
            raise serializers.ValidationError(
                {"closes_at": "closes_at must be after opens_at."}
            )

        status_value = attrs.get("status", getattr(self.instance, "status", None))
        options = attrs.get("options")
        if status_value and status_value != "draft":
            count = len(options) if options is not None else (
                self.instance.options.count() if self.instance else 0
            )
            if count < 2:
                raise serializers.ValidationError(
                    {"options": "A poll needs at least 2 options before opening."}
                )
        return attrs

    def _sync_options(self, poll, options_data):
        if options_data is None:
            return
        poll.options.all().delete()
        PollOption.objects.bulk_create(
            [
                PollOption(poll=poll, label=item["label"], position=item.get("position", 0))
                for item in options_data
            ]
        )

    def create(self, validated_data):
        options_data = validated_data.pop("options", None)
        validated_data.setdefault("created_by", "system")
        poll = super().create(validated_data)
        self._sync_options(poll, options_data)
        return poll

    def update(self, instance, validated_data):
        options_data = validated_data.pop("options", None)
        poll = super().update(instance, validated_data)
        self._sync_options(poll, options_data)
        return poll


class VoteCreateSerializer(serializers.Serializer):
    """Body contains only optionId; poll_id injected via context."""

    option_id = serializers.IntegerField(source="optionId")

    def validate_option_id(self, value):
        poll = self.context["poll"]
        if not poll.options.filter(pk=value).exists():
            raise serializers.ValidationError(
                "Option does not belong to this poll.", code="OPTION_MISMATCH"
            )
        return value

    def cast_vote(self, poll, voter_ip_hash, idempotency_key):
        """Guarded insert with SELECT FOR UPDATE on the poll row."""
        from django.db import IntegrityError, transaction

        option_id = self.validated_data["optionId"]
        with transaction.atomic():
            poll = type(poll).objects.select_for_update().get(pk=poll.pk)
            from django.utils import timezone

            now = timezone.now()
            if poll.status != "open":
                raise APIError("POLL_NOT_OPEN", "Poll is not open for voting.", 409)
            if poll.closes_at is not None and now >= poll.closes_at:
                raise APIError("POLL_EXPIRED", "Poll voting window has expired.", 409)
            if poll.opens_at is not None and now < poll.opens_at:
                raise APIError("POLL_NOT_OPEN", "Poll is not open yet.", 409)

            existing = Vote.objects.filter(poll_id=poll.pk, voter_ip=voter_ip_hash).first()
            if existing is not None:
                if poll.allow_revote:
                    existing.option_id = option_id
                    existing.save(update_fields=["option_id"])
                    return existing, False
                raise APIError("VOTE_DUPLICATE", "Vote already recorded for this poll.", 409)

            try:
                return (
                    Vote.objects.create(
                        poll_id=poll.pk,
                        option_id=option_id,
                        voter_ip=voter_ip_hash,
                        idempotency_key=idempotency_key,
                    ),
                    True,
                )
            except IntegrityError as exc:
                if "uniq_vote_per_poll_voter" in str(exc):
                    raise APIError(
                        "VOTE_DUPLICATE", "Vote already recorded for this poll.", 409
                    ) from exc
                if "uniq_vote_idempotency" in str(exc):
                    raise APIError(
                        "IDEMPOTENCY_REPLAY",
                        "This idempotency key was already used for the poll.",
                        409,
                    ) from exc
                raise


