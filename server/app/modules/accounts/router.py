from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.modules.accounts.schemas import (
    AuthSessionResponse,
    AuthUser,
    CurrentSessionResponse,
    ProfileUpdateRequest,
    WeChatLoginRequest,
)
from app.modules.accounts.dependencies import require_current_user
from app.modules.accounts.models import User
from app.modules.accounts.service import (
    WeChatAuthenticationError,
    WeChatConfigurationError,
    find_session,
    login_with_wechat_code,
    update_profile,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/wechat/login",
    response_model=AuthSessionResponse,
    summary="Log in to the mini program with WeChat",
    description=(
        "Accepts the one-time code returned by wx.login, exchanges it with WeChat on the server, "
        "creates or resolves the unified SingJourney user, and returns an opaque application session. "
        "The WeChat AppSecret never reaches the client. This endpoint creates a user and session as a side effect."
    ),
    responses={
        200: {"description": "The WeChat identity is authenticated and an application session is issued."},
        401: {"description": "WeChat rejected the code or the identity could not be resolved."},
        422: {"description": "The request code or locale is invalid."},
        503: {"description": "The server has no mini-program AppID/AppSecret configuration."},
    },
)
def post_wechat_login(
    request: WeChatLoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthSessionResponse:
    try:
        issued = login_with_wechat_code(
            db,
            settings,
            request.code,
            request.locale,
            request.display_name,
            request.avatar_data_url,
        )
    except WeChatConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except WeChatAuthenticationError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error
    return AuthSessionResponse(
        access_token=issued.access_token,
        expires_at=issued.expires_at,
        user=AuthUser(
            id=issued.user.id,
            display_name=issued.user.display_name,
            avatar_data_url=issued.user.avatar_data_url,
            locale=issued.user.locale,
            preferred_voice_preset=issued.user.preferred_voice_preset,
        ),
    )


@router.get(
    "/session",
    response_model=CurrentSessionResponse,
    summary="Read the current authenticated session",
    description=(
        "Validates the opaque Bearer token issued by the login endpoint and returns its active user. "
        "It performs no writes and returns no WeChat credentials or provider identifiers."
    ),
    responses={
        200: {"description": "The session is active."},
        401: {"description": "The Authorization header is missing, malformed, expired, or revoked."},
    },
)
def get_current_session(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentSessionResponse:
    token = _bearer_token(authorization)
    result = find_session(db, token)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or expired")
    session, user = result
    return CurrentSessionResponse(
        expires_at=session.expires_at,
        user=AuthUser(
            id=user.id,
            display_name=user.display_name,
            avatar_data_url=user.avatar_data_url,
            locale=user.locale,
            preferred_voice_preset=user.preferred_voice_preset,
        ),
    )


@router.patch("/profile", response_model=AuthUser, summary="Update the current user profile")
def patch_profile(
    request: ProfileUpdateRequest,
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> AuthUser:
    updated = update_profile(
        db,
        user,
        request.display_name,
        request.avatar_data_url,
        request.preferred_voice_preset,
    )
    return AuthUser(
        id=updated.id,
        display_name=updated.display_name,
        avatar_data_url=updated.avatar_data_url,
        locale=updated.locale,
        preferred_voice_preset=updated.preferred_voice_preset,
    )


def _bearer_token(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    return token
