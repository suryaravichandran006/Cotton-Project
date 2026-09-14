"""Read-only research configuration and experiment-report service.

The frontend consumes this through FastAPI so research content and ML lineage have
one canonical source. Metrics are loaded only from real report artifacts; missing
experiments remain pending rather than receiving placeholder values.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.app.config import REPO_ROOT

RESEARCH_CONFIG = REPO_ROOT / "config" / "research.json"
REPORTS_DIR = REPO_ROOT / "reports"


def load_research_config() -> dict[str, Any]:
    with RESEARCH_CONFIG.open(encoding="utf-8") as fh:
        return json.load(fh)


def _route_metrics(route_id: str) -> tuple[str, dict[str, float | None], str | None]:
    report_dir = REPORTS_DIR / f"transfer_{route_id}"
    candidates = [report_dir / "experiment.json", report_dir / "test_metrics.json"]
    payload: dict[str, Any] = {}
    source: Path | None = None
    for path in candidates:
        if path.is_file():
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                source = path
                break
            except (OSError, json.JSONDecodeError):
                continue
    if source is None:
        return "pending", {"macro_f1": None, "balanced_accuracy": None, "accuracy": None, "ece": None, "inference_latency_ms": None}, None

    test = payload.get("test", payload)
    calibration = payload.get("calibration", {})
    metrics = {
        "macro_f1": _number(test.get("macro_f1")),
        "balanced_accuracy": _number(test.get("balanced_accuracy")),
        "accuracy": _number(test.get("accuracy")),
        "ece": _number(calibration.get("ece_after", payload.get("ece"))),
        "inference_latency_ms": _number(payload.get("inference_latency_ms")),
    }
    return "complete", metrics, str(source.parent.relative_to(REPO_ROOT))


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def research_overview() -> dict[str, Any]:
    cfg = load_research_config()
    return {
        **cfg,
        "status": "configured",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def experiment_comparison() -> dict[str, Any]:
    cfg = load_research_config()
    routes: list[dict[str, Any]] = []
    complete: list[dict[str, Any]] = []
    for route in cfg["experiment_routes"]:
        status, metrics, report_dir = _route_metrics(route["id"])
        item = {**route, "status": status, "metrics": metrics, "report_dir": report_dir}
        routes.append(item)
        if status == "complete" and metrics["macro_f1"] is not None:
            complete.append(item)
    winner = max(complete, key=lambda item: item["metrics"]["macro_f1"])["id"] if complete else None
    status = "complete" if len(complete) == len(routes) and routes else "partial" if complete else "pending"
    return {
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "routes": routes,
        "winner": winner,
        "message": "No transfer-learning experiment reports exist yet. Metrics will populate automatically from reports/transfer_<route>/ after real training." if not complete else None,
    }
