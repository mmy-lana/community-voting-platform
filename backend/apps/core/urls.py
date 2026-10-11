from django.urls import include, path
from rest_framework.routers import DefaultRouter

router = DefaultRouter()

urlpatterns = [
    path("", include("apps.polls.urls")),
    path("", include("apps.moderation.urls")),
    path("", include(router.urls)),
]
