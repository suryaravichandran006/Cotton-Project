from __future__ import annotations

import asyncio
import json
from functools import partial
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.orm import Session

from backend.app.config import Settings, get_settings
from backend.app.container import base_url_of, get_prediction_service
from backend.app.database import get_db
from backend.app.dependencies import rate_limit, require_api_key
from backend.app.errors import APIError
from backend.app.schemas import BatchItemResult, BatchPredictionResponse, ErrorBody, PredictionResponse
from backend.app.services.prediction_service import PredictionService

router = APIRouter(dependencies=[Depends(rate_limit), Depends(require_api_key)])


async def _read_limited(upload: UploadFile, limit: int) -> bytes:
    """Read at most ``limit + 1`` bytes so oversize files are rejected without buffering everything."""
    data = await upload.read(limit + 1)
    await upload.close()
    return data


def _parse_metadata(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise APIError(400, "invalid_metadata", "client_metadata must be a JSON object") from exc
    if not isinstance(parsed, dict):
        raise APIError(400, "invalid_metadata", "client_metadata must be a JSON object")
    return {k: v for k, v in parsed.items() if isinstance(k, str)} or None


async def _run_with_timeout(fn, timeout_s: float):
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(loop.run_in_executor(None, fn), timeout=timeout_s)
    except asyncio.TimeoutError as exc:
        raise APIError(504, "inference_timeout", f"Inference did not finish within {timeout_s:g}s") from exc


@router.post(
    "",
    response_model=PredictionResponse,
    summary="Classify one cotton fibre image",
    responses={
        400: {"description": "Corrupt / invalid image"},
        413: {"description": "File too large"},
        415: {"description": "Unsupported format"},
        503: {"description": "No model loaded"},
    },
)
async def predict(
    request: Request,
    file: UploadFile = File(..., description="JPEG, PNG or WEBP photograph of raw/ginned cotton fibre"),
    explain: bool = Query(False, description="Generate a Grad-CAM heatmap (adds latency)"),
    top_k: int | None = Query(None, ge=1, le=10, description="Number of ranked classes to return"),
    client_metadata: str | None = Form(None, description="Optional JSON object (device, app version, location label ...)"),
    db: Session = Depends(get_db),
    service: PredictionService = Depends(get_prediction_service),
    settings: Settings = Depends(get_settings),
) -> PredictionResponse:
    data = await _read_limited(file, settings.max_upload_bytes)
    meta = _parse_metadata(client_metadata)
    fn = partial(service.predict_bytes, db, data, file.filename, file.content_type, top_k or settings.default_top_k, explain, base_url_of(request), meta)
    return await _run_with_timeout(fn, settings.inference_timeout_s)


@router.post("/batch", response_model=BatchPredictionResponse, summary="Classify several images in one request")
async def predict_batch(
    request: Request,
    files: list[UploadFile] = File(..., description="Up to MAX_BATCH_SIZE images"),
    explain: bool = Query(False),
    top_k: int | None = Query(None, ge=1, le=10),
    db: Session = Depends(get_db),
    service: PredictionService = Depends(get_prediction_service),
    settings: Settings = Depends(get_settings),
) -> BatchPredictionResponse:
    if not files:
        raise APIError(400, "empty_batch", "Provide at least one file")
    if len(files) > settings.max_batch_size:
        raise APIError(400, "batch_too_large", f"At most {settings.max_batch_size} images per batch", {"max_batch_size": settings.max_batch_size})
    items: list[BatchItemResult] = []
    base_url = base_url_of(request)
    for i, upload in enumerate(files):
        data = await _read_limited(upload, settings.max_upload_bytes)
        try:
            fn = partial(service.predict_bytes, db, data, upload.filename, upload.content_type, top_k or settings.default_top_k, explain, base_url, None)
            result = await _run_with_timeout(fn, settings.inference_timeout_s)
            items.append(BatchItemResult(index=i, filename=upload.filename, status="success", result=result))
        except APIError as exc:
            items.append(BatchItemResult(index=i, filename=upload.filename, status="error", error=ErrorBody(**exc.body())))
    ok = sum(1 for it in items if it.status == "success")
    return BatchPredictionResponse(count=len(items), succeeded=ok, failed=len(items) - ok, items=items)
