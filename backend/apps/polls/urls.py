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
    path(
        "polls/<int:pk>/results/timeseries/",
        TimeSeriesView.as_view(),
        name="poll-timeseries",
    ),
]
