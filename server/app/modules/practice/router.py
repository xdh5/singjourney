from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
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
)
from app.modules.practice.service import record_completed_practice, read_practice_statistics

router = APIRouter(prefix="/practice", tags=["practice"])


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
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> PracticeStatisticsResponse:
    return read_practice_statistics(db, user.id, timezone_offset_minutes)
