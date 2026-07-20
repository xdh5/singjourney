from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import get_settings
from app.core.release import get_release_manifest, get_server_version
from app.db.session import engine


settings = get_settings()
server_version = get_server_version()


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=settings.app_name,
    version=server_version,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Share-Delete-Token"],
)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health/live", tags=["health"])
def health_live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def health_ready() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.get(
    "/version",
    tags=["version"],
    summary="Get the deployed Server API version",
    description=(
        "Returns the independently released Server API version and its API major version. "
        "Clients may include this information in diagnostics; this endpoint exposes no secrets."
    ),
    responses={200: {"description": "Current server and API version information."}},
)
def read_version() -> dict[str, str | int]:
    """Expose immutable release metadata for diagnostics and compatibility checks."""

    release_manifest = get_release_manifest()
    return {
        "serverVersion": server_version,
        "apiMajor": release_manifest["apiCompatibility"]["currentMajor"],
    }
