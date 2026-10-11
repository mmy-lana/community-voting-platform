from rest_framework import serializers

from apps.moderation.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ["id", "actor", "action", "entity_type", "entity_id", "reason", "created_at"]
        read_only_fields = fields


ALLOWED_ACTIONS = {
    "poll.close": ("poll", "closed"),
    "poll.reopen": ("poll", "open"),
    "vote.delete": ("vote", None),
}


class ModerationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=sorted(ALLOWED_ACTIONS.keys()))
    entity_id = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        if attrs["action"] == "vote.delete" and not (attrs.get("reason") or "").strip():
            raise serializers.ValidationError(
                {"reason": "A reason is required for destructive actions."}
            )
        return attrs
