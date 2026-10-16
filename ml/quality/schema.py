"""Versioned property definitions. Instrument codes are retained without silently reinterpreting them."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Property:
    key: str
    label: str
    code: str
    unit: str | None
    decimals: int
    minimum: float = 0.0
    maximum: float | None = None

    def to_dict(self) -> dict:
        return asdict(self)


PROPERTIES = (
    Property("sci", "Spinning consistency index", "SCI", None, 0, maximum=500),
    Property("moisture", "Moisture", "Mst", "%", 1, maximum=100),
    Property("micronaire", "Micronaire", "Mic", None, 2, maximum=15),
    Property("maturity", "Maturity index", "Mat", None, 2, maximum=2),
    Property("span_length", "Span length (SL2)", "SL2", "mm", 2, maximum=100),
    Property("uniformity_ratio", "Uniformity ratio (UR)", "UR", "%", 1, maximum=100),
    Property("short_fibre", "Short fibre (SF)", "SF", "%", 1, maximum=100),
    Property("strength", "Fibre strength", "Str", "g/tex", 1, maximum=100),
    Property("elongation", "Elongation", "Elg", "%", 1, maximum=100),
    Property("reflectance", "Reflectance", "Rd", "%", 1, maximum=100),
    Property("yellowness", "Yellowness", "+b", None, 1, maximum=50),
    Property("trash_count", "Trash count", "TrCnt", "count", 0, maximum=10000),
    Property("trash_area", "Trash area", "TrAr", "%", 2, maximum=100),
)
NUMERIC_KEYS = [p.key for p in PROPERTIES]
CATEGORY_KEYS = ["colour_grade", "trash_grade"]
PROPERTY_VERSION = 1
