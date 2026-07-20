from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ObjectMetadata:
    byte_size: int
    content_type: str | None


class DirectObjectStorage(Protocol):
    provider: str

    def create_key(self, filename: str | None, content_type: str) -> str: ...

    def create_upload_url(self, storage_key: str, content_type: str) -> str: ...

    def create_download_url(self, storage_key: str) -> str: ...

    def stat(self, storage_key: str) -> ObjectMetadata | None: ...

    def delete(self, storage_key: str) -> None: ...
