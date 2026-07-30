import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.modules.telemetry.rate_limit import accept_telemetry_request
from app.modules.telemetry.schemas import ClientTelemetryBatch, ClientTelemetryResponse

LOGGER = logging.getLogger("singjourney.telemetry")
router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post(
    "/events",
    response_model=ClientTelemetryResponse,
    summary="Ingest a bounded batch of client product and diagnostic events",
    description=(
        "Accepts an allowlisted batch from SingJourney clients and writes structured JSON to the server log for "
        "Grafana Alloy collection. Authentication is intentionally not required so pre-login and pitch-meter events "
        "can be counted. Payload size, fields, event names, duration, and request frequency are bounded to control "
        "abuse and logging cost. Audio, pitch curves, filenames, tokens, OpenIDs, and arbitrary properties are not "
        "accepted. The only side effect is append-only operational logging; no database rows are created."
    ),
    responses={
        200: {"description": "All validated events were accepted for structured logging."},
        422: {"description": "The batch or one of its fields is outside the documented bounds."},
        429: {"description": "This network client exceeded the telemetry ingestion rate limit."},
    },
)
def ingest_client_telemetry(
    payload: ClientTelemetryBatch,
    request: Request,
) -> ClientTelemetryResponse:
    client_key = request.client.host if request.client else "unknown"
    if not accept_telemetry_request(client_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    for event in payload.events:
        LOGGER.info("client_event", extra={"event_data": event.model_dump(mode="json")})
    return ClientTelemetryResponse(accepted=len(payload.events))
