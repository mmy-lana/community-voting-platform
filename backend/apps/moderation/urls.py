from django.urls import path

from apps.moderation.views import (
    AuditLogListView,
    ModerationActionView,
    ModerationVoteExportView,
    ModerationVoteListView,
)

urlpatterns = [
    path("moderation/actions/", ModerationActionView.as_view(), name="moderation-actions"),
    path("moderation/audit-log/", AuditLogListView.as_view(), name="moderation-audit-log"),
    path("moderation/votes/", ModerationVoteListView.as_view(), name="moderation-votes"),
    path(
        "moderation/votes/export.csv",
        ModerationVoteExportView.as_view(),
        name="moderation-votes-export",
    ),
]
