from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.accounts.models import new_id, utc_now


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (Index("ix_evaluations_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recording_id: Mapped[str | None] = mapped_column(ForeignKey("recordings.id", ondelete="SET NULL"), index=True)
    audio_asset_id: Mapped[str | None] = mapped_column(ForeignKey("audio_assets.id", ondelete="SET NULL"), index=True)
    exercise_key: Mapped[str | None] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    model_key: Mapped[str] = mapped_column(String(80))
    model_version: Mapped[str] = mapped_column(String(40))
    overall_score: Mapped[float | None] = mapped_column(Float)
    summary: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class EvaluationDimension(Base):
    __tablename__ = "evaluation_dimensions"
    __table_args__ = (
        UniqueConstraint("evaluation_id", "dimension_key", name="uq_evaluation_dimension"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    evaluation_id: Mapped[str] = mapped_column(ForeignKey("evaluations.id", ondelete="CASCADE"), index=True)
    dimension_key: Mapped[str] = mapped_column(String(40))
    score: Mapped[float | None] = mapped_column(Float)
    confidence: Mapped[float | None] = mapped_column(Float)
    metrics: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    feedback: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)

