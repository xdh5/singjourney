from sqlalchemy import func, inspect, select, text

import app.db.models  # noqa: F401
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.modules.practice.daily_message_seed_data import MESSAGES
from app.modules.practice.exercise_seed_data import CATEGORIES, EXERCISES, EXTRA_TAGS
from app.modules.practice.constants import PRACTICE_EXERCISES_BY_KEY
from app.modules.practice.models import (
    DailyPracticeMessage,
    PracticeCategory,
    PracticeExercise,
    PracticeExerciseCategory,
)


def initialize_database() -> None:
    """Create the current schema and seed current reference data on an empty database."""

    Base.metadata.create_all(bind=engine)
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "avatar_data_url" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_data_url TEXT"))
    if "preferred_voice_preset" not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN preferred_voice_preset VARCHAR(8)")
            )
    with SessionLocal.begin() as session:
        if session.scalar(select(func.count()).select_from(DailyPracticeMessage)) == 0:
            session.add_all(
                DailyPracticeMessage(
                    id=index,
                    content_zh_hans=zh,
                    content_en=en,
                    active=True,
                )
                for index, (zh, en) in enumerate(MESSAGES, start=1)
            )
        if session.scalar(select(func.count()).select_from(PracticeExercise)) == 0:
            seed_practice_catalog(session)
        else:
            synchronize_practice_tempos(session)
            synchronize_practice_catalog(session)


def seed_practice_catalog(session) -> None:
    session.add_all(PracticeCategory(**row) for row in CATEGORIES)
    for index, row in enumerate(EXERCISES, start=1):
        exercise_id, primary_category = row[0], row[1]
        session.add(
            PracticeExercise(
                id=exercise_id,
                title_zh_hans=row[2],
                title_en=row[3],
                tip_zh_hans=row[4],
                tip_en=row[5],
                pattern=row[6],
                recommended_syllables=row[7],
                tempo=PRACTICE_EXERCISES_BY_KEY[exercise_id].tempo_bpm,
                repetitions=row[9],
                intensity=row[10],
                enabled=True,
                sort_order=index * 10,
            )
        )
        category_keys = (primary_category, *EXTRA_TAGS.get(exercise_id, ()))
        for tag_index, category_key in enumerate(dict.fromkeys(category_keys)):
            session.add(
                PracticeExerciseCategory(
                    exercise_id=exercise_id,
                    category_key=category_key,
                    sort_order=tag_index * 10,
                )
            )


def synchronize_practice_tempos(session) -> None:
    """让数据库展示速度始终与实际共享伴奏一致。"""

    for exercise_key, definition in PRACTICE_EXERCISES_BY_KEY.items():
        exercise = session.get(PracticeExercise, exercise_key)
        if exercise is not None:
            exercise.tempo = definition.tempo_bpm


def synchronize_practice_catalog(session) -> None:
    """将新增的内置练习补充到已有曲库。"""

    existing_exercise_ids = set(session.scalars(select(PracticeExercise.id)))
    for index, row in enumerate(EXERCISES, start=1):
        exercise_id, primary_category = row[0], row[1]
        if exercise_id in existing_exercise_ids:
            continue
        session.add(
            PracticeExercise(
                id=exercise_id,
                title_zh_hans=row[2],
                title_en=row[3],
                tip_zh_hans=row[4],
                tip_en=row[5],
                pattern=row[6],
                recommended_syllables=row[7],
                tempo=PRACTICE_EXERCISES_BY_KEY[exercise_id].tempo_bpm,
                repetitions=row[9],
                intensity=row[10],
                enabled=True,
                sort_order=index * 10,
            )
        )
        category_keys = (primary_category, *EXTRA_TAGS.get(exercise_id, ()))
        for tag_index, category_key in enumerate(dict.fromkeys(category_keys)):
            session.add(
                PracticeExerciseCategory(
                    exercise_id=exercise_id,
                    category_key=category_key,
                    sort_order=tag_index * 10,
                )
            )
