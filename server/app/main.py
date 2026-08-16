import logging
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_structured_logging
from app.core.release import get_api_major, get_server_version
from app.db.session import engine
from app.db.bootstrap import initialize_database


configure_structured_logging()
LOGGER = logging.getLogger("singjourney.api")
settings = get_settings()
server_version = get_server_version()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(api_router, prefix=settings.api_prefix)


@app.middleware("http")
async def log_api_request(request: Request, call_next):
    """Record bounded request metadata and server failures without query strings or bodies."""

    request_id = uuid4().hex
    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        LOGGER.exception(
            "request_failed",
            extra={"request_data": {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "duration_ms": round((perf_counter() - started_at) * 1000, 2),
            }},
        )
        raise
    if not request.url.path.startswith("/health/"):
        LOGGER.info(
            "request_completed",
            extra={"request_data": {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((perf_counter() - started_at) * 1000, 2),
            }},
        )
    response.headers["X-Request-ID"] = request_id
    return response


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

    return {
        "serverVersion": server_version,
        "apiMajor": get_api_major(),
    }
