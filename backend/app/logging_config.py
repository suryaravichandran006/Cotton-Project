"""Structured logging (plain text in dev, JSON when LOG_JSON=true)."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

RESERVED = set(vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys()) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for k, v in record.__dict__.items():
            if k not in RESERVED and not k.startswith("_"):
                payload[k] = v
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class KeyValueFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        extras = " ".join(f"{k}={v}" for k, v in record.__dict__.items() if k not in RESERVED and not k.startswith("_"))
        return f"{base} {extras}".rstrip()


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if json_logs else KeyValueFormatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    for noisy in ("uvicorn.access", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
