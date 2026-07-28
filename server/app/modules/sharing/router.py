import json

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.modules.media.formats import audio_format_for_mime
from app.modules.sharing.constants import (
    MAX_CURVE_JSON_BYTES,
    MAX_CURVE_POINTS,
    MIN_DELETE_TOKEN_LENGTH,
    SHARE_AUDIO_REDIRECT_CACHE_CONTROL,
)
from app.modules.sharing.schemas import ShareActivated, ShareCreateRequest, SharePublic, ShareUploadIntent
from app.modules.sharing.service import (
    InvalidUploadedObjectError,
    complete_share,
    delete_share,
    get_share,
    get_share_audio,
    initiate_share,
    is_share_pending,
)
from app.storage import get_object_storage
from app.storage.r2 import R2ConfigurationError, R2Storage

router = APIRouter(prefix="/shares", tags=["shares"])


def require_object_storage() -> R2Storage:
    """Return configured R2 storage without exposing credentials to API callers."""
    try:
        return get_object_storage()
    except (RuntimeError, R2ConfigurationError) as error:
        raise HTTPException(status_code=503, detail="Sharing storage is not configured") from error


@router.post(
    "",
    response_model=ShareUploadIntent,
    status_code=status.HTTP_201_CREATED,
    summary="Create a direct-upload intent for an expiring recording share",
    description=(
        "Validates share metadata, optionally accepts a client-generated opaque public UUID, "
        "reserves a private R2 object key, and returns a short-lived PUT URL. Accepting the UUID "
        "lets a mini-program share card point at the recording before its click-triggered upload "
        "finishes. The audio bytes go directly from the client to R2 and never traverse this API. "
        "Call the completion endpoint after PUT succeeds; pending shares return HTTP 425."
    ),
    responses={
        201: {"description": "Upload intent created; the R2 credential is limited to one PUT."},
        413: {"description": "Declared audio size or curve data exceeds configured limits."},
        415: {"description": "The declared MIME type is not a supported audio format."},
        422: {"description": "Metadata is invalid or the recording exceeds 10 minutes."},
        503: {"description": "R2 credentials or bucket configuration are unavailable."},
    },
)
def post_share(
    request: ShareCreateRequest,
    db: Session = Depends(get_db),
    storage: R2Storage = Depends(require_object_storage),
    settings: Settings = Depends(get_settings),
) -> ShareUploadIntent:
    if request.audio.byte_size > settings.max_share_audio_bytes:
        raise HTTPException(status_code=413, detail="Audio file is too large")
    if audio_format_for_mime(request.audio.mime_type) is None:
        raise HTTPException(status_code=415, detail="Unsupported audio MIME type")
    if len(request.curve) > MAX_CURVE_POINTS:
        raise HTTPException(status_code=413, detail="Curve contains too many points")
    curve_size = len(
        json.dumps(
            [point.model_dump() for point in request.curve],
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
    )
    if curve_size > MAX_CURVE_JSON_BYTES:
        raise HTTPException(status_code=413, detail="Curve data is too large")
    return initiate_share(db, storage, settings, request)


@router.post(
    "/{public_id}/complete",
    response_model=ShareActivated,
    summary="Verify a direct R2 upload and activate its share",
    description=(
        "Checks the private R2 object's size and signed Content-Type against the reserved metadata. "
        "Only a verified object transitions from pending to readable. Repeated completion is idempotent."
    ),
    responses={
        404: {"description": "The pending share does not exist or has expired."},
        422: {"description": "The object is absent or does not match its declared metadata."},
    },
)
def finish_share(
    public_id: str,
    db: Session = Depends(get_db),
    storage: R2Storage = Depends(require_object_storage),
    settings: Settings = Depends(get_settings),
) -> ShareActivated:
    try:
        result = complete_share(db, storage, settings, public_id)
    except InvalidUploadedObjectError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if not result:
        raise HTTPException(status_code=404, detail="Pending share not found or expired")
    return result


@router.get(
    "/{public_id}",
    response_model=SharePublic,
    summary="Read a public recording share",
    description="Returns curve metadata for a verified, unexpired share and increments its view count.",
    responses={
        200: {"description": "Verified share metadata and a short-lived direct R2 playback URL."},
        404: {"description": "The share does not exist or has expired."},
        425: {"description": "The sender is still uploading or activating this share."},
    },
)
def read_share(
    public_id: str,
    db: Session = Depends(get_db),
    storage: R2Storage = Depends(require_object_storage),
) -> SharePublic:
    share = get_share(db, storage, public_id)
    if not share:
        if is_share_pending(db, public_id):
            raise HTTPException(status_code=425, detail="Share upload is still being activated")
        raise HTTPException(status_code=404, detail="Share not found or expired")
    return share


@router.get(
    "/{public_id}/audio",
    summary="Redirect to a short-lived private R2 audio URL",
    description=(
        "Validates share expiry, signs one short-lived GET operation, and redirects the caller to R2. "
        "The API does not proxy audio bytes, so playback does not consume ECS outbound bandwidth."
    ),
    responses={404: {"description": "The share expired or its verified audio asset is unavailable."}},
)
def read_share_audio(
    public_id: str,
    db: Session = Depends(get_db),
    storage: R2Storage = Depends(require_object_storage),
) -> RedirectResponse:
    row = get_share_audio(db, public_id)
    if not row:
        raise HTTPException(status_code=404, detail="Share not found or expired")
    _, asset = row
    return RedirectResponse(
        storage.create_download_url(asset.storage_key),
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        headers={"Cache-Control": SHARE_AUDIO_REDIRECT_CACHE_CONTROL},
    )


@router.delete(
    "/{public_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a recording share",
    description=(
        "Deletes the private R2 object and metadata early. The caller must provide the one-time "
        "delete token returned with the upload intent. Failed authorization has no side effects."
    ),
    responses={403: {"description": "The share or delete credential is invalid."}},
)
def remove_share(
    public_id: str,
    x_share_delete_token: str = Header(min_length=MIN_DELETE_TOKEN_LENGTH),
    db: Session = Depends(get_db),
    storage: R2Storage = Depends(require_object_storage),
) -> Response:
    if not delete_share(db, storage, public_id, x_share_delete_token):
        raise HTTPException(status_code=403, detail="Share cannot be deleted")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
