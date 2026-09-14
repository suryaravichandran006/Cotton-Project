"""Typed configuration loading for training / evaluation.

Configuration is layered:
1. ``config/train.yaml`` (base)
2. per-architecture ``overrides`` from ``config/models.yaml``
3. explicit CLI overrides
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields
from pathlib import Path
from typing import Any

import yaml

from ml.utils.paths import CONFIG_DIR, resolve_path

IMAGENET_MEAN: tuple[float, float, float] = (0.485, 0.456, 0.406)
IMAGENET_STD: tuple[float, float, float] = (0.229, 0.224, 0.225)


@dataclass
class TrainConfig:
    """All knobs of a training run. Field names mirror ``config/train.yaml``."""

    experiment_name: str = "baseline"
    architecture: str = "convnext_tiny"
    pretrained: bool = True
    init_checkpoint: str | None = None
    transfer_source: str | None = None

    data_dir: str = "data/raw"
    metadata_csv: str | None = None
    splits_dir: str = "data/processed/splits"
    train_ratio: float = 0.70
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    group_by: str = "auto"
    image_size: int = 224
    num_workers: int = 4
    augmentation_preset: str = "default"
    enable_lighting_aug: bool = False

    epochs: int = 30
    batch_size: int = 32
    learning_rate: float = 3e-4
    weight_decay: float = 0.05
    optimizer: str = "adamw"
    scheduler: str = "cosine"
    warmup_epochs: int = 1
    momentum: float = 0.9
    dropout: float = 0.2
    label_smoothing: float = 0.1
    class_weights: bool = False
    early_stopping_patience: int = 8
    monitor_metric: str = "macro_f1"
    mixed_precision: bool = True
    grad_clip_norm: float | None = 1.0

    seed: int = 42
    deterministic: bool = True
    checkpoint_dir: str = "models/checkpoints"
    reports_dir: str = "reports"
    tensorboard: bool = True
    log_every_n_steps: int = 20
    device: str = "auto"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def validate(self) -> None:
        total = self.train_ratio + self.val_ratio + self.test_ratio
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"train/val/test ratios must sum to 1.0 (got {total:.4f})")
        if self.optimizer not in ("adamw", "sgd"):
            raise ValueError("optimizer must be 'adamw' or 'sgd'")
        if self.scheduler not in ("cosine", "plateau", "none"):
            raise ValueError("scheduler must be 'cosine', 'plateau' or 'none'")
        if self.image_size < 64:
            raise ValueError("image_size must be >= 64")
        if self.epochs < 1 or self.batch_size < 1:
            raise ValueError("epochs and batch_size must be positive")

    @property
    def data_path(self) -> Path:
        return resolve_path(self.data_dir)

    @property
    def splits_path(self) -> Path:
        return resolve_path(self.splits_dir)

    @property
    def checkpoint_path(self) -> Path:
        return resolve_path(self.checkpoint_dir) / self.experiment_name

    @property
    def report_path(self) -> Path:
        return resolve_path(self.reports_dir) / self.experiment_name

    @property
    def init_checkpoint_path(self) -> Path | None:
        return resolve_path(self.init_checkpoint) if self.init_checkpoint else None


def _load_yaml(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def load_models_config(path: str | Path | None = None) -> dict[str, Any]:
    return _load_yaml(resolve_path(path) if path else CONFIG_DIR / "models.yaml")


def load_augmentation_preset(name: str, path: str | Path | None = None) -> dict[str, Any]:
    cfg = _load_yaml(resolve_path(path) if path else CONFIG_DIR / "augmentation.yaml")
    presets = cfg.get("presets", {})
    if name not in presets:
        raise KeyError(f"Unknown augmentation preset '{name}'. Available: {sorted(presets)}")
    return presets[name]


def load_train_config(config_path: str | Path | None = None, overrides: dict[str, Any] | None = None, models_config_path: str | Path | None = None) -> TrainConfig:
    raw: dict[str, Any] = {}
    if config_path is not None:
        raw.update(_load_yaml(resolve_path(config_path)))
    overrides = {k: v for k, v in (overrides or {}).items() if v is not None}
    architecture = overrides.get("architecture", raw.get("architecture", TrainConfig.architecture))
    models_cfg = load_models_config(models_config_path)
    arch_cfg = models_cfg.get("architectures", {}).get(architecture)
    if arch_cfg is None:
        raise KeyError(f"Architecture '{architecture}' not defined in config/models.yaml. Available: {sorted(models_cfg.get('architectures', {}))}")
    raw.update(arch_cfg.get("overrides", {}) or {})
    raw.update(overrides)
    known = {f.name for f in fields(TrainConfig)}
    unknown = set(raw) - known
    if unknown:
        raise KeyError(f"Unknown config keys: {sorted(unknown)}")
    cfg = TrainConfig(**raw)
    cfg.validate()
    return cfg
