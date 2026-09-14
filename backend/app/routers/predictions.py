from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from backend.app.container import base_url_of, get_prediction_service
from backend.app.database import get_db
from backend.app.dependencies import require_api_key
from backend.app.schemas import DeleteResponse, PaginatedPredictions, PredictionResponse
from backend.app.services.prediction_service import PredictionService

router = APIRouter()


@router.get("", response_model=PaginatedPredictions, summary="Paginated prediction history")
def list_predictions(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: Literal["created_at", "confidence", "predicted_class", "total_ms"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    class_name: str | None = None,
    is_unknown: bool | None = None,
    is_mock: bool | None = None,
    model_name: str | None = None,
    min_confidence: float | None = Query(None, ge=0, le=1),
    search: str | None = Query(None, max_length=100),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    service: PredictionService = Depends(get_prediction_service),
) -> PaginatedPredictions:
    return service.list(
        db, base_url_of(request), page, page_size, sort_by, order, class_name, is_unknown, is_mock, model_name, min_confidence, search, date_from, date_to
    )


@router.get("/{prediction_id}", response_model=PredictionResponse, summary="Full prediction record")
def get_prediction(
    prediction_id: str, request: Request, db: Session = Depends(get_db), service: PredictionService = Depends(get_prediction_service)
) -> PredictionResponse:
    return service.to_response(service.get(db, prediction_id), base_url_of(request))


@router.delete("/{prediction_id}", response_model=DeleteResponse, summary="Delete a prediction and its files", dependencies=[Depends(require_api_key)])
def delete_prediction(prediction_id: str, db: Session = Depends(get_db), service: PredictionService = Depends(get_prediction_service)) -> DeleteResponse:
    service.delete(db, prediction_id)
    return DeleteResponse(id=prediction_id, deleted=True)
