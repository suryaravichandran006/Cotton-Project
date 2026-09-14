from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app import __version__
from backend.app.container import Services, get_services
from backend.app.database import get_db
from backend.app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Liveness / readiness")
def health(db: Session = Depends(get_db), services: Services = Depends(get_services)) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"
    model_status = services.models.status
    return HealthResponse(
        status="ok" if db_status == "ok" and model_status == "ready" else "degraded",
        app=services.settings.app_name,
        version=__version__,
        environment=services.settings.app_env,
        mode=services.settings.model_mode,
        model_status=model_status,
        database=db_status,  # type: ignore[arg-type]
        timestamp=datetime.now(timezone.utc),
    )
