from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.practice.constants import (
    PRACTICE_ACTIVITY_DAY_COUNT,
    PRACTICE_ACTIVITY_WEEKS,
    PRACTICE_MODE_GUIDED,
)
from app.modules.practice.models import PracticeSession
from app.modules.practice.schemas import (
    PracticeActivityDay,
    PracticeExerciseSummary,
    PracticePeriodSummary,
    PracticeSessionCreateRequest,
    PracticeStatisticsResponse,
)


def record_completed_practice(
    db: Session,
    user_id: str,
    request: PracticeSessionCreateRequest,
) -> tuple[PracticeSession, bool]:
    """Persist one completed guided practice idempotently using the client event identifier."""
    existing = db.scalar(
        select(PracticeSession).where(
            PracticeSession.user_id == user_id,
            PracticeSession.client_event_id == request.client_event_id,
        )
    )
    if existing:
        return existing, False

    session = PracticeSession(
        user_id=user_id,
        client_event_id=request.client_event_id,
        exercise_key=request.exercise_key,
        mode=PRACTICE_MODE_GUIDED,
        duration_seconds=request.duration_seconds,
        started_at=request.started_at,
        ended_at=request.ended_at,
    )
    db.add(session)
    db.commit()
    return session, True


def read_practice_statistics(
    db: Session,
    user_id: str,
    timezone_offset_minutes: int,
    now: datetime | None = None,
) -> PracticeStatisticsResponse:
    """Aggregate all-time, local-day, per-exercise, and 20-week activity for one user."""
    current_utc = _as_utc(now or datetime.now(timezone.utc))
    offset = timedelta(minutes=timezone_offset_minutes)
    local_today = (current_utc - offset).date()
    local_start_date = local_today - timedelta(
        days=local_today.weekday() + (PRACTICE_ACTIVITY_WEEKS - 1) * 7
    )
    activity_start_utc = _local_midnight_to_utc(local_start_date, offset)

    total_sessions, total_duration = db.execute(
        select(func.count(PracticeSession.id), func.coalesce(func.sum(PracticeSession.duration_seconds), 0.0))
        .where(PracticeSession.user_id == user_id)
    ).one()

    recent_sessions = db.execute(
        select(
            PracticeSession.started_at,
            PracticeSession.exercise_key,
            PracticeSession.duration_seconds,
        ).where(
            PracticeSession.user_id == user_id,
            PracticeSession.started_at >= activity_start_utc,
        )
    ).all()

    daily: dict[date, list[float]] = defaultdict(lambda: [0, 0.0])
    today_exercises: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])
    for started_at, exercise_key, duration_seconds in recent_sessions:
        local_date = (_as_utc(started_at) - offset).date()
        if local_date < local_start_date or local_date > local_today:
            continue
        daily[local_date][0] += 1
        daily[local_date][1] += float(duration_seconds)
        if local_date == local_today and exercise_key:
            today_exercises[exercise_key][0] += 1
            today_exercises[exercise_key][1] += float(duration_seconds)

    today_values = daily[local_today]
    activity = []
    for day_index in range(PRACTICE_ACTIVITY_DAY_COUNT):
        activity_date = local_start_date + timedelta(days=day_index)
        sessions, duration = daily[activity_date]
        activity.append(
            PracticeActivityDay(
                date=activity_date,
                sessions=int(sessions),
                duration_seconds=round(duration, 3),
            )
        )

    exercises = [
        PracticeExerciseSummary(
            exercise_key=exercise_key,
            sessions=int(values[0]),
            duration_seconds=round(values[1], 3),
        )
        for exercise_key, values in sorted(
            today_exercises.items(),
            key=lambda item: (-item[1][1], item[0]),
        )
    ]
    return PracticeStatisticsResponse(
        today=PracticePeriodSummary(
            sessions=int(today_values[0]),
            duration_seconds=round(today_values[1], 3),
        ),
        total=PracticePeriodSummary(
            sessions=int(total_sessions),
            duration_seconds=round(float(total_duration), 3),
        ),
        activity=activity,
        today_exercises=exercises,
    )


def _local_midnight_to_utc(local_date: date, offset: timedelta) -> datetime:
    return datetime.combine(local_date, time.min, tzinfo=timezone.utc) + offset


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
