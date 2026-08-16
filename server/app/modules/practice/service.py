from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from hashlib import sha256

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.practice.constants import (
    FREE_PRACTICE_CATEGORY_KEY,
    FREE_PRACTICE_EXERCISE_KEY,
    FREE_PRACTICE_MODE,
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
    PracticeCategorySummary,
    PracticeLifetimeHistory,
    PracticeLifetimeStatistics,
    PracticePeriodSummary,
    PracticeRankingItem,
    PracticeSessionCreateRequest,
    PracticeStatisticsResponse,
    PracticeWeekOverview,
    PracticeWeekStatistics,
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
        mode=(
            FREE_PRACTICE_MODE
            if request.exercise_key == FREE_PRACTICE_EXERCISE_KEY
            else PRACTICE_MODE_GUIDED
        ),
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
    """Aggregate the current week and lifetime practice history for one user."""
    current_utc = _as_utc(now or datetime.now(timezone.utc))
    offset = timedelta(minutes=timezone_offset_minutes)
    local_today = (current_utc - offset).date()
    week_start_date = local_today - timedelta(days=local_today.weekday())
    week_start_utc = _local_midnight_to_utc(week_start_date, offset)

    total_sessions, total_duration = db.execute(
        select(func.count(PracticeSession.id), func.coalesce(func.sum(PracticeSession.duration_seconds), 0.0))
        .where(PracticeSession.user_id == user_id)
    ).one()

    week_sessions = db.execute(
        select(
            PracticeSession.started_at,
            PracticeSession.exercise_key,
            PracticeSession.duration_seconds,
        ).where(
            PracticeSession.user_id == user_id,
            PracticeSession.started_at >= week_start_utc,
        )
    ).all()

    daily: dict[date, list[float]] = defaultdict(lambda: [0, 0.0])
    week_exercises: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])
    for started_at, exercise_key, duration_seconds in week_sessions:
        local_date = (_as_utc(started_at) - offset).date()
        if local_date < week_start_date or local_date > local_today:
            continue
        daily[local_date][0] += 1
        daily[local_date][1] += float(duration_seconds)
        if exercise_key:
            week_exercises[exercise_key][0] += 1
            week_exercises[exercise_key][1] += float(duration_seconds)

    today_values = daily[local_today]
    daily_activity = []
    for day_index in range(7):
        activity_date = week_start_date + timedelta(days=day_index)
        sessions, duration = daily[activity_date]
        daily_activity.append(
            PracticeActivityDay(
                date=activity_date,
                sessions=int(sessions),
                duration_seconds=round(duration, 3),
            )
        )

    all_exercise_rows = db.execute(
        select(
            PracticeSession.exercise_key,
            func.count(PracticeSession.id),
            func.coalesce(func.sum(PracticeSession.duration_seconds), 0.0),
        )
        .where(PracticeSession.user_id == user_id)
        .group_by(PracticeSession.exercise_key)
    ).all()
    all_exercises = {
        exercise_key: [int(sessions), float(duration)]
        for exercise_key, sessions, duration in all_exercise_rows
        if exercise_key
    }

    session_dates = sorted(
        {
            (_as_utc(started_at) - offset).date()
            for started_at in db.scalars(
                select(PracticeSession.started_at).where(PracticeSession.user_id == user_id)
            ).all()
        }
    )

    use_english = locale.lower().startswith("en")
    all_exercise_keys = set(week_exercises) | set(all_exercises)
    exercise_records = db.scalars(
        select(PracticeExercise).where(PracticeExercise.id.in_(all_exercise_keys))
    ).all()
    exercise_titles = {
        exercise.id: exercise.title_en if use_english else exercise.title_zh_hans
        for exercise in exercise_records
    }
    exercise_titles[FREE_PRACTICE_EXERCISE_KEY] = "Free Practice" if use_english else "自由练声"

    categories = db.scalars(
        select(PracticeCategory)
        .where(PracticeCategory.active.is_(True))
        .order_by(PracticeCategory.sort_order, PracticeCategory.key)
    ).all()
    category_names = {
        category.key: category.name_en if use_english else category.name_zh_hans
        for category in categories
    }
    primary_category_by_exercise: dict[str, str] = {
        FREE_PRACTICE_EXERCISE_KEY: FREE_PRACTICE_CATEGORY_KEY
    }
    category_rows = db.execute(
        select(PracticeExerciseCategory.exercise_id, PracticeExerciseCategory.category_key)
        .where(PracticeExerciseCategory.exercise_id.in_(all_exercise_keys))
        .order_by(PracticeExerciseCategory.exercise_id, PracticeExerciseCategory.sort_order)
    ).all()
    for exercise_key, category_key in category_rows:
        primary_category_by_exercise.setdefault(exercise_key, category_key)

    week_duration = sum(values[1] for values in week_exercises.values())
    week_session_count = sum(int(values[0]) for values in week_exercises.values())
    practice_days = sum(1 for values in daily.values() if values[0] > 0)
    return PracticeStatisticsResponse(
        week=PracticeWeekStatistics(
            today=PracticePeriodSummary(
                sessions=int(today_values[0]),
                duration_seconds=round(today_values[1], 3),
            ),
            overview=PracticeWeekOverview(
                sessions=week_session_count,
                duration_seconds=round(week_duration, 3),
                practice_days=practice_days,
                average_daily_seconds=round(week_duration / practice_days, 3)
                if practice_days
                else 0,
            ),
            daily_activity=daily_activity,
            category_distribution=_category_summaries(
                week_exercises,
                primary_category_by_exercise,
                category_names,
            ),
            top_exercises=_exercise_ranking(week_exercises, exercise_titles),
        ),
        lifetime=PracticeLifetimeStatistics(
            history=PracticeLifetimeHistory(
                sessions=int(total_sessions),
                duration_seconds=round(float(total_duration), 3),
                started_on=session_dates[0] if session_dates else None,
                practice_days=len(session_dates),
                longest_streak_days=_longest_streak(session_dates),
            ),
            category_distribution=_category_summaries(
                all_exercises,
                primary_category_by_exercise,
                category_names,
            ),
            top_exercises=_exercise_ranking(all_exercises, exercise_titles),
        ),
    )


def _exercise_ranking(
    exercise_values: dict[str, list[float]],
    exercise_titles: dict[str, str],
) -> list[PracticeRankingItem]:
    return [
        PracticeRankingItem(
            exercise_key=exercise_key,
            title=exercise_titles.get(exercise_key, exercise_key),
            sessions=int(values[0]),
            duration_seconds=round(values[1], 3),
        )
        for exercise_key, values in sorted(
            exercise_values.items(),
            key=lambda item: (-item[1][0], -item[1][1], item[0]),
        )[:5]
    ]


def _category_summaries(
    exercise_values: dict[str, list[float]],
    primary_category_by_exercise: dict[str, str],
    category_names: dict[str, str],
) -> list[PracticeCategorySummary]:
    grouped: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])
    for exercise_key, values in exercise_values.items():
        category_key = primary_category_by_exercise.get(exercise_key)
        if not category_key:
            continue
        grouped[category_key][0] += values[0]
        grouped[category_key][1] += values[1]
    total_duration = sum(values[1] for values in grouped.values())
    return [
        PracticeCategorySummary(
            category_key=category_key,
            name=category_names.get(category_key, category_key),
            sessions=int(values[0]),
            duration_seconds=round(values[1], 3),
            percentage=round(values[1] / total_duration * 100, 1) if total_duration else 0,
        )
        for category_key, values in sorted(
            grouped.items(),
            key=lambda item: (-item[1][1], item[0]),
        )
    ]


def _longest_streak(dates: list[date]) -> int:
    longest = 0
    current = 0
    previous: date | None = None
    for practice_date in dates:
        current = current + 1 if previous and practice_date == previous + timedelta(days=1) else 1
        longest = max(longest, current)
        previous = practice_date
    return longest


def _local_midnight_to_utc(local_date: date, offset: timedelta) -> datetime:
    return datetime.combine(local_date, time.min, tzinfo=timezone.utc) + offset


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
