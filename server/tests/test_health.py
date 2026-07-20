from fastapi.testclient import TestClient

from app.main import app


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


def test_client_config_contains_only_public_runtime_values() -> None:
    """Released clients receive endpoints and cache policy without storage credentials."""

    with TestClient(app) as client:
        response = client.get("/api/v1/client-config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["api_base_url"] == "https://example.test/api/v1"
    assert payload["share_base_url"] == "https://example.test/"
    assert payload["media_base_url"] == "https://example.test/api/v1"
    assert payload["server_version"] == "0.1.0"
    assert payload["api_major"] == 1
    assert payload["minimum_client_versions"]["android"] == "0.1.0"
    assert "r2_secret_access_key" not in payload
