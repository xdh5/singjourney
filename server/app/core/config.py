from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SingJourney API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./data/singjourney.db"
    storage_root: Path = Path("./data/media")
    storage_backend: str = "local"
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    public_api_base_url: str = "https://singjourney.com/api/v1"
    public_share_base_url: str = "https://singjourney.com"
    cors_origins: str = "https://singjourney.com,http://localhost:5173,http://localhost:3000"
    share_retention_days: int = 7
    share_cleanup_interval_seconds: int = 60 * 60
    share_upload_url_ttl_seconds: int = 15 * 60
    share_download_url_ttl_seconds: int = 5 * 60
    max_share_audio_bytes: int = 25 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SINGJOURNEY_",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
