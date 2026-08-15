from functools import lru_cache
from pathlib import Path
import tomllib

_MODULE_PATH = Path(__file__).resolve()
_PYPROJECT_CANDIDATES = (
    _MODULE_PATH.parents[2] / "pyproject.toml",
    _MODULE_PATH.parents[3] / "server" / "pyproject.toml",
)
API_MAJOR = 1


@lru_cache
def get_server_version() -> str:
    """Read the Server version managed by Release Please."""
    for candidate in _PYPROJECT_CANDIDATES:
        if candidate.is_file():
            project = tomllib.loads(candidate.read_text(encoding="utf-8"))["project"]
            return str(project["version"])
    searched = ", ".join(str(path) for path in _PYPROJECT_CANDIDATES)
    raise RuntimeError(f"pyproject.toml not found; searched: {searched}")


def get_api_major() -> int:
    return API_MAJOR
