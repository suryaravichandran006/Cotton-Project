"""``get_model(architecture, num_classes, pretrained)`` backed by timm.

Architectures are declared in ``config/models.yaml`` so a new backbone can be
benchmarked by adding a YAML entry (timm name + Grad-CAM layer) — no code edits.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ml.config import load_models_config


@dataclass(frozen=True)
class ArchitectureSpec:
    name: str
    timm_name: str
    role: str
    description: str
    gradcam_layer: str
    overrides: dict[str, Any]


def list_architectures(models_config_path: str | None = None) -> list[ArchitectureSpec]:
    cfg = load_models_config(models_config_path)
    return [
        ArchitectureSpec(
            name=name,
            timm_name=entry["timm_name"],
            role=entry.get("role", ""),
            description=entry.get("description", ""),
            gradcam_layer=entry["gradcam_layer"],
            overrides=entry.get("overrides", {}) or {},
        )
        for name, entry in cfg.get("architectures", {}).items()
    ]


def get_architecture_spec(architecture: str, models_config_path: str | None = None) -> ArchitectureSpec:
    for spec in list_architectures(models_config_path):
        if spec.name == architecture:
            return spec
    names = [s.name for s in list_architectures(models_config_path)]
    raise KeyError(f"Unknown architecture '{architecture}'. Available: {names}")


def get_model(architecture: str, num_classes: int, pretrained: bool = True, dropout: float = 0.0, models_config_path: str | None = None):
    """Create a timm classifier with a fresh ``num_classes`` head."""
    import timm

    if num_classes < 2:
        raise ValueError("num_classes must be >= 2")
    spec = get_architecture_spec(architecture, models_config_path)
    model = timm.create_model(spec.timm_name, pretrained=pretrained, num_classes=num_classes, drop_rate=dropout)
    model.cottonvision_architecture = architecture  # type: ignore[attr-defined]
    return model


def load_transfer_weights(model, checkpoint: str | Path) -> dict[str, Any]:
    """Load all shape-compatible weights from an earlier Cotton Grade stage.

    The target model is created with the NEW task's classifier head first. Keys
    whose tensor shapes differ (normally the classifier head) are intentionally
    skipped, so the learned backbone transfers while old task labels do not.
    """
    import torch

    path = Path(checkpoint)
    if not path.is_file():
        raise FileNotFoundError(f"Transfer checkpoint not found: {path}")
    payload = torch.load(path, map_location="cpu", weights_only=False)
    source = payload.get("model_state_dict", payload)
    target = model.state_dict()
    compatible = {key: value for key, value in source.items() if key in target and getattr(value, "shape", None) == target[key].shape}
    skipped = sorted(set(source) - set(compatible))
    missing, unexpected = model.load_state_dict(compatible, strict=False)
    return {
        "checkpoint": str(path),
        "source_architecture": payload.get("architecture"),
        "source_classes": payload.get("class_names", []),
        "loaded_tensors": len(compatible),
        "skipped_tensors": len(skipped),
        "missing_keys": list(missing),
        "unexpected_keys": list(unexpected),
    }


def resolve_gradcam_layer(model, dotted_path: str):
    module = model
    for part in dotted_path.split("."):
        module = module[int(part)] if part.isdigit() else getattr(module, part)
    return module


def count_parameters(model) -> int:
    return sum(p.numel() for p in model.parameters())
