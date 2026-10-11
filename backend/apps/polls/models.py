from django.db import models
from django.db.models import F, Value
from django.db.models.functions import Length, Trim
from django.db.models.lookups import GreaterThan


class PollStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"


class Poll(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=PollStatus.choices,
        default=PollStatus.DRAFT,
        db_index=True,
    )
    is_anonymous = models.BooleanField(default=True)
    allow_revote = models.BooleanField(default=False)
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    created_by = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "polls"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(closes_at__isnull=True)
                    | models.Q(opens_at__isnull=True)
                    | models.Q(closes_at__gt=F("opens_at"))
                ),
                name="chk_poll_window",
            ),
            models.CheckConstraint(
                condition=GreaterThan(Length(Trim("title")), Value(3)),
                name="chk_poll_title_len",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "opens_at"], name="idx_polls_status_opens"),
            models.Index(fields=["-created_at"], name="idx_polls_created_at"),
        ]

    def __str__(self):
        return f"Poll#{self.pk} {self.title}"


class PollOption(models.Model):
    poll = models.ForeignKey(
        Poll, on_delete=models.CASCADE, related_name="options", db_column="poll_id"
    )
    label = models.CharField(max_length=150)
    position = models.SmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "options"
        constraints = [
            models.UniqueConstraint(
                fields=["poll", "label"], name="uniq_option_per_poll"
            ),
            models.CheckConstraint(
                condition=GreaterThan(Length(Trim("label")), Value(0)),
                name="chk_option_label",
            ),
        ]
        indexes = [
            models.Index(fields=["poll", "position"], name="idx_options_poll"),
        ]

    def __str__(self):
        return f"Option#{self.pk} {self.label}"


class Vote(models.Model):
    poll = models.ForeignKey(
        Poll, on_delete=models.CASCADE, related_name="votes", db_column="poll_id"
    )
    option = models.ForeignKey(
        PollOption, on_delete=models.CASCADE, related_name="votes", db_column="option_id"
    )
    voter_ip = models.CharField(max_length=64)
    idempotency_key = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "votes"
        constraints = [
            models.UniqueConstraint(
                fields=["poll", "voter_ip"], name="uniq_vote_per_poll_voter"
            ),
        ]
        indexes = [
            models.Index(fields=["poll", "option"], name="idx_votes_poll_option"),
            models.Index(fields=["-created_at"], name="idx_votes_created_at"),
            models.Index(fields=["poll", "-created_at"], name="idx_votes_poll_created"),
            models.Index(fields=["voter_ip"], name="idx_votes_voter_ip"),
            models.Index(fields=["voter_ip", "poll"], name="idx_votes_ip_poll"),
        ]

    def __str__(self):
        return f"Vote#{self.pk} poll={self.poll_id} option={self.option_id}"
