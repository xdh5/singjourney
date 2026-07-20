from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.accounts.models import new_id, utc_now


class AudioAsset(Base):
    __tablename__ = "audio_assets"
    __table_args__ = (Index("ix_audio_assets_expiry", "purpose", "expires_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    purpose: Mapped[str] = mapped_column(String(24), index=True)
    storage_provider: Mapped[str] = mapped_column(String(32), index=True)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    upload_status: Mapped[str] = mapped_column(String(24), index=True)
    original_name: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    container: Mapped[str | None] = mapped_column(String(24))
    codec: Mapped[str | None] = mapped_column(String(24))
    byte_size: Mapped[int] = mapped_column(Integer)
    duration_seconds: Mapped[float] = mapped_column(Float)
    sample_rate: Mapped[int | None] = mapped_column(Integer)
    channels: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Recording(Base):
    __tablename__ = "recordings"
    __table_args__ = (
        UniqueConstraint("user_id", "client_recording_id", name="uq_recording_user_client_id"),
        Index("ix_recordings_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    client_recording_id: Mapped[str | None] = mapped_column(String(96))
    audio_asset_id: Mapped[str | None] = mapped_column(ForeignKey("audio_assets.id", ondelete="SET NULL"), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    duration_seconds: Mapped[float] = mapped_column(Float)
    curve_version: Mapped[int] = mapped_column(Integer, default=1)
    curve_data: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
