import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.media.formats import audio_format_for_mime
from app.modules.media.models import AudioAsset
from app.modules.sharing.constants import (
    SHARE_ASSET_PURPOSE,
    SHARE_AUDIO_CACHE_CONTROL,
    UPLOAD_STATUS_PENDING,
    UPLOAD_STATUS_READY,
)
from app.modules.sharing.models import RecordingShare
from app.modules.sharing.schemas import (
    PitchPoint,
    ShareCreateRequest,
    ShareActivated,
    SharePublic,
    ShareUploadIntent,
)
from app.storage.base import DirectObjectStorage


class InvalidUploadedObjectError(ValueError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def initiate_share(
    db: Session,
    storage: DirectObjectStorage,
    settings: Settings,
    request: ShareCreateRequest,
) -> ShareUploadIntent:
    """Reserve metadata and issue a narrow, short-lived URL for one direct R2 upload."""
    expires_at = utc_now() + timedelta(days=settings.share_retention_days)
    storage_key = storage.create_key(request.audio.filename, request.audio.mime_type)
    audio_format = audio_format_for_mime(request.audio.mime_type)
    delete_token = secrets.token_urlsafe(32)
    asset = AudioAsset(
        purpose=SHARE_ASSET_PURPOSE,
        storage_provider=storage.provider,
        storage_key=storage_key,
        upload_status=UPLOAD_STATUS_PENDING,
        original_name=request.audio.filename,
        mime_type=request.audio.mime_type,
        container=audio_format.container if audio_format else None,
        codec=audio_format.codec if audio_format else None,
        byte_size=request.audio.byte_size,
        duration_seconds=request.duration_seconds,
        sample_rate=None,
        channels=1,
        sha256=None,
        expires_at=expires_at,
    )
    db.add(asset)
    db.flush()
    share = RecordingShare(
        audio_asset_id=asset.id,
        title=request.title.strip(),
        duration_seconds=request.duration_seconds,
        curve_data=[point.model_dump() for point in request.curve],
        delete_token_hash=_hash_token(delete_token),
        expires_at=expires_at,
    )
    db.add(share)
    db.flush()
    upload_url = storage.create_upload_url(storage_key, request.audio.mime_type)
    db.commit()
    db.refresh(share)
    return ShareUploadIntent(
        id=share.public_id,
        expires_at=share.expires_at,
        upload_url=upload_url,
        upload_headers={
            "Content-Type": request.audio.mime_type,
            "Cache-Control": SHARE_AUDIO_CACHE_CONTROL,
        },
        complete_url=f"{settings.public_api_base_url.rstrip('/')}/shares/{share.public_id}/complete",
        delete_token=delete_token,
    )


def complete_share(
    db: Session,
    storage: DirectObjectStorage,
    settings: Settings,
    public_id: str,
) -> ShareActivated | None:
    """Verify the direct upload in R2 before making its share metadata readable."""
    row = _get_share_audio(db, public_id, include_pending=True)
    if not row:
        return None
    share, asset = row
    if asset.upload_status == UPLOAD_STATUS_READY:
        return _created_response(settings, share)
    metadata = storage.stat(asset.storage_key)
    if not metadata or metadata.byte_size != asset.byte_size or metadata.content_type != asset.mime_type:
        if metadata:
            storage.delete(asset.storage_key)
        raise InvalidUploadedObjectError("Uploaded object does not match its declared metadata")
    asset.upload_status = UPLOAD_STATUS_READY
    db.commit()
    return _created_response(settings, share)


def get_share(
    db: Session,
    storage: DirectObjectStorage,
    public_id: str,
) -> SharePublic | None:
    row = _get_share_audio(db, public_id)
    if not row:
        return None
    share, asset = row
    share.view_count += 1
    db.commit()
    return SharePublic(
        id=share.public_id,
        title=share.title,
        duration_seconds=share.duration_seconds,
        curve_version=share.curve_version,
        curve=[PitchPoint.model_validate(point) for point in share.curve_data],
        created_at=share.created_at,
        expires_at=share.expires_at,
        audio_url=storage.create_download_url(asset.storage_key),
    )


def get_share_audio(db: Session, public_id: str) -> tuple[RecordingShare, AudioAsset] | None:
    return _get_share_audio(db, public_id)


def delete_share(
    db: Session,
    storage: DirectObjectStorage,
    public_id: str,
    delete_token: str,
) -> bool:
    row = _get_share_audio(db, public_id, include_pending=True)
    if not row:
        return False
    share, asset = row
    if not secrets.compare_digest(share.delete_token_hash, _hash_token(delete_token)):
        return False
    storage.delete(asset.storage_key)
    db.delete(share)
    db.flush()
    db.delete(asset)
    db.commit()
    return True


def _get_share_audio(
    db: Session,
    public_id: str,
    *,
    include_pending: bool = False,
) -> tuple[RecordingShare, AudioAsset] | None:
    statement = (
        select(RecordingShare, AudioAsset)
        .join(AudioAsset, AudioAsset.id == RecordingShare.audio_asset_id)
        .where(RecordingShare.public_id == public_id)
    )
    if not include_pending:
        statement = statement.where(AudioAsset.upload_status == UPLOAD_STATUS_READY)
    row = db.execute(statement).one_or_none()
    if not row or _is_expired(row[0].expires_at):
        return None
    return row[0], row[1]


def _created_response(settings: Settings, share: RecordingShare) -> ShareActivated:
    return ShareActivated(
        id=share.public_id,
        title=share.title,
        duration_seconds=share.duration_seconds,
        expires_at=share.expires_at,
        share_url=f"{settings.public_share_base_url.rstrip('/')}/share?id={share.public_id}",
        audio_url=_audio_url(settings, share.public_id),
    )


def _audio_url(settings: Settings, public_id: str) -> str:
    return f"{settings.public_api_base_url.rstrip('/')}/shares/{public_id}/audio"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _is_expired(value: datetime) -> bool:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= utc_now()
