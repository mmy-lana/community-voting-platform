"""Envelope renderer, paginator, and exception handler (apps/core)."""
from datetime import datetime, timezone

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

UNIQ_VOTE_CONSTRAINT = "uniq_vote_per_poll_voter"


class APIError(exceptions.APIException):
    """APIException carrying a stable envelope error code."""

    def __init__(self, stable_code, message, status_code=400):
        super().__init__(message)
        self.stable_code = stable_code
        self.status_code = status_code


def _now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class EnvelopeRenderer:
    """
    Renders every response as the unified ApiResponseEnvelope:

        {success, data, error, meta: {requestId, timestamp[, pagination]}}
    """

    media_type = "application/json"
    format = "json"
    charset = "utf-8"
    render_style = "normal"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        from djangorestframework_camel_case.render import CamelCaseJSONRenderer

        context = renderer_context or {}
        response = context.get("response")
        request = context.get("request")

        meta = {
            "requestId": getattr(request, "request_id", "") if request else "",
            "timestamp": _now_iso(),
        }

        if response is not None and getattr(response, "exception", False):
            error = getattr(response, "envelope_error", None) or {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred.",
                "details": None,
            }
            payload = {"success": False, "data": None, "error": error, "meta": meta}
        else:
            if getattr(response, "list_envelope", False):
                meta["pagination"] = getattr(
                    response,
                    "pagination_meta",
                    {"page": 1, "pageSize": 0, "totalItems": 0, "totalPages": 1},
                )
            payload = {"success": True, "data": data, "error": None, "meta": meta}

        return CamelCaseJSONRenderer().render(payload, accepted_media_type, renderer_context)


class EnvelopePagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "pageSize"
    max_page_size = 100

    def get_paginated_response(self, data):
        # This Response is what the view returns, so it IS the outer response.
        response = Response(data)
        response.list_envelope = True
        response.pagination_meta = {
            "page": self.page.number,
            "pageSize": self.page.paginator.per_page,
            "totalItems": self.page.paginator.count,
            "totalPages": self.page.paginator.num_pages,
        }
        return response


def envelope_exception_handler(exc, context):
    """Map DRF/Django exceptions to stable envelope error codes."""
    from rest_framework.views import exception_handler as drf_exception_handler, set_rollback
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    if isinstance(exc, APIError):
        response = Response({}, status=exc.status_code)
        response.envelope_error = {
            "code": exc.stable_code,
            "message": str(exc.detail),
            "details": None,
        }
        response.exception = True
        return response

    response = drf_exception_handler(exc, context)

    if response is None and isinstance(exc, IntegrityError):
        text = str(exc)
        if UNIQ_VOTE_CONSTRAINT in text:
            code, message = "VOTE_DUPLICATE", "Vote already recorded for this poll."
        else:
            code, message = "INTERNAL_ERROR", "Database integrity error."
        set_rollback()
        response = Response({}, status=status.HTTP_409_CONFLICT if code == "VOTE_DUPLICATE" else 500)
        response.envelope_error = {"code": code, "message": message, "details": None}

    if response is None:
        response = Response({}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        response.envelope_error = {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred.",
            "details": None,
        }

    response.exception = True
    if getattr(response, "envelope_error", None) is not None:
        return response

    detail = response.data
    status_code = response.status_code

    code_map = {
        400: "VALIDATION_ERROR",
        401: "AUTH_REQUIRED",
        403: "PERMISSION_DENIED",
        404: "NOT_FOUND",
        405: "VALIDATION_ERROR",
        409: "CONFLICT",
        429: "RATE_LIMITED",
    }
    code = code_map.get(status_code, "INTERNAL_ERROR")
    if status_code == 429:
        # Throttled requests carry a wait_in seconds hint.
        if isinstance(detail, dict) and "wait" in detail:
            response["Retry-After"] = str(detail["wait"])

    message = "Request failed."
    details = None
    if isinstance(detail, dict):
        if detail.get("detail") is not None and len(detail) == 1:
            message = str(detail["detail"])
        else:
            message = "Validation failed." if status_code == 400 else message
            details = {
                key: value if isinstance(value, list) else [str(value)]
                for key, value in detail.items()
            }
    elif isinstance(detail, list):
        message = str(detail[0]) if detail else message
        details = {"nonFieldErrors": [str(item) for item in detail]}
    else:
        message = str(detail)

    response.envelope_error = {"code": code, "message": message, "details": details}
    response.data = {}
    return response
