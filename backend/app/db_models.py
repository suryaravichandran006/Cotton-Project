"""ORM models. Images are stored on disk/object storage; the DB holds keys only."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False, index=True)

    image_key: Mapped[str] = mapped_column(String(255), nullable=False)
    image_original_name: Mapped[str | None] = mapped_column(String(255))
    image_width: Mapped[int | None] = mapped_column(Integer)
    image_height: Mapped[int | None] = mapped_column(Integer)
    image_size_bytes: Mapped[int | None] = mapped_column(Integer)
    image_format: Mapped[str | None] = mapped_column(String(16))

    model_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    architecture: Mapped[str | None] = mapped_column(String(64))
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    predicted_class: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    raw_probability: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_level: Mapped[str] = mapped_column(String(16), nullable=False)
    is_unknown: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    unknown_reason: Mapped[str | None] = mapped_column(Text)
    top_predictions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    ood_scores: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    preprocess_ms: Mapped[float | None] = mapped_column(Float)
    inference_ms: Mapped[float | None] = mapped_column(Float)
    explainability_ms: Mapped[float | None] = mapped_column(Float)
    total_ms: Mapped[float | None] = mapped_column(Float)
    device: Mapped[str | None] = mapped_column(String(16))

    gradcam_key: Mapped[str | None] = mapped_column(String(255))
    explanation_error: Mapped[str | None] = mapped_column(Text)
    client_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    __table_args__ = (Index("ix_predictions_created_class", "created_at", "predicted_class"),)
