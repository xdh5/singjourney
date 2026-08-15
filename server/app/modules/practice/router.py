from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.core.localization import resolve_request_locale
from app.modules.accounts.dependencies import require_current_user
from app.modules.accounts.models import User
from app.modules.practice.constants import (
    MAXIMUM_TIMEZONE_OFFSET_MINUTES,
    MINIMUM_TIMEZONE_OFFSET_MINUTES,
)
from app.modules.practice.schemas import (
    PracticeSessionCreateRequest,
    PracticeSessionResponse,
    PracticeStatisticsResponse,
    PracticeCatalogResponse,
    PracticeFavoritesResponse,
    PracticeManifestResponse,
    DailyPracticeMessageResponse,
)
from app.modules.practice.constants import (
    MASTER_ACCOMPANIMENT_FILENAME,
    OCTAVE_CONNECTION_EXERCISE_KEY,
)
from app.modules.practice.score import build_octave_connection_manifest
from app.modules.practice.service import (
    read_daily_practice_message,
    read_practice_catalog,
    read_practice_favorites,
    read_practice_statistics,
    record_completed_practice,
    add_practice_favorite,
    remove_practice_favorite,
)

router = APIRouter(prefix="/practice", tags=["practice"])


@router.get(
    "/exercises/{exercise_id}/manifest",
    response_model=PracticeManifestResponse,
    summary="Read a voice-specific segment of the shared accompaniment",
)
def get_practice_manifest(
    exercise_id: str,
    voice: str = Query(pattern="^(male|female)$"),
) -> PracticeManifestResponse:
    if exercise_id != OCTAVE_CONNECTION_EXERCISE_KEY:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise has no accompaniment")
    return PracticeManifestResponse.model_validate(
        build_octave_connection_manifest(
            voice,
            f"/practice/assets/{MASTER_ACCOMPANIMENT_FILENAME}",
        )
    )


@router.get("/assets/{filename}", response_class=FileResponse, include_in_schema=False)
def get_practice_asset(
    filename: str,
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    if filename != MASTER_ACCOMPANIMENT_FILENAME:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice asset not found")
    asset_path = settings.practice_asset_directory / filename
    if not asset_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice asset not found")
    return FileResponse(asset_path, media_type="audio/ogg", filename=filename)


@router.get("/catalog", response_model=PracticeCatalogResponse, summary="Read the practice catalog")
def get_practice_catalog(
    locale: str = Depends(resolve_request_locale),
    db: Session = Depends(get_db),
) -> PracticeCatalogResponse:
    return PracticeCatalogResponse.model_validate(read_practice_catalog(db, locale))


@router.get("/favorites", response_model=PracticeFavoritesResponse)
def get_practice_favorites(
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> PracticeFavoritesResponse:
    return PracticeFavoritesResponse(exercise_ids=read_practice_favorites(db, user.id))


@router.put("/favorites/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def put_practice_favorite(
    exercise_id: str,
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not add_practice_favorite(db, user.id, exercise_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")


@router.delete("/favorites/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_practice_favorite(
    exercise_id: str,
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> None:
    remove_practice_favorite(db, user.id, exercise_id)


@router.get("/daily-message", response_model=DailyPracticeMessageResponse)
def get_daily_practice_message(
    locale: str = Depends(resolve_request_locale),
    db: Session = Depends(get_db),
) -> DailyPracticeMessageResponse:
    message = read_daily_practice_message(db, datetime.now().date(), locale)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily message is unavailable")
    return DailyPracticeMessageResponse.model_validate(message)


@router.post(
    "/sessions",
    response_model=PracticeSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record one completed guided-practice session",
    description=(
        "Stores one authenticated user's completed practice event for activity and duration statistics. "
        "The client_event_id makes retries idempotent, so network retries do not increment the session count twice. "
        "No recording audio or pitch curve is uploaded by this endpoint. The side effect is one practice_sessions row."
    ),
    responses={
        201: {"description": "The event was stored, or an earlier event with the same identifier was returned."},
        401: {"description": "The application session is missing, expired, or invalid."},
        422: {"description": "The event identifier, timestamps, exercise key, or duration is invalid."},
    },
)
def post_practice_session(
    request: PracticeSessionCreateRequest,
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> PracticeSessionResponse:
    session, created = record_completed_practice(db, user.id, request)
    return PracticeSessionResponse(id=session.id, created=created)


@router.get(
    "/statistics",
    response_model=PracticeStatisticsResponse,
    summary="Read the authenticated user's real practice statistics",
    description=(
        "Returns today's totals, all-time totals, the latest 20 weeks of daily activity, and today's exercise "
        "breakdown. Dates are calculated using the supplied browser/phone timezone offset. This endpoint is "
        "read-only and returns metadata only; recordings and pitch curves are never included."
    ),
    responses={
        200: {"description": "Statistics were aggregated for the current authenticated user."},
        401: {"description": "The application session is missing, expired, or invalid."},
        422: {"description": "The timezone offset is outside the supported UTC-14 to UTC+14 range."},
    },
)
def get_practice_statistics(
    timezone_offset_minutes: int = Query(
        default=0,
        ge=MINIMUM_TIMEZONE_OFFSET_MINUTES,
        le=MAXIMUM_TIMEZONE_OFFSET_MINUTES,
    ),
    locale: str = Depends(resolve_request_locale),
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> PracticeStatisticsResponse:
    return read_practice_statistics(db, user.id, timezone_offset_minutes, locale)
