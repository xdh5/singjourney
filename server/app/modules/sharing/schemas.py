from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.sharing.constants import MAX_SHARE_DURATION_SECONDS, MAX_SHARE_TITLE_LENGTH


class PitchPoint(BaseModel):
    time: float = Field(ge=0, le=MAX_SHARE_DURATION_SECONDS)
    midi: float | None = Field(default=None, ge=0, le=127)
    confidence: float = Field(ge=0, le=1)


class AudioUploadRequest(BaseModel):
    filename: str | None = Field(default=None, max_length=255)
    mime_type: str = Field(min_length=1, max_length=100)
    byte_size: int = Field(gt=0)


class ShareCreateRequest(BaseModel):
    public_id: UUID | None = Field(
        default=None,
        description="Client-generated opaque UUID used when a share card needs its destination before upload finishes.",
    )
    title: str = Field(min_length=1, max_length=MAX_SHARE_TITLE_LENGTH)
    duration_seconds: float = Field(gt=0, le=MAX_SHARE_DURATION_SECONDS)
    curve: list[PitchPoint]
    audio: AudioUploadRequest


class ShareUploadIntent(BaseModel):
    id: str
    expires_at: datetime
    upload_url: str
    upload_headers: dict[str, str]
    complete_url: str
    delete_token: str


class ShareActivated(BaseModel):
    id: str
    title: str
    duration_seconds: float
    expires_at: datetime
    share_url: str
    audio_url: str


class SharePublic(BaseModel):
    id: str
    title: str
    duration_seconds: float
    curve_version: int
    curve: list[PitchPoint]
    created_at: datetime
    expires_at: datetime
    audio_url: str
