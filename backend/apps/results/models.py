from django.db import models


class TallySnapshot(models.Model):
    poll = models.ForeignKey(
        "apps_polls.Poll", on_delete=models.CASCADE, related_name="tally_snapshots",
        db_column="poll_id",
    )
    option = models.ForeignKey(
        "apps_polls.PollOption", on_delete=models.CASCADE,
        related_name="tally_snapshots", db_column="option_id",
    )
    vote_count = models.IntegerField()
    captured_at = models.DateTimeField()

    class Meta:
        db_table = "tally_snapshots"
        constraints = [
            models.UniqueConstraint(
                fields=["poll", "option", "captured_at"], name="uniq_snapshot"
            ),
        ]
        indexes = [
            models.Index(
                fields=["poll", "-captured_at"], name="idx_tally_poll_time"
            ),
        ]

    def __str__(self):
        return f"Snapshot poll={self.poll_id} option={self.option_id} n={self.vote_count}"
