"""Quality API contract; estimates and recorded reference values are explicitly separate."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from backend.app.schemas import ImageInfo


class QualityModel(BaseModel):
    name: str
    version: str
    experimental: Literal[True]
    label_status: str
    independent_lots: int


class QualityProperty(BaseModel):
    key: str
    label: str
    code: str
    unit: str | None
    decimals: int
    value: float | str | None
    status: Literal["experimental_estimate", "withheld", "not_available", "not_validated"]
    observed_mae: float | None
    beats_mean_baseline: bool
    note: str


class CaptureInfo(BaseModel):
    passed: bool
    brightness: float
    focus_score: float
    reasons: list[str]
    scope: str


class LabReference(BaseModel):
    lot_id: str
    report_page: int
    report_date: str
    test_count: int
    average: dict[str, float | str]
    reported_stddev: dict[str, float]
    grade: str | None = None


class VisualReference(BaseModel):
    lot_id: str
    cosine_distance: float
    identity_verified: Literal[False]
    method: str = "cosine_centroid"
    matcher_name: str = "Cosine lot centroid"
    note: str
    report: LabReference


class QualityResponse(BaseModel):
    id: str
    created_at: datetime
    status: Literal["experimental", "withheld"]
    withheld_reason: str | None
    model: QualityModel
    properties: list[QualityProperty]
    capture: CaptureInfo
    reference: VisualReference | None
    warnings: list[str]
    label_fingerprint: str
    image: ImageInfo
    total_ms: float


class QualitySummary(BaseModel):
    id: str
    created_at: datetime
    status: Literal["experimental", "withheld"]
    model: str
    original_filename: str | None


class QualityHistory(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[QualitySummary]


class QualityStatus(BaseModel):
    status: Literal["ready", "not_trained", "error"]
    experimental: Literal[True] = True
    model: str | None = None
    version: str | None = None
    label_status: str = "provisional_lot_average"
    independent_lots: int = 0
    training_images: int = 0
    selection_rule: str | None = None
    evaluation_scope: str | None = None
    comparison: list[dict] = Field(default_factory=list)
    matching: dict | None = None
    protocol: dict = Field(default_factory=dict)
    limitations: list[str] = Field(default_factory=list)
    message: str


class LabReferences(BaseModel):
    label_status: str
    label_fingerprint: str
    limitations: list[str]
    lots: list[LabReference]
