from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from hashlib import sha256

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.practice.constants import (
    PRACTICE_ACTIVITY_DAY_COUNT,
    PRACTICE_ACTIVITY_WEEKS,
    PRACTICE_MODE_GUIDED,
)
from app.modules.practice.models import (
    DailyPracticeMessage,
    PracticeCategory,
    PracticeExercise,
    PracticeExerciseCategory,
    PracticeFavorite,
    PracticeSession,
)
from app.modules.practice.schemas import (
    PracticeActivityDay,
    PracticeExerciseSummary,
    PracticePeriodSummary,
    PracticeSessionCreateRequest,
    PracticeStatisticsResponse,
)


def read_practice_catalog(db: Session, locale: str):
    """Return the active exercise catalog, localized from database fields."""
    use_english = locale.lower().startswith("en")
    categories = db.scalars(
        select(PracticeCategory)
        .where(PracticeCategory.active.is_(True))
        .order_by(PracticeCategory.sort_order, PracticeCategory.key)
    ).all()
    exercises = db.scalars(
        select(PracticeExercise).order_by(PracticeExercise.sort_order, PracticeExercise.id)
    ).all()
    category_rows = db.execute(
        select(PracticeExerciseCategory.exercise_id, PracticeCategory)
        .join(PracticeCategory, PracticeCategory.key == PracticeExerciseCategory.category_key)
        .where(PracticeCategory.active.is_(True))
        .order_by(
            PracticeExerciseCategory.exercise_id,
            PracticeExerciseCategory.sort_order,
            PracticeCategory.sort_order,
        )
    ).all()
    exercise_categories: dict[str, list[PracticeCategory]] = defaultdict(list)
    for exercise_id, category in category_rows:
        exercise_categories[exercise_id].append(category)
    return {
        "categories": [
            {"key": category.key, "name": category.name_en if use_english else category.name_zh_hans}
            for category in categories
        ],
        "exercises": [
            {
                "id": exercise.id,
                "title": exercise.title_en if use_english else exercise.title_zh_hans,
                "tip": exercise.tip_en if use_english else exercise.tip_zh_hans,
                "category_keys": [category.key for category in exercise_categories[exercise.id]],
                "category_names": [
                    category.name_en if use_english else category.name_zh_hans
                    for category in exercise_categories[exercise.id]
                ],
                "pattern": exercise.pattern,
                "recommended_syllables": exercise.recommended_syllables,
                "tempo": exercise.tempo,
                "repetitions": exercise.repetitions,
                "intensity": exercise.intensity,
                "enabled": exercise.enabled,
            }
            for exercise in exercises
            if exercise_categories[exercise.id]
        ],
    }


def read_daily_practice_message(db: Session, local_date: date, locale: str):
    """Map a calendar date deterministically to one of the 30 stored messages."""
    message_id = int.from_bytes(sha256(local_date.isoformat().encode()).digest()[:8], "big") % 30 + 1
    message = db.get(DailyPracticeMessage, message_id)
    if message is None or not message.active:
        return None
    return {
        "id": message.id,
        "date": local_date,
        "content": message.content_en if locale.lower().startswith("en") else message.content_zh_hans,
    }


def read_practice_favorites(db: Session, user_id: str) -> list[str]:
    return list(
        db.scalars(
            select(PracticeFavorite.exercise_id)
            .where(PracticeFavorite.user_id == user_id)
            .order_by(PracticeFavorite.created_at, PracticeFavorite.exercise_id)
        ).all()
    )


def add_practice_favorite(db: Session, user_id: str, exercise_id: str) -> bool:
    if db.get(PracticeExercise, exercise_id) is None:
        return False
    if db.get(PracticeFavorite, (user_id, exercise_id)) is None:
        db.add(PracticeFavorite(user_id=user_id, exercise_id=exercise_id))
        db.commit()
    return True


def remove_practice_favorite(db: Session, user_id: str, exercise_id: str) -> None:
    favorite = db.get(PracticeFavorite, (user_id, exercise_id))
    if favorite is not None:
        db.delete(favorite)
        db.commit()


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
    locale: str = "zh-Hans",
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

    use_english = locale.lower().startswith("en")
    exercise_records = db.scalars(
        select(PracticeExercise).where(PracticeExercise.id.in_(today_exercises.keys()))
    ).all()
    exercise_titles = {
        exercise.id: exercise.title_en if use_english else exercise.title_zh_hans
        for exercise in exercise_records
    }
    exercises = [
        PracticeExerciseSummary(
            exercise_key=exercise_key,
            title=exercise_titles.get(exercise_key, exercise_key),
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
