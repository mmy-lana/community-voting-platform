from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.core.telemetry import ClientErrorView

router = DefaultRouter()

urlpatterns = [
    path("", include("apps.polls.urls")),
    path("", include("apps.moderation.urls")),
    path("telemetry/client-error/", ClientErrorView.as_view(), name="telemetry-client-error"),
    path("", include(router.urls)),
]
