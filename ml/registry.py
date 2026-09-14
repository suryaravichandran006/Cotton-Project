"""``models/registry.json`` — the single source of truth for which model the API serves."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ml.utils.paths import DEFAULT_REGISTRY_PATH, REPO_ROOT, read_json, resolve_path, write_json

SCHEMA_VERSION = 1


@dataclass
class ModelEntry:
    name: str
    version: str
    architecture: str
    checkpoint: str
    class_names: list[str]
    image_size: int = 224
    normalization: dict[str, list[float]] = field(default_factory=lambda: {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]})
    calibration_temperature: float | None = None
    ood: dict[str, Any] = field(default_factory=lambda: {"strategy": "confidence_threshold", "threshold": 0.6})
    metrics: dict[str, Any] = field(default_factory=dict)
    lineage: dict[str, Any] = field(default_factory=dict)
    torchscript: str | None = None
    onnx: str | None = None
    trained_at: str | None = None
    registered_at: str | None = None
    git_commit: str | None = None
    description: str = ""
    experiment_name: str | None = None
    size_mb: float | None = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> ModelEntry:
        known = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in d.items() if k in known})

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def resolve(self, key: str, base: Path = REPO_ROOT) -> Path | None:
        value = getattr(self, key)
        return resolve_path(value, base) if value else None


class ModelRegistry:
    """Load / query / mutate the registry file."""

    def __init__(self, path: str | Path | None = None) -> None:
        self.path = resolve_path(path) if path else DEFAULT_REGISTRY_PATH
        self.active_model: str | None = None
        self.models: list[ModelEntry] = []
        self.load()

    def load(self) -> ModelRegistry:
        if not self.path.exists():
            self.active_model, self.models = None, []
            return self
        data = read_json(self.path)
        self.active_model = data.get("active_model")
        self.models = [ModelEntry.from_dict(m) for m in data.get("models", [])]
        return self

    def save(self) -> None:
        write_json(self.path, {"schema_version": SCHEMA_VERSION, "active_model": self.active_model, "models": [m.to_dict() for m in self.models]})

    def get(self, name: str) -> ModelEntry | None:
        return next((m for m in self.models if m.name == name), None)

    def active_entry(self) -> ModelEntry | None:
        return self.get(self.active_model) if self.active_model else None

    def names(self) -> list[str]:
        return [m.name for m in self.models]

    def add(self, entry: ModelEntry, replace: bool = False) -> None:
        if self.get(entry.name):
            if not replace:
                raise ValueError(f"Model '{entry.name}' already registered (use replace=True)")
            self.models = [m for m in self.models if m.name != entry.name]
        self.models.append(entry)

    def set_active(self, name: str) -> None:
        if not self.get(name):
            raise KeyError(f"Model '{name}' is not registered. Registered: {self.names()}")
        self.active_model = name

    def remove(self, name: str) -> None:
        self.models = [m for m in self.models if m.name != name]
        if self.active_model == name:
            self.active_model = None

    def to_dict(self) -> dict[str, Any]:
        return {"schema_version": SCHEMA_VERSION, "active_model": self.active_model, "models": [m.to_dict() for m in self.models]}
