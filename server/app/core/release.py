import json
from functools import lru_cache
from pathlib import Path
from typing import TypedDict


class ReleaseCompatibility(TypedDict):
    currentMajor: int
    minimumClientVersions: dict[str, str]


class ReleaseManifest(TypedDict):
    schemaVersion: int
    components: dict[str, str]
    apiCompatibility: ReleaseCompatibility


_MODULE_PATH = Path(__file__).resolve()
_MANIFEST_CANDIDATES = (
    _MODULE_PATH.parents[2] / "release" / "versions.json",
    _MODULE_PATH.parents[3] / "release" / "versions.json",
)


@lru_cache
def get_release_manifest() -> ReleaseManifest:
    """Load the repository-wide release manifest in local and container layouts."""

    for candidate in _MANIFEST_CANDIDATES:
        if candidate.is_file():
            return json.loads(candidate.read_text(encoding="utf-8"))
    searched = ", ".join(str(path) for path in _MANIFEST_CANDIDATES)
    raise RuntimeError(f"Release manifest not found; searched: {searched}")


def get_server_version() -> str:
    """Return the independently released Server API semantic version."""

    return get_release_manifest()["components"]["server"]
