from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from app.modules.telemetry.constants import (
    TELEMETRY_RATE_LIMIT_CACHE_ENTRIES,
    TELEMETRY_RATE_LIMIT_REQUESTS_PER_CLIENT,
    TELEMETRY_RATE_LIMIT_WINDOW_SECONDS,
)

_requests: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def accept_telemetry_request(client_key: str) -> bool:
    """Bound public ingestion cost using a small in-process per-client window."""

    now = monotonic()
    cutoff = now - TELEMETRY_RATE_LIMIT_WINDOW_SECONDS
    with _lock:
        history = _requests[client_key]
        while history and history[0] <= cutoff:
            history.popleft()
        if len(history) >= TELEMETRY_RATE_LIMIT_REQUESTS_PER_CLIENT:
            return False
        history.append(now)
        if len(_requests) > TELEMETRY_RATE_LIMIT_CACHE_ENTRIES:
            stale_keys = [key for key, entries in _requests.items() if not entries or entries[-1] <= cutoff]
            for key in stale_keys:
                _requests.pop(key, None)
        return True
