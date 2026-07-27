from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.modules.practice.constants import (
    MAXIMUM_PRACTICE_DURATION_SECONDS,
    MINIMUM_PRACTICE_DURATION_SECONDS,
    PRACTICE_EVENT_CLOCK_TOLERANCE_SECONDS,
)


class PracticeSessionCreateRequest(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=80)
    exercise_key: str = Field(min_length=1, max_length=80)
    duration_seconds: float = Field(
        ge=MINIMUM_PRACTICE_DURATION_SECONDS,
        le=MAXIMUM_PRACTICE_DURATION_SECONDS,
    )
    started_at: datetime
    ended_at: datetime

    @model_validator(mode="after")
    def validate_timeline(self) -> "PracticeSessionCreateRequest":
        if self.started_at.tzinfo is None or self.ended_at.tzinfo is None:
            raise ValueError("started_at and ended_at must include a timezone")
        elapsed_seconds = (self.ended_at - self.started_at).total_seconds()
        if elapsed_seconds <= 0:
            raise ValueError("ended_at must be after started_at")
        if self.duration_seconds > elapsed_seconds + PRACTICE_EVENT_CLOCK_TOLERANCE_SECONDS:
            raise ValueError("duration_seconds cannot exceed the event timeline")
        return self


class PracticeSessionResponse(BaseModel):
    id: str
    created: bool


class PracticeActivityDay(BaseModel):
    date: date
    sessions: int
    duration_seconds: float


class PracticeExerciseSummary(BaseModel):
    exercise_key: str
    sessions: int
    duration_seconds: float


class PracticePeriodSummary(BaseModel):
    sessions: int
    duration_seconds: float


class PracticeStatisticsResponse(BaseModel):
    today: PracticePeriodSummary
    total: PracticePeriodSummary
    activity: list[PracticeActivityDay]
    today_exercises: list[PracticeExerciseSummary]
