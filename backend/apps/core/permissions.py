"""Staff permission: Django staff OR Bearer token matching STAFF_API_TOKEN."""
from django.conf import settings
from rest_framework.permissions import BasePermission


class IsStaffOrBearerToken(BasePermission):
    message = "Staff authentication or a valid Bearer token is required."

    def has_permission(self, request, view):
        return is_staff_request(request)


def is_staff_request(request) -> bool:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[len("Bearer "):].strip()
        return bool(token) and token == settings.STAFF_API_TOKEN
    user = request.user
    return bool(user and user.is_authenticated and user.is_staff)
