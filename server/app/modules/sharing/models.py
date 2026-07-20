from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.accounts.models import new_id, utc_now


class RecordingShare(Base):
    __tablename__ = "recording_shares"
    __table_args__ = (Index("ix_recording_shares_expiry", "expires_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    audio_asset_id: Mapped[str] = mapped_column(ForeignKey("audio_assets.id", ondelete="CASCADE"), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    duration_seconds: Mapped[float] = mapped_column(Float)
    curve_version: Mapped[int] = mapped_column(Integer, default=1)
    curve_data: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    delete_token_hash: Mapped[str] = mapped_column(String(64))
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

