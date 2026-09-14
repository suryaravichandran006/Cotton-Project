"""Orchestrates validate -> store -> predict -> persist -> respond, plus history and statistics."""

from __future__ import annotations

import io
import logging
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import asc, desc, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.config import Settings
from backend.app.db_models import Prediction
from backend.app.errors import APIError
from backend.app.schemas import (
    ClassCount,
    ConfidenceBin,
    ExplanationInfo,
    ImageInfo,
    ModelBrief,
    OODInfo,
    PaginatedPredictions,
    PredictionCore,
    PredictionResponse,
    PredictionSummary,
    ProcessingInfo,
    StatisticsResponse,
    TimeBucket,
    TopPredictionItem,
)
from backend.app.services.model_service import ModelService
from backend.app.services.storage import StorageBackend
from backend.app.services.validation import ValidatedImage, validate_upload
from backend.app.services.varieties import VarietyCatalog
from ml.inference import PredictionOutput

logger = logging.getLogger("backend.predict")

MOCK_NOTE = "Demo prediction — trained model not yet installed. This result is a deterministic placeholder, not a cultivar identification."
MOCK_HEATMAP_NOTE = "Demonstration heatmap derived from image texture. It is NOT a Grad-CAM explanation of a trained model."
SORTABLE = {
    "created_at": Prediction.created_at,
    "confidence": Prediction.confidence,
    "predicted_class": Prediction.predicted_class,
    "total_ms": Prediction.total_ms,
}


class PredictionService:
    def __init__(self, settings: Settings, storage: StorageBackend, models: ModelService, catalog: VarietyCatalog) -> None:
        self.settings = settings
        self.storage = storage
        self.models = models
        self.catalog = catalog

    # ------------------------------------------------------------------ predict
    def predict_bytes(
        self,
        db: Session,
        data: bytes,
        filename: str | None,
        content_type: str | None,
        top_k: int,
        explain: bool,
        base_url: str,
        client_metadata: dict[str, Any] | None = None,
    ) -> PredictionResponse:
        predictor = self.models.require()
        validated: ValidatedImage = validate_upload(data, filename, content_type, self.settings)
        top_k = max(1, min(top_k, self.settings.max_top_k))

        stored = self.storage.save(data, "uploads", validated.extension)
        try:
            output: PredictionOutput = predictor.predict(validated.image, top_k=top_k, explain=explain)
        except Exception as exc:
            self.storage.delete(stored.key)
            logger.exception("inference_failed")
            raise APIError(500, "inference_failed", f"Inference failed: {type(exc).__name__}") from exc

        gradcam_key = None
        if output.gradcam_image is not None:
            buf = io.BytesIO()
            output.gradcam_image.save(buf, format="PNG", optimize=True)
            gradcam_key = self.storage.save(buf.getvalue(), "gradcam", "png").key

        row = Prediction(
            image_key=stored.key,
            image_original_name=validated.original_filename,
            image_width=validated.width,
            image_height=validated.height,
            image_size_bytes=validated.size_bytes,
            image_format=validated.format,
            model_name=output.model_name,
            model_version=output.model_version,
            architecture=output.architecture,
            is_mock=output.is_mock,
            predicted_class=output.class_name,
            confidence=output.calibrated_confidence,
            raw_probability=output.raw_probability,
            confidence_level=output.confidence_level,
            is_unknown=output.is_unknown,
            unknown_reason=output.unknown_reason,
            top_predictions=[
                {"rank": i + 1, "class_name": t.class_name, "calibrated_confidence": t.calibrated_confidence, "raw_probability": t.raw_probability}
                for i, t in enumerate(output.top_predictions)
            ],
            ood_scores=output.ood_scores,
            preprocess_ms=output.timings.preprocess_ms,
            inference_ms=output.timings.inference_ms,
            explainability_ms=output.timings.explainability_ms,
            total_ms=output.timings.total_ms,
            device=output.device,
            gradcam_key=gradcam_key,
            explanation_error=output.explanation_error,
            client_metadata=client_metadata,
        )
        try:
            db.add(row)
            db.commit()
            db.refresh(row)
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception("db_write_failed")
            raise APIError(500, "database_error", "Prediction could not be saved") from exc

        logger.info(
            "prediction",
            extra={
                "prediction_id": row.id,
                "model": row.model_name,
                "class": row.predicted_class,
                "confidence": round(row.confidence, 4),
                "unknown": row.is_unknown,
                "mock": row.is_mock,
                "total_ms": round(row.total_ms or 0, 1),
            },
        )
        return self.to_response(row, base_url, explain_requested=explain)

    # ------------------------------------------------------------------ mapping
    def _url(self, key: str | None, base_url: str) -> str | None:
        if not key:
            return None
        return self.storage.public_url(key, self.settings.public_base_url or base_url)

    def to_response(self, row: Prediction, base_url: str, explain_requested: bool | None = None) -> PredictionResponse:
        requested = explain_requested if explain_requested is not None else bool(row.gradcam_key or row.explanation_error)
        warnings = [MOCK_NOTE] if row.is_mock else []
        if row.is_unknown:
            warnings.append("Confidence below the configured threshold: the image may not belong to any known variety or may be of poor quality.")
        note = None
        if row.gradcam_key:
            note = MOCK_HEATMAP_NOTE if row.is_mock else "Grad-CAM highlights fibre regions that most influenced the predicted class. Qualitative aid only."
        return PredictionResponse(
            id=row.id,
            is_mock=row.is_mock,
            created_at=row.created_at,
            model=ModelBrief(
                name=row.model_name, version=row.model_version, architecture=row.architecture or "unknown", device=row.device or "cpu", is_mock=row.is_mock
            ),
            prediction=PredictionCore(
                class_name=row.predicted_class,
                display_name=self.catalog.display_name(row.predicted_class),
                confidence=row.confidence,
                raw_probability=row.raw_probability,
                confidence_level=row.confidence_level,  # type: ignore[arg-type]
                is_unknown=row.is_unknown,
                unknown_reason=row.unknown_reason,
            ),
            top_predictions=[
                TopPredictionItem(
                    rank=t["rank"],
                    class_name=t["class_name"],
                    display_name=self.catalog.display_name(t["class_name"]),
                    calibrated_confidence=t["calibrated_confidence"],
                    raw_probability=t["raw_probability"],
                )
                for t in (row.top_predictions or [])
            ],
            explanation=ExplanationInfo(
                requested=requested, available=bool(row.gradcam_key), gradcam_url=self._url(row.gradcam_key, base_url), error=row.explanation_error, note=note
            ),
            processing=ProcessingInfo(
                preprocess_ms=row.preprocess_ms or 0.0,
                inference_ms=row.inference_ms or 0.0,
                explainability_ms=row.explainability_ms or 0.0,
                total_ms=row.total_ms or 0.0,
                device=row.device or "cpu",
            ),
            image=ImageInfo(
                url=self._url(row.image_key, base_url) or "",
                original_filename=row.image_original_name,
                width=row.image_width,
                height=row.image_height,
                size_bytes=row.image_size_bytes,
                format=row.image_format,
            ),
            variety=None if row.is_unknown else self.catalog.describe(row.predicted_class),
            ood=OODInfo(
                strategy=str((row.ood_scores or {}).get("strategy", "confidence_threshold")),
                scores={k: float(v) for k, v in (row.ood_scores or {}).items() if isinstance(v, (int, float))},
            ),
            warnings=warnings,
            client_metadata=row.client_metadata,
        )

    def to_summary(self, row: Prediction, base_url: str) -> PredictionSummary:
        return PredictionSummary(
            id=row.id,
            created_at=row.created_at,
            predicted_class=row.predicted_class,
            display_name=self.catalog.display_name(row.predicted_class),
            confidence=row.confidence,
            confidence_level=row.confidence_level,
            is_unknown=row.is_unknown,
            is_mock=row.is_mock,  # type: ignore[arg-type]
            model_name=row.model_name,
            model_version=row.model_version,
            total_ms=row.total_ms,
            image_url=self._url(row.image_key, base_url) or "",
            gradcam_url=self._url(row.gradcam_key, base_url),
        )

    # ------------------------------------------------------------------ history
    def get(self, db: Session, prediction_id: str) -> Prediction:
        row = db.get(Prediction, prediction_id)
        if row is None:
            raise APIError(404, "not_found", f"Prediction '{prediction_id}' not found")
        return row

    def list(
        self,
        db: Session,
        base_url: str,
        page: int,
        page_size: int,
        sort_by: str,
        order: str,
        class_name: str | None = None,
        is_unknown: bool | None = None,
        is_mock: bool | None = None,
        model_name: str | None = None,
        min_confidence: float | None = None,
        search: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> PaginatedPredictions:
        stmt = select(Prediction)
        if class_name:
            stmt = stmt.where(Prediction.predicted_class == class_name)
        if is_unknown is not None:
            stmt = stmt.where(Prediction.is_unknown.is_(is_unknown))
        if is_mock is not None:
            stmt = stmt.where(Prediction.is_mock.is_(is_mock))
        if model_name:
            stmt = stmt.where(Prediction.model_name == model_name)
        if min_confidence is not None:
            stmt = stmt.where(Prediction.confidence >= min_confidence)
        if search:
            like = f"%{search}%"
            stmt = stmt.where(Prediction.predicted_class.ilike(like) | Prediction.image_original_name.ilike(like))
        if date_from:
            stmt = stmt.where(Prediction.created_at >= date_from)
        if date_to:
            stmt = stmt.where(Prediction.created_at <= date_to)

        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        column = SORTABLE.get(sort_by, Prediction.created_at)
        stmt = stmt.order_by(asc(column) if order == "asc" else desc(column), desc(Prediction.created_at))
        rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
        return PaginatedPredictions(
            items=[self.to_summary(r, base_url) for r in rows], total=total, page=page, page_size=page_size, pages=max(1, math.ceil(total / page_size))
        )

    def delete(self, db: Session, prediction_id: str) -> None:
        row = self.get(db, prediction_id)
        for key in (row.image_key, row.gradcam_key):
            if key:
                self.storage.delete(key)
        db.delete(row)
        db.commit()

    # ------------------------------------------------------------------ statistics
    def statistics(self, db: Session) -> StatisticsResponse:
        rows = db.scalars(select(Prediction).order_by(Prediction.created_at)).all()
        total = len(rows)
        if total == 0:
            return StatisticsResponse(
                total_predictions=0,
                mock_predictions=0,
                real_predictions=0,
                unknown_count=0,
                unknown_percentage=0.0,
                mean_confidence=None,
                mean_latency_ms=None,
                mean_inference_ms=None,
                predictions_over_time=[],
                class_distribution=[],
                confidence_distribution=[],
                confidence_levels={},
                models_used={},
                first_prediction_at=None,
                last_prediction_at=None,
            )
        unknown = sum(1 for r in rows if r.is_unknown)
        mock = sum(1 for r in rows if r.is_mock)
        by_day: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        for r in rows:
            day = r.created_at.astimezone(timezone.utc).date().isoformat() if r.created_at.tzinfo else r.created_at.date().isoformat()
            by_day[day][0] += 1
            by_day[day][1] += int(r.is_unknown)
        class_counts = Counter(("UNKNOWN" if r.is_unknown else r.predicted_class) for r in rows)
        bins = [0] * 10
        for r in rows:
            bins[min(9, int(r.confidence * 10))] += 1
        latencies = [r.total_ms for r in rows if r.total_ms is not None]
        inference = [r.inference_ms for r in rows if r.inference_ms is not None]
        return StatisticsResponse(
            total_predictions=total,
            mock_predictions=mock,
            real_predictions=total - mock,
            unknown_count=unknown,
            unknown_percentage=round(100.0 * unknown / total, 2),
            mean_confidence=round(sum(r.confidence for r in rows) / total, 4),
            mean_latency_ms=round(sum(latencies) / len(latencies), 2) if latencies else None,
            mean_inference_ms=round(sum(inference) / len(inference), 2) if inference else None,
            predictions_over_time=[TimeBucket(date=d, count=v[0], unknown_count=v[1]) for d, v in sorted(by_day.items())],
            class_distribution=[
                ClassCount(class_name=c, display_name=("Unknown" if c == "UNKNOWN" else self.catalog.display_name(c)), count=n)
                for c, n in class_counts.most_common()
            ],
            confidence_distribution=[ConfidenceBin(bin_start=i / 10, bin_end=(i + 1) / 10, count=bins[i]) for i in range(10)],
            confidence_levels=dict(Counter(r.confidence_level for r in rows)),
            models_used=dict(Counter(f"{r.model_name}@{r.model_version}" for r in rows)),
            first_prediction_at=rows[0].created_at,
            last_prediction_at=rows[-1].created_at,
        )
