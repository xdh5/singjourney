from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.db.base import Base
import app.db.models  # noqa: F401
from app.modules.accounts.models import User
from app.modules.practice.models import PracticeSession
from app.modules.practice.schemas import PracticeSessionCreateRequest
from app.modules.practice.service import record_completed_practice, read_practice_statistics


def test_completed_practice_is_idempotent_and_aggregated_by_local_day() -> None:
    """One client event counts once and UTC timestamps are grouped using the user's local offset."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 7, 22, 16, 30, tzinfo=timezone.utc)

    with Session(engine) as db:
        user = User(locale="zh-Hans")
        db.add(user)
        db.commit()
        request = PracticeSessionCreateRequest(
            client_event_id="practice-event-0001",
            exercise_key="connection-mum-octave",
            duration_seconds=98,
            started_at=now - timedelta(seconds=100),
            ended_at=now,
        )

        first, first_created = record_completed_practice(db, user.id, request)
        second, second_created = record_completed_practice(db, user.id, request)

        assert first.id == second.id
        assert first_created is True
        assert second_created is False
        assert db.scalar(select(func.count()).select_from(PracticeSession)) == 1

        statistics = read_practice_statistics(db, user.id, -480, now=now)
        assert statistics.today.sessions == 1
        assert statistics.today.duration_seconds == 98
        assert statistics.total.sessions == 1
        assert len(statistics.activity) == 140
        assert statistics.activity[-1].date.weekday() == 6
        assert sum(day.sessions for day in statistics.activity) == 1
        assert statistics.today_exercises[0].exercise_key == "connection-mum-octave"
