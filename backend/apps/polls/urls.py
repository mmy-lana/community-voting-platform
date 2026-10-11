from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.polls.views import PollViewSet
from apps.polls.health_views import health
from apps.results.views import TimeSeriesView

router = DefaultRouter()
router.register("polls", PollViewSet, basename="polls")

urlpatterns = [
    path("health/", health, name="health"),
    path("polls/health/", health, name="polls-health"),
    path("", include(router.urls)),
    # Spec alias: POST /polls/{id}/votes/ (router exposes /polls/{id}/vote/).
    path(
        "polls/<int:pk>/votes/",
        PollViewSet.as_view({"post": "vote"}),
        name="poll-votes",
    ),
    path(
        "polls/<int:pk>/results/timeseries/",
        TimeSeriesView.as_view(),
        name="poll-timeseries",
    ),
]
