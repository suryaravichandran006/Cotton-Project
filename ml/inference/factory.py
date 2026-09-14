"""Build the predictor the API should serve, based on MODEL_MODE and the registry."""

from __future__ import annotations

import logging
from pathlib import Path

from ml.inference.base import BasePredictor, PredictorLoadError
from ml.inference.mock import MockPredictor
from ml.ood import ConfidenceThresholdRejector, build_rejector
from ml.registry import ModelRegistry

logger = logging.getLogger("ml.inference")


def build_predictor(
    mode: str,
    registry_path: str | Path | None,
    fallback_class_names: list[str],
    unknown_threshold: float = 0.6,
    device: str = "auto",
    image_size: int = 224,
    warm: bool = True,
) -> BasePredictor:
    """``mode`` is ``mock`` or ``trained``.

    * mock    -> :class:`MockPredictor` using the active registry entry's class
                 names if one exists, else ``fallback_class_names``.
    * trained -> :class:`TorchPredictor` for the registry's active model.
                 Raises :class:`PredictorLoadError` with an actionable message.
    """
    mode = (mode or "mock").lower()
    registry = ModelRegistry(registry_path)
    entry = registry.active_entry()

    if mode == "mock":
        names = list(entry.class_names) if entry and entry.class_names else list(fallback_class_names)
        size = entry.image_size if entry else image_size
        predictor: BasePredictor = MockPredictor(names, image_size=size, rejector=ConfidenceThresholdRejector(unknown_threshold))
        if warm:
            predictor.warmup()
        return predictor

    if mode != "trained":
        raise PredictorLoadError(f"MODEL_MODE must be 'mock' or 'trained', got '{mode}'")
    if entry is None:
        raise PredictorLoadError(
            f"MODEL_MODE=trained but registry {registry.path} has no active model. "
            "Train, export and register a model (see docs/TRAINING.md) or set MODEL_MODE=mock."
        )
    from ml.inference.torch_predictor import TorchPredictor

    ood_cfg = dict(entry.ood or {})
    if ood_cfg.get("strategy", "confidence_threshold") == "confidence_threshold" and "threshold" not in ood_cfg:
        ood_cfg["threshold"] = unknown_threshold
    return TorchPredictor(entry, rejector=build_rejector(ood_cfg, unknown_threshold), device=device, warm=warm)
