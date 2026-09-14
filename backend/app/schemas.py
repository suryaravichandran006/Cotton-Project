"""Pydantic API schemas (the contract consumed by web and future mobile clients)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ConfidenceLevel = Literal["high", "medium", "low", "unknown"]


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
    request_id: str | None = None


class VarietyInfo(BaseModel):
    class_name: str
    display_name: str
    scientific_name: str | None = None
    designation: str | None = None
    region: str | None = None
    staple_category: str | None = None
    staple_length_mm: float | None = None
    micronaire: float | None = None
    strength_g_tex: float | None = None
    description: str | None = None
    source: str | None = None
    characteristics: list[str] = Field(default_factory=list)
    notes: str | None = None
    demo_placeholder: bool = False
    has_info: bool = True


class ModelBrief(BaseModel):
    name: str
    version: str
    architecture: str
    device: str
    is_mock: bool


class PredictionCore(BaseModel):
    class_name: str
    display_name: str
    confidence: float = Field(description="Calibrated confidence (temperature-scaled softmax)")
    raw_probability: float = Field(description="Raw softmax probability before calibration")
    confidence_level: ConfidenceLevel
    is_unknown: bool
    unknown_reason: str | None = None


class TopPredictionItem(BaseModel):
    rank: int
    class_name: str
    display_name: str
    calibrated_confidence: float
    raw_probability: float


class ExplanationInfo(BaseModel):
    requested: bool
    available: bool
    gradcam_url: str | None = None
    error: str | None = None
    note: str | None = None


class ProcessingInfo(BaseModel):
    preprocess_ms: float
    inference_ms: float
    explainability_ms: float
    total_ms: float
    device: str


class ImageInfo(BaseModel):
    url: str
    original_filename: str | None = None
    width: int | None = None
    height: int | None = None
    size_bytes: int | None = None
    format: str | None = None


class OODInfo(BaseModel):
    strategy: str
    scores: dict[str, float] = Field(default_factory=dict)


class PredictionResponse(BaseModel):
    id: str
    status: Literal["success"] = "success"
    is_mock: bool
    created_at: datetime
    model: ModelBrief
    prediction: PredictionCore
    top_predictions: list[TopPredictionItem]
    explanation: ExplanationInfo
    processing: ProcessingInfo
    image: ImageInfo
    variety: VarietyInfo | None = None
    ood: OODInfo
    warnings: list[str] = Field(default_factory=list)
    client_metadata: dict[str, Any] | None = None


class BatchItemResult(BaseModel):
    index: int
    filename: str | None
    status: Literal["success", "error"]
    result: PredictionResponse | None = None
    error: ErrorBody | None = None


class BatchPredictionResponse(BaseModel):
    count: int
    succeeded: int
    failed: int
    items: list[BatchItemResult]


class PredictionSummary(BaseModel):
    id: str
    created_at: datetime
    predicted_class: str
    display_name: str
    confidence: float
    confidence_level: ConfidenceLevel
    is_unknown: bool
    is_mock: bool
    model_name: str
    model_version: str
    total_ms: float | None
    image_url: str
    gradcam_url: str | None


class PaginatedPredictions(BaseModel):
    items: list[PredictionSummary]
    total: int
    page: int
    page_size: int
    pages: int


class DeleteResponse(BaseModel):
    id: str
    deleted: bool


class ClassInfo(BaseModel):
    index: int
    class_name: str
    display_name: str
    variety: VarietyInfo | None = None


class ClassesResponse(BaseModel):
    num_classes: int
    source: Literal["registry", "mock_config", "fallback_config"]
    is_mock: bool
    classes: list[ClassInfo]


class ActiveModelResponse(BaseModel):
    mode: Literal["mock", "trained"]
    status: Literal["ready", "error", "loading"]
    is_mock: bool
    model_name: str | None
    model_version: str | None
    architecture: str | None
    device: str | None
    num_classes: int | None
    class_names: list[str]
    image_size: int | None
    calibration_temperature: float | None
    ood: dict[str, Any] | None
    num_parameters: int | None = None
    registry_entry: dict[str, Any] | None = None
    error: str | None = None
    message: str


class RegistryModel(BaseModel):
    name: str
    version: str
    architecture: str
    checkpoint: str
    class_names: list[str]
    image_size: int
    calibration_temperature: float | None
    ood: dict[str, Any]
    metrics: dict[str, Any]
    trained_at: str | None
    registered_at: str | None
    git_commit: str | None
    description: str
    size_mb: float | None
    is_active: bool
    checkpoint_exists: bool


class ModelsResponse(BaseModel):
    registry_path: str
    active_model: str | None
    mode: Literal["mock", "trained"]
    models: list[RegistryModel]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    version: str
    environment: str
    mode: Literal["mock", "trained"]
    model_status: str
    database: Literal["ok", "error"]
    timestamp: datetime


class SystemInfoResponse(BaseModel):
    app: str
    version: str
    environment: str
    python_version: str
    platform: str
    torch_version: str | None
    cuda_available: bool | None
    mps_available: bool | None
    device: str | None
    mode: Literal["mock", "trained"]
    model_status: str
    max_upload_mb: float
    supported_formats: list[str]
    database_backend: str
    storage_backend: str
    uptime_seconds: float


class TimeBucket(BaseModel):
    date: str
    count: int
    unknown_count: int


class ClassCount(BaseModel):
    class_name: str
    display_name: str
    count: int


class ConfidenceBin(BaseModel):
    bin_start: float
    bin_end: float
    count: int


class StatisticsResponse(BaseModel):
    total_predictions: int
    mock_predictions: int
    real_predictions: int
    unknown_count: int
    unknown_percentage: float
    mean_confidence: float | None
    mean_latency_ms: float | None
    mean_inference_ms: float | None
    predictions_over_time: list[TimeBucket]
    class_distribution: list[ClassCount]
    confidence_distribution: list[ConfidenceBin]
    confidence_levels: dict[str, int]
    models_used: dict[str, int]
    first_prediction_at: datetime | None
    last_prediction_at: datetime | None
