from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.accounts.models import new_id, utc_now


class PracticeCategory(Base):
    __tablename__ = "practice_categories"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    name_zh_hans: Mapped[str] = mapped_column(String(40))
    name_en: Mapped[str] = mapped_column(String(80))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class PracticeExercise(Base):
    __tablename__ = "practice_exercises"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title_zh_hans: Mapped[str] = mapped_column(String(120))
    title_en: Mapped[str] = mapped_column(String(160))
    tip_zh_hans: Mapped[str] = mapped_column(Text)
    tip_en: Mapped[str] = mapped_column(Text)
    pattern: Mapped[str] = mapped_column(String(120))
    recommended_syllables: Mapped[str] = mapped_column(String(80))
    tempo: Mapped[int] = mapped_column(Integer)
    repetitions: Mapped[int] = mapped_column(Integer)
    intensity: Mapped[str] = mapped_column(String(24))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)


class PracticeExerciseCategory(Base):
    __tablename__ = "practice_exercise_categories"

    exercise_id: Mapped[str] = mapped_column(
        ForeignKey("practice_exercises.id", ondelete="CASCADE"), primary_key=True
    )
    category_key: Mapped[str] = mapped_column(
        ForeignKey("practice_categories.key", ondelete="CASCADE"), primary_key=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class PracticeFavorite(Base):
    __tablename__ = "practice_favorites"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    exercise_id: Mapped[str] = mapped_column(
        ForeignKey("practice_exercises.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DailyPracticeMessage(Base):
    __tablename__ = "daily_practice_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content_zh_hans: Mapped[str] = mapped_column(String(120))
    content_en: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class Accompaniment(Base):
    __tablename__ = "accompaniments"
    __table_args__ = (Index("ix_accompaniments_user_order", "user_id", "sort_order"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    audio_asset_id: Mapped[str] = mapped_column(ForeignKey("audio_assets.id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(24), default="user")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class PracticeSession(Base):
    __tablename__ = "practice_sessions"
    __table_args__ = (
        Index("ix_practice_sessions_user_started", "user_id", "started_at"),
        UniqueConstraint("user_id", "client_event_id", name="uq_practice_session_user_event"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recording_id: Mapped[str | None] = mapped_column(ForeignKey("recordings.id", ondelete="SET NULL"), index=True)
    accompaniment_id: Mapped[str | None] = mapped_column(ForeignKey("accompaniments.id", ondelete="SET NULL"), index=True)
    exercise_key: Mapped[str | None] = mapped_column(String(80), index=True)
    client_event_id: Mapped[str | None] = mapped_column(String(80))
    mode: Mapped[str] = mapped_column(String(32))
    duration_seconds: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
