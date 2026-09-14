from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.container import get_prediction_service
from backend.app.database import get_db
from backend.app.schemas import StatisticsResponse
from backend.app.services.prediction_service import PredictionService

router = APIRouter()


@router.get("", response_model=StatisticsResponse, summary="Aggregate statistics over stored predictions")
def statistics(db: Session = Depends(get_db), service: PredictionService = Depends(get_prediction_service)) -> StatisticsResponse:
    return service.statistics(db)
