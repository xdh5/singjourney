from fastapi.testclient import TestClient

from app.main import app
from app.modules.telemetry.constants import MAXIMUM_BATCH_EVENTS


def telemetry_event(sequence: int) -> dict[str, object]:
    return {
        "event_id": f"event-{sequence:03d}",
        "event_name": "app_opened",
        "occurred_at": "2026-07-30T23:45:00+08:00",
        "platform": "pitch_meter_mini",
        "app_version": "0.1.0",
        "anonymous_id": "anonymous-test",
        "session_id": "session-test",
        "locale": "zh-Hans",
        "source_page": "app",
    }


def test_telemetry_accepts_a_bounded_client_batch() -> None:
    """Pre-login mini-program events can be ingested without user identifiers."""

    with TestClient(app) as client:
        response = client.post("/api/v1/telemetry/events", json={"events": [telemetry_event(1)]})

    assert response.status_code == 200
    assert response.json() == {"accepted": 1}


def test_telemetry_rejects_batches_above_the_cost_limit() -> None:
    """Public ingestion cannot exceed the server's per-request event bound."""

    events = [telemetry_event(sequence) for sequence in range(MAXIMUM_BATCH_EVENTS + 1)]
    with TestClient(app) as client:
        response = client.post("/api/v1/telemetry/events", json={"events": events})

    assert response.status_code == 422
