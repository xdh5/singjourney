from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from app.main import app
from app.modules.sharing.schemas import ShareCreateRequest


def test_live_health_check() -> None:
    """The liveness endpoint must not depend on the database or object storage."""

    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_version_metadata() -> None:
    """Deployments expose their immutable Server API and contract versions."""

    with TestClient(app) as client:
        response = client.get("/version")

    assert response.status_code == 200
    assert response.json() == {"serverVersion": "0.1.0", "apiMajor": 1}


def test_ready_health_check() -> None:
    """The readiness endpoint must confirm that the migrated database is reachable."""

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_share_rejects_recordings_longer_than_ten_minutes() -> None:
    """Share metadata cannot bypass the client-side recording duration limit."""

    with pytest.raises(ValidationError):
        ShareCreateRequest.model_validate(
            {
                "title": "Too long",
                "duration_seconds": 601,
                "curve": [],
                "audio": {
                    "filename": "recording.webm",
                    "mime_type": "audio/webm",
                    "byte_size": 1,
                },
            }
        )
