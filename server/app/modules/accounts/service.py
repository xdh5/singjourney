import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.accounts.constants import (
    AUTH_TOKEN_BYTES,
    WECHAT_CODE_EXCHANGE_URL,
    WECHAT_GRANT_TYPE,
    WECHAT_PROVIDER,
    WECHAT_REQUEST_TIMEOUT_SECONDS,
)
from app.modules.accounts.models import AuthIdentity, AuthSession, User


class WeChatAuthenticationError(RuntimeError):
    """The supplied WeChat code was rejected or could not be exchanged."""


class WeChatConfigurationError(RuntimeError):
    """The mini program credentials are absent on the server."""


@dataclass(frozen=True)
class IssuedSession:
    access_token: str
    expires_at: datetime
    user: User


def login_with_wechat_code(
    db: Session,
    settings: Settings,
    code: str,
    locale: str | None,
    display_name: str | None,
    avatar_data_url: str | None,
) -> IssuedSession:
    """Exchange a one-time WeChat code, upsert its identity, and issue an opaque session."""
    openid = _exchange_code(settings, code)
    identity = db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == WECHAT_PROVIDER,
            AuthIdentity.provider_subject == openid,
        )
    )
    if identity:
        user = db.get(User, identity.user_id)
        if user is None:
            raise WeChatAuthenticationError("The linked account no longer exists")
        if locale and user.locale != locale:
            user.locale = locale
    else:
        user = User(
            locale=locale,
            display_name=display_name.strip() if display_name else None,
            avatar_data_url=avatar_data_url,
        )
        db.add(user)
        db.flush()
        db.add(
            AuthIdentity(
                user_id=user.id,
                provider=WECHAT_PROVIDER,
                provider_subject=openid,
                verified_at=datetime.now(timezone.utc),
            )
        )

    access_token = secrets.token_urlsafe(AUTH_TOKEN_BYTES)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.auth_session_days)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=_hash_token(access_token),
            expires_at=expires_at,
        )
    )
    db.commit()
    return IssuedSession(access_token=access_token, expires_at=expires_at, user=user)


def find_session(db: Session, access_token: str) -> tuple[AuthSession, User] | None:
    """Resolve a non-expired opaque session without storing the raw token."""
    now = datetime.now(timezone.utc)
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == _hash_token(access_token),
            AuthSession.expires_at > now,
        )
    )
    if not session:
        return None
    user = db.get(User, session.user_id)
    if not user or user.status != "active":
        return None
    return session, user


def update_profile(
    db: Session,
    user: User,
    display_name: str | None,
    avatar_data_url: str | None,
    preferred_voice_preset: str | None,
) -> User:
    if display_name is not None and user.display_name is None:
        user.display_name = display_name.strip()
    if avatar_data_url is not None and user.avatar_data_url is None:
        user.avatar_data_url = avatar_data_url
    if preferred_voice_preset is not None:
        user.preferred_voice_preset = preferred_voice_preset
    db.commit()
    db.refresh(user)
    return user


def _exchange_code(settings: Settings, code: str) -> str:
    if not settings.mini_program_app_id or not settings.mini_program_app_secret:
        raise WeChatConfigurationError("WeChat login is not configured")
    query = urlencode(
        {
            "appid": settings.mini_program_app_id,
            "secret": settings.mini_program_app_secret,
            "js_code": code,
            "grant_type": WECHAT_GRANT_TYPE,
        }
    )
    try:
        with urlopen(
            f"{WECHAT_CODE_EXCHANGE_URL}?{query}",
            timeout=WECHAT_REQUEST_TIMEOUT_SECONDS,
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise WeChatAuthenticationError("WeChat session exchange failed") from error
    openid = payload.get("openid")
    if not openid:
        raise WeChatAuthenticationError(payload.get("errmsg") or "WeChat rejected the login code")
    return str(openid)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
