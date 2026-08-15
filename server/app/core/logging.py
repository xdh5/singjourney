import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any


class JsonLogFormatter(logging.Formatter):
    """Serialize server and client telemetry records as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname.lower(),
            "service": "singjourney-api",
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("request_data", "event_data"):
            value = getattr(record, key, None)
            if isinstance(value, dict):
                payload.update(value)
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)


def configure_structured_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").disabled = True
