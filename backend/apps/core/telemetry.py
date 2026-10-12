"""Client telemetry ingestion (specs/03-polls-and-voting.md 3.7)."""
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


class ClientErrorSerializer(serializers.Serializer):
    """Wire keys are camelCase (route, errorName, requestId); the camel-case
    parser delivers them as snake_case (error_name, request_id)."""

    route = serializers.CharField(max_length=500)
    error_name = serializers.CharField(max_length=200)
    request_id = serializers.CharField(max_length=100, required=False, allow_blank=True)


class ClientErrorView(APIView):
    """POST /telemetry/client-error/ — public, 202, throttled 5/min/IP."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "telemetry"

    def post(self, request):
        serializer = ClientErrorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        import logging

        payload = serializer.validated_data

        def _strip_crlf(value):
            # Log injection mitigation: CR/LF would let an attacker forge
            # additional structured-log entries via a crafted payload.
            if isinstance(value, str):
                return value.replace("\r", "").replace("\n", "")
            return value

        logging.getLogger("telemetry").warning(
            "client-error",
            extra={
                "route": _strip_crlf(payload["route"]),
                "errorName": _strip_crlf(payload["error_name"]),
                "requestId": _strip_crlf(payload.get("request_id", "")),
                "clientRequestId": getattr(request, "request_id", ""),
            },
        )
        return Response(data=None, status=status.HTTP_202_ACCEPTED)
