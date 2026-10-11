from django.contrib import admin

from apps.moderation.models import AuditLog
from apps.polls.models import Poll, PollOption, Vote
from apps.results.models import TallySnapshot


@admin.register(Poll)
class PollAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "created_by", "created_at", "opens_at", "closes_at")
    list_filter = ("status", "is_anonymous", "allow_revote")
    search_fields = ("title", "description")


@admin.register(PollOption)
class PollOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "poll", "label", "position", "created_at")
    list_filter = ("poll",)


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ("id", "poll", "option", "voter_ip", "idempotency_key", "created_at")
    list_filter = ("poll",)
    search_fields = ("voter_ip", "idempotency_key")


@admin.register(TallySnapshot)
class TallySnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "poll", "option", "vote_count", "captured_at")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "actor", "action", "entity_type", "entity_id", "created_at")
    list_filter = ("action", "entity_type")
    search_fields = ("actor", "reason")
