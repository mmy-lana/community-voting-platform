from django.db import models


class AuditLog(models.Model):
    actor = models.CharField(max_length=150)
    action = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=50)
    entity_id = models.BigIntegerField()
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_log"
        indexes = [
            models.Index(fields=["entity_type", "entity_id"], name="idx_audit_entity"),
            models.Index(fields=["-created_at"], name="idx_audit_time"),
        ]

    def __str__(self):
        return f"Audit#{self.pk} {self.action} {self.entity_type}:{self.entity_id}"
