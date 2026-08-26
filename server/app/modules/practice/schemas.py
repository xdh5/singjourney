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
    title: str
    sessions: int
    duration_seconds: float


class PracticePeriodSummary(BaseModel):
    sessions: int
    duration_seconds: float


class PracticeWeekOverview(PracticePeriodSummary):
    practice_days: int
    average_daily_seconds: float


class PracticeCategorySummary(BaseModel):
    category_key: str
    name: str
    sessions: int
    duration_seconds: float
    percentage: float


class PracticeRankingItem(PracticeExerciseSummary):
    pass


class PracticeWeekStatistics(BaseModel):
    today: PracticePeriodSummary
    overview: PracticeWeekOverview
    daily_activity: list[PracticeActivityDay]
    category_distribution: list[PracticeCategorySummary]
    top_exercises: list[PracticeRankingItem]


class PracticeLifetimeHistory(PracticePeriodSummary):
    started_on: date | None
    practice_days: int
    longest_streak_days: int


class PracticeLifetimeStatistics(BaseModel):
    history: PracticeLifetimeHistory
    category_distribution: list[PracticeCategorySummary]
    top_exercises: list[PracticeRankingItem]


class PracticeStatisticsResponse(BaseModel):
    week: PracticeWeekStatistics
    lifetime: PracticeLifetimeStatistics


class PracticeCategoryResponse(BaseModel):
    key: str
    name: str


class PracticeExerciseResponse(BaseModel):
    id: str
    title: str
    tip: str
    category_keys: list[str]
    category_names: list[str]
    pattern: str
    recommended_syllables: str
    tempo: int
    repetitions: int
    intensity: str
    enabled: bool


class PracticeCatalogResponse(BaseModel):
    categories: list[PracticeCategoryResponse]
    exercises: list[PracticeExerciseResponse]


class PracticeTargetNoteResponse(BaseModel):
    start: float
    end: float
    midi: int


class PracticeRangeResponse(BaseModel):
    minimum_midi: int
    maximum_midi: int


class PracticeAudioSegmentResponse(BaseModel):
    source_offset: float
    duration: float


class PracticeManifestResponse(BaseModel):
    exercise_key: str
    version: int
    voice: str
    tempo_bpm: int
    range: PracticeRangeResponse
    duration: float
    audio_path: str
    audio_offset: float
    audio_segments: list[PracticeAudioSegmentResponse]
    target_notes: list[PracticeTargetNoteResponse]


class PracticeFavoritesResponse(BaseModel):
    exercise_ids: list[str]


class DailyPracticeMessageResponse(BaseModel):
    id: int
    date: date
    content: str
