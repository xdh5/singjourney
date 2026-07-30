from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.modules.telemetry.constants import (
    MAXIMUM_BATCH_EVENTS,
    MAXIMUM_RECORDING_DURATION_SECONDS,
    TelemetryEventName,
    TelemetryPlatform,
)


class ClientTelemetryEvent(BaseModel):
    """One allowlisted, low-cardinality client event without audio or pitch data."""

    event_id: str = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    event_name: TelemetryEventName
    occurred_at: datetime
    platform: TelemetryPlatform
    app_version: str = Field(min_length=1, max_length=40)
    anonymous_id: str = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    session_id: str = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    locale: str = Field(default="unknown", min_length=1, max_length=20)
    source_page: str = Field(default="unknown", min_length=1, max_length=40)
    feature_key: str | None = Field(default=None, max_length=40, pattern=r"^[a-z0-9._-]+$")
    recording_id: str | None = Field(default=None, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    duration_seconds: float | None = Field(
        default=None,
        ge=0,
        le=MAXIMUM_RECORDING_DURATION_SECONDS,
    )
    error_code: str | None = Field(default=None, max_length=80, pattern=r"^[a-z0-9._-]+$")

    @field_validator("occurred_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("occurred_at must include a timezone")
        return value


class ClientTelemetryBatch(BaseModel):
    events: list[ClientTelemetryEvent] = Field(min_length=1, max_length=MAXIMUM_BATCH_EVENTS)


class ClientTelemetryResponse(BaseModel):
    accepted: int
