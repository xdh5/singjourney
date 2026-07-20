from functools import lru_cache

from app.core.config import get_settings
from app.storage.r2 import R2Storage


@lru_cache
def get_object_storage() -> R2Storage:
    settings = get_settings()
    if settings.storage_backend != R2Storage.provider:
        raise RuntimeError("Direct sharing requires SHENGJI_STORAGE_BACKEND=cloudflare_r2")
    return R2Storage(settings)


__all__ = ["R2Storage", "get_object_storage"]
