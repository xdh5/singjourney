from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.modules.sharing.router import require_object_storage
from app.storage.base import ObjectMetadata


class FakeDirectObjectStorage:
    """Provide deterministic signed URLs without contacting R2 during API tests."""

    provider = "cloudflare_r2"

    def create_key(self, filename: str | None, content_type: str) -> str:
        return f"shares/tests/{uuid4()}.wav"

    def create_upload_url(self, storage_key: str, content_type: str) -> str:
        return f"https://uploads.example.test/{storage_key}"

    def create_download_url(self, storage_key: str) -> str:
        return f"https://downloads.example.test/{storage_key}"

    def stat(self, storage_key: str) -> ObjectMetadata | None:
        return None

    def delete(self, storage_key: str) -> None:
        return None


def test_share_reserves_client_generated_public_id_while_upload_is_pending() -> None:
    """A mini-program share card must resolve to the exact ID reserved by its background upload."""

    public_id = str(uuid4())
    storage = FakeDirectObjectStorage()
    app.dependency_overrides[require_object_storage] = lambda: storage

    try:
        with TestClient(app) as client:
            created = client.post(
                "/api/v1/shares",
                json={
                    "public_id": public_id,
                    "title": "Pitch Meter 2026-07-28 18:00",
                    "duration_seconds": 1,
                    "curve": [],
                    "audio": {
                        "filename": "share-preview.wav",
                        "mime_type": "audio/wav",
                        "byte_size": 44,
                    },
                },
            )

            assert created.status_code == 201
            payload = created.json()
            assert payload["id"] == public_id
            assert payload["complete_url"].endswith(f"/shares/{public_id}/complete")

            pending = client.get(f"/api/v1/shares/{public_id}")
            assert pending.status_code == 425

            removed = client.delete(
                f"/api/v1/shares/{public_id}",
                headers={"X-Share-Delete-Token": payload["delete_token"]},
            )
            assert removed.status_code == 204
    finally:
        app.dependency_overrides.pop(require_object_storage, None)
