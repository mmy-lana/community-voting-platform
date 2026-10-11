"""X-Request-Id middleware: propagate or generate a request id per request."""
import logging
import uuid


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.request_id = request_id
        response = self.get_response(request)
        response["X-Request-Id"] = request_id
        return response


class RequestTimingMiddleware:
    """Structured-JSON request timing log with X-Request-Id correlation
    (specs/04 §4). Emits one JSON line per request: requestId, path, method,
    status, duration_ms, db queries count."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = logging.getLogger("request.timing")

    def __call__(self, request):
        import json
        import time

        started = time.monotonic()
        response = self.get_response(request)
        duration_ms = round((time.monotonic() - started) * 1000, 2)

        from django.db import connection
        try:
            db_queries = len(connection.queries)
        except Exception:
            db_queries = -1

        record = {
            "level": "info",
            "logger": "request.timing",
            "message": "request",
            "requestId": getattr(request, "request_id", ""),
            "path": request.path,
            "method": request.method,
            "status": getattr(response, "status_code", None),
            "duration_ms": duration_ms,
            "db_queries": db_queries,
        }
        self.logger.info(json.dumps(record, ensure_ascii=False))
        return response
