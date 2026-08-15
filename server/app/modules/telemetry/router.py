import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.modules.telemetry.rate_limit import accept_telemetry_request
from app.modules.telemetry.schemas import ClientTelemetryBatch, ClientTelemetryResponse

LOGGER = logging.getLogger("singjourney.telemetry")
router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post("/events", response_model=ClientTelemetryResponse)
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
