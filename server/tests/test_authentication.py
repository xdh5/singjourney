from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.base import Base
import app.db.models  # noqa: F401
from app.modules.accounts.models import AuthIdentity, User
from app.modules.accounts.service import find_session, login_with_wechat_code


def test_wechat_login_reuses_identity_and_issues_hashed_sessions(monkeypatch) -> None:
    """Repeated WeChat codes for one OpenID must resolve one unified user."""

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    settings = Settings(
        _env_file=None,
        wechat_practice_app_id="practice-app-id",
        wechat_practice_app_secret="practice-secret",
        auth_session_days=30,
    )
    monkeypatch.setattr(
        "app.modules.accounts.service._exchange_code",
        lambda _settings, _code: "openid-for-test",
    )

    with Session(engine) as db:
        first = login_with_wechat_code(db, settings, "first-code", "zh-Hans")
        second = login_with_wechat_code(db, settings, "second-code", "en")

        assert first.user.id == second.user.id
        assert first.access_token != second.access_token
        assert db.scalar(select(func.count()).select_from(User)) == 1
        assert db.scalar(select(func.count()).select_from(AuthIdentity)) == 1
        resolved = find_session(db, second.access_token)
        assert resolved is not None
        _, user = resolved
        assert user.locale == "en"
