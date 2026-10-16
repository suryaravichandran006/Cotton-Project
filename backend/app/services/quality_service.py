"""Load immutable quality artifacts and persist complete prediction snapshots."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.config import REPO_ROOT, Settings
from backend.app.db_models import QualityAnalysis
from backend.app.errors import APIError
from backend.app.quality_schemas import QualityHistory, QualityResponse, QualityStatus, QualitySummary
from backend.app.services.storage import StorageBackend
from backend.app.services.validation import ValidatedImage
from ml.quality.data import fingerprint, read_labels

logger = logging.getLogger("backend.quality")


class QualityService:
    def __init__(self, settings: Settings, storage: StorageBackend):
        self.settings = settings
        self.storage = storage
        self.predictor = None
        self.error = None
        self._signature = None
        self._lock = threading.Lock()

    @property
    def active_path(self) -> Path:
        path = Path(self.settings.quality_model_path)
        return path if path.is_absolute() else REPO_ROOT / path

    def _load(self):
        path = self.active_path
        signature = path.read_bytes() if path.is_file() else None
        if signature == self._signature:
            return
        self._signature, self.predictor, self.error = signature, None, None
        if signature is None:
            return
        try:
            from ml.quality.predictor import QualityPredictor

            self.predictor = QualityPredictor(path)
        except Exception:
            self.error = "The cotton-quality model could not be verified. Rebuild or reactivate its artifact."
            logger.exception("quality_model_load_failed")

    def status(self) -> QualityStatus:
        with self._lock:
            self._load()
            if self.predictor:
                return QualityStatus(**self.predictor.status())
            return QualityStatus(
                status="error" if self.error else "not_trained",
                message=self.error or "No cotton-quality model is trained yet. Prepare the lab labels and run the model comparison.",
            )

    def analyze(self, image) -> dict:
        with self._lock:
            self._load()
            if not self.predictor:
                raise APIError(503, "quality_model_unavailable", self.error or "No trained cotton-quality model is available.")
            try:
                return self.predictor.predict(image)
            except Exception as exc:
                logger.exception("quality_inference_failed")
                raise APIError(500, "quality_inference_failed", "The quality analysis failed. Retake the photograph or check the model artifact.") from exc

    def persist(self, db: Session, data: bytes, validated: ValidatedImage, result: dict, total_ms: float, base_url: str) -> QualityResponse:
        # Validate before storing anything, so incompatible results cannot create orphan uploads.
        QualityResponse(
            id="pending",
            created_at=datetime.now(timezone.utc),
            image={
                "url": "pending",
                "original_filename": validated.original_filename,
                "width": validated.width,
                "height": validated.height,
                "size_bytes": validated.size_bytes,
                "format": validated.format,
            },
            total_ms=total_ms,
            **result,
        )
        stored = self.storage.save(data, "uploads", validated.extension)
        row = QualityAnalysis(
            image_key=stored.key,
            snapshot={
                **result,
                "total_ms": total_ms,
                "image_metadata": {
                    "original_filename": validated.original_filename,
                    "width": validated.width,
                    "height": validated.height,
                    "size_bytes": validated.size_bytes,
                    "format": validated.format,
                },
            },
        )
        try:
            db.add(row)
            db.commit()
            db.refresh(row)
            return self.to_response(row, base_url)
        except SQLAlchemyError as exc:
            db.rollback()
            self.storage.delete(stored.key)
            raise APIError(500, "database_error", "Analysis could not be saved. Please retry.") from exc

    def to_response(self, row: QualityAnalysis, base_url: str) -> QualityResponse:
        snapshot = dict(row.snapshot)
        image_metadata = snapshot.pop("image_metadata")
        return QualityResponse(
            id=row.id,
            created_at=row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc),
            image={**image_metadata, "url": self.storage.public_url(row.image_key, self.settings.public_base_url or base_url)},
            **snapshot,
        )

    def get(self, db: Session, analysis_id: str) -> QualityAnalysis:
        row = db.get(QualityAnalysis, analysis_id)
        if row is None:
            raise APIError(404, "not_found", "This cotton-quality analysis does not exist.")
        return row

    def history(self, db: Session, page: int, page_size: int) -> QualityHistory:
        total = db.scalar(select(func.count()).select_from(QualityAnalysis)) or 0
        rows = db.scalars(
            select(QualityAnalysis).order_by(QualityAnalysis.created_at.desc(), QualityAnalysis.id.desc()).offset((page - 1) * page_size).limit(page_size)
        ).all()
        return QualityHistory(
            total=total,
            page=page,
            page_size=page_size,
            items=[
                QualitySummary(
                    id=row.id,
                    created_at=row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc),
                    status=row.snapshot["status"],
                    model=row.snapshot["model"]["name"],
                    original_filename=row.snapshot["image_metadata"]["original_filename"],
                )
                for row in rows
            ],
        )

    def delete(self, db: Session, analysis_id: str) -> None:
        row = self.get(db, analysis_id)
        key = row.image_key
        try:
            db.delete(row)
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise APIError(500, "database_error", "Analysis could not be deleted.") from exc
        self.storage.delete(key)

    def references(self) -> dict:
        # Immutable labels bundled with the model take precedence over later local metadata edits.
        with self._lock:
            self._load()
            labels = self.predictor.labels if self.predictor else read_labels()
            return {
                "label_status": labels["label_status"],
                "label_fingerprint": fingerprint(labels),
                "limitations": labels["limitations"],
                "lots": labels["lots"],
            }

    def lab_labels(self) -> dict:
        with self._lock:
            self._load()
            return self.predictor.labels if self.predictor else read_labels()
