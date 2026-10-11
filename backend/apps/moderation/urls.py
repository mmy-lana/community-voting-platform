from django.urls import path

from apps.moderation.views import (
    AuditLogListView,
    ModerationActionView,
    ModerationBulkStatusView,
    ModerationStatusView,
    ModerationStatsView,
    ModerationVoteDeleteView,
    ModerationVoteExportView,
    ModerationVoteListView,
)

urlpatterns = [
    # Legacy action route (kept as alias).
    path("moderation/actions/", ModerationActionView.as_view(), name="moderation-actions"),
    # Spec 04 routes.
    path(
        "moderation/polls/<int:pk>/status/",
        ModerationStatusView.as_view(),
        name="moderation-poll-status",
    ),
    path(
        "moderation/polls/bulk-status/",
        ModerationBulkStatusView.as_view(),
        name="moderation-polls-bulk-status",
    ),
    path(
        "moderation/votes/<int:pk>/",
        ModerationVoteDeleteView.as_view(),
        name="moderation-vote-delete",
    ),
    path("moderation/votes/", ModerationVoteListView.as_view(), name="moderation-votes"),
    path(
        "moderation/votes/export/",
        ModerationVoteExportView.as_view(),
        name="moderation-votes-export",
    ),
    path(
        "moderation/votes/export.csv",
        ModerationVoteExportView.as_view(),
        name="moderation-votes-export-csv",
    ),
    path("moderation/audit/", AuditLogListView.as_view(), name="moderation-audit"),
    path(
        "moderation/audit-log/",
        AuditLogListView.as_view(),
        name="moderation-audit-log",
    ),
    path("moderation/stats/", ModerationStatsView.as_view(), name="moderation-stats"),
]
