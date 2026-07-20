import argparse
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.modules.media.models import AudioAsset
from app.modules.sharing.models import RecordingShare
from app.storage.local import LocalStorage
from app.storage.r2 import R2Storage

LOGGER = logging.getLogger(__name__)


def cleanup_expired_shares() -> int:
    """Delete expired share metadata and the corresponding temporary audio files."""
    settings = get_settings()
    storage = (
        R2Storage(settings)
        if settings.storage_backend == R2Storage.provider
        else LocalStorage(settings.storage_root)
    )
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        rows = db.execute(
            select(RecordingShare, AudioAsset)
            .join(AudioAsset, AudioAsset.id == RecordingShare.audio_asset_id)
            .where(RecordingShare.expires_at <= now)
        ).all()
        for share, asset in rows:
            storage.delete(asset.storage_key)
            db.delete(share)
            db.flush()
            db.delete(asset)
        db.commit()
    return len(rows)


def main() -> None:
    """Run cleanup once, or continuously when started as the cleanup worker."""
    parser = argparse.ArgumentParser(description="Remove expired temporary recording shares.")
    parser.add_argument("--watch", action="store_true", help="Repeat cleanup at the configured interval.")
    args = parser.parse_args()
    settings = get_settings()

    while True:
        removed_count = cleanup_expired_shares()
        LOGGER.info("removed %s expired shares", removed_count)
        if not args.watch:
            break
        time.sleep(settings.share_cleanup_interval_seconds)


if __name__ == "__main__":
    main()
