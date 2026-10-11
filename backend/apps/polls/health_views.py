from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def health(request):
    """Health endpoint (unthrottled). Provisions the csrftoken cookie for SPA session flows."""
    from django.db import connection

    db_status = "up"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        db_status = "down"
    return Response({"status": "ok", "service": "polls", "db": db_status})
