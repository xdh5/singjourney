from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SingJourney API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./data/singjourney.db"
    public_api_base_url: str = "https://singjourney.com/api/v1"
    cors_origins: str = "https://singjourney.com,http://localhost:5173,http://localhost:3000"
    mini_program_app_id: str = ""
    mini_program_app_secret: str = ""
    auth_session_days: int = 30
    practice_asset_directory: Path = Path("/app/practice-assets")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SINGJOURNEY_",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
