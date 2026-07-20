import hashlib
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from app.modules.media.formats import safe_audio_suffix


UPLOAD_CHUNK_BYTES = 1024 * 1024

class UploadTooLargeError(ValueError):
    pass


@dataclass(frozen=True)
class StoredUpload:
    storage_key: str
    byte_size: int
    sha256: str


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    async def save_upload(self, upload: UploadFile, *, max_bytes: int) -> StoredUpload:
        now = datetime.now(timezone.utc)
        suffix = safe_audio_suffix(upload.filename, upload.content_type)
        storage_key = f"shares/{now:%Y/%m}/{uuid.uuid4().hex}{suffix}"
        destination = self.path_for(storage_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(f"{destination.suffix}.part")
        digest = hashlib.sha256()
        byte_size = 0

        try:
            with temporary.open("wb") as output:
                while chunk := await upload.read(UPLOAD_CHUNK_BYTES):
                    byte_size += len(chunk)
                    if byte_size > max_bytes:
                        raise UploadTooLargeError
                    digest.update(chunk)
                    output.write(chunk)
            os.replace(temporary, destination)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
        finally:
            await upload.close()

        return StoredUpload(storage_key=storage_key, byte_size=byte_size, sha256=digest.hexdigest())

    def path_for(self, storage_key: str) -> Path:
        candidate = (self.root / storage_key).resolve()
        if candidate != self.root and self.root not in candidate.parents:
            raise ValueError("Invalid storage key")
        return candidate

    def delete(self, storage_key: str) -> None:
        self.path_for(storage_key).unlink(missing_ok=True)
