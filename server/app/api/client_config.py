from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, HttpUrl

from app.core.config import Settings, get_settings
from app.core.release import get_release_manifest, get_server_version


router = APIRouter(tags=["client-config"])


class ClientRuntimeConfig(BaseModel):
    """Public, non-secret endpoints that a released client may update at runtime."""

    version: int = Field(description="Monotonic configuration version used for cache replacement.")
    region: str = Field(description="Logical deployment region assigned to this response.")
    api_base_url: HttpUrl = Field(description="Base URL for versioned API requests.")
    share_base_url: HttpUrl = Field(description="Base URL used when creating new public share links.")
    media_base_url: HttpUrl = Field(description="Base URL for audio and accompaniment delivery.")
    cache_ttl_seconds: int = Field(description="Maximum client-side cache lifetime for this response.")
    server_version: str = Field(description="Semantic version of the deployed Server API.")
    api_major: int = Field(description="Current major API contract version.")
    minimum_client_versions: dict[str, str] = Field(
        description="Oldest supported client version for each released platform."
    )


@router.get(
    "/client-config",
    response_model=ClientRuntimeConfig,
    summary="Get client runtime endpoints",
    description=(
        "Returns public endpoint configuration for Web, WeChat, iOS, and Android clients. "
        "The response contains no credentials. Clients cache it and fall back to their bundled "
        "configuration when this endpoint is unavailable. Changing these settings affects new "
        "requests and newly created share links; already copied share URLs remain unchanged."
    ),
    responses={200: {"description": "Current public endpoints and cache policy."}},
)
def read_client_config(settings: Settings = Depends(get_settings)) -> ClientRuntimeConfig:
    """Expose centrally managed endpoints without requiring an application release."""

    release_manifest = get_release_manifest()
    compatibility = release_manifest["apiCompatibility"]
    return ClientRuntimeConfig(
        version=settings.client_config_version,
        region=settings.deployment_region,
        api_base_url=settings.public_api_base_url,
        share_base_url=settings.public_share_base_url,
        media_base_url=settings.public_media_base_url,
        cache_ttl_seconds=settings.client_config_ttl_seconds,
        server_version=get_server_version(),
        api_major=compatibility["currentMajor"],
        minimum_client_versions=compatibility["minimumClientVersions"],
    )
