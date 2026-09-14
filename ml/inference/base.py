"""Shared prediction pipeline: preprocess -> logits -> calibrate -> top-k -> OOD -> Grad-CAM.

Concrete predictors only implement ``_logits`` and ``_heatmap``; everything
else (timing, calibration, unknown rejection, output schema) lives here so the
mock and trained paths behave identically from the API's point of view.
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from PIL import Image

from ml.calibration import softmax_np
from ml.data.preprocessing import PreprocessConfig, preprocess_image
from ml.explain.gradcam import heatmap_to_overlay
from ml.ood import Rejector, confidence_level

logger = logging.getLogger("ml.inference")


class PredictorLoadError(RuntimeError):
    """Raised when a predictor cannot be constructed (missing/corrupt checkpoint, bad registry)."""


@dataclass
class TopPrediction:
    class_name: str
    class_index: int
    raw_probability: float
    calibrated_confidence: float


@dataclass
class Timings:
    preprocess_ms: float = 0.0
    inference_ms: float = 0.0
    explainability_ms: float = 0.0
    total_ms: float = 0.0


@dataclass
class PredictionOutput:
    class_name: str
    class_index: int
    raw_probability: float
    calibrated_confidence: float
    confidence_level: str
    is_unknown: bool
    unknown_reason: str | None
    top_predictions: list[TopPrediction]
    ood_scores: dict[str, float]
    timings: Timings
    device: str
    is_mock: bool
    model_name: str
    model_version: str
    architecture: str
    calibration_temperature: float
    gradcam_image: Image.Image | None = None
    explanation_error: str | None = None
    input_view: Image.Image | None = None
    extra: dict[str, Any] = field(default_factory=dict)


class BasePredictor(ABC):
    """Template-method base class for all predictors."""

    is_mock: bool = False

    def __init__(
        self,
        class_names: list[str],
        image_size: int,
        rejector: Rejector,
        model_name: str,
        model_version: str,
        architecture: str,
        device: str = "cpu",
        calibration_temperature: float = 1.0,
        normalization: dict[str, list[float]] | None = None,
    ) -> None:
        if len(class_names) < 2:
            raise PredictorLoadError("A predictor needs at least two class names")
        self.class_names = list(class_names)
        self.image_size = int(image_size)
        self.rejector = rejector
        self.model_name = model_name
        self.model_version = model_version
        self.architecture = architecture
        self.device = device
        self.calibration_temperature = float(calibration_temperature) if calibration_temperature else 1.0
        mean = tuple(normalization["mean"]) if normalization else None
        std = tuple(normalization["std"]) if normalization else None
        self.preprocess_cfg = PreprocessConfig(image_size=self.image_size, **({"mean": mean, "std": std} if mean and std else {}))

    # ------------------------------------------------------------- abstract
    @abstractmethod
    def _logits(self, chw: np.ndarray) -> np.ndarray:
        """Return raw logits (1-D float array of length num_classes)."""

    @abstractmethod
    def _heatmap(self, chw: np.ndarray, class_index: int) -> np.ndarray:
        """Return a [0,1] heatmap (H, W) for ``class_index``."""

    def _overlay_label(self) -> str | None:
        return None

    # -------------------------------------------------------------- public
    def warmup(self) -> None:
        """Run one dummy forward pass so the first real request is not slow."""
        dummy = Image.new("RGB", (self.image_size, self.image_size), color=(200, 200, 200))
        try:
            self.predict(dummy, top_k=1, explain=False)
        except Exception as exc:  # pragma: no cover - warmup must never crash startup
            logger.warning("Predictor warm-up failed: %s", exc)

    def info(self) -> dict[str, Any]:
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "architecture": self.architecture,
            "device": self.device,
            "is_mock": self.is_mock,
            "num_classes": len(self.class_names),
            "class_names": self.class_names,
            "image_size": self.image_size,
            "calibration_temperature": self.calibration_temperature,
            "ood": self.rejector.describe(),
        }

    def predict(self, image: Image.Image, top_k: int = 3, explain: bool = False) -> PredictionOutput:
        t_start = time.perf_counter()
        chw, view = preprocess_image(image, self.preprocess_cfg)
        t_pre = time.perf_counter()

        logits = np.asarray(self._logits(chw), dtype=np.float64).reshape(-1)
        if logits.shape[0] != len(self.class_names):
            raise RuntimeError(f"Model produced {logits.shape[0]} logits for {len(self.class_names)} classes")
        raw_probs = softmax_np(logits, 1.0)
        cal_probs = softmax_np(logits, self.calibration_temperature)
        t_inf = time.perf_counter()

        order = np.argsort(-cal_probs)
        k = max(1, min(int(top_k), len(self.class_names)))
        top = [TopPrediction(self.class_names[i], int(i), float(raw_probs[i]), float(cal_probs[i])) for i in order[:k]]
        best = top[0]
        decision = self.rejector.decide(logits, cal_probs)
        level = confidence_level(best.calibrated_confidence, decision.is_unknown)

        gradcam_img, explain_err, t_exp_ms = None, None, 0.0
        if explain:
            t_e0 = time.perf_counter()
            try:
                heat = self._heatmap(chw, best.class_index)
                gradcam_img = heatmap_to_overlay(view, heat, label=self._overlay_label())
            except Exception as exc:
                logger.exception("Grad-CAM generation failed")
                explain_err = f"{type(exc).__name__}: {exc}"
            t_exp_ms = (time.perf_counter() - t_e0) * 1000

        total_ms = (time.perf_counter() - t_start) * 1000
        return PredictionOutput(
            class_name=best.class_name,
            class_index=best.class_index,
            raw_probability=best.raw_probability,
            calibrated_confidence=best.calibrated_confidence,
            confidence_level=level,
            is_unknown=decision.is_unknown,
            unknown_reason=decision.reason,
            top_predictions=top,
            ood_scores=decision.scores,
            timings=Timings(
                preprocess_ms=(t_pre - t_start) * 1000,
                inference_ms=(t_inf - t_pre) * 1000,
                explainability_ms=t_exp_ms,
                total_ms=total_ms,
            ),
            device=self.device,
            is_mock=self.is_mock,
            model_name=self.model_name,
            model_version=self.model_version,
            architecture=self.architecture,
            calibration_temperature=self.calibration_temperature,
            gradcam_image=gradcam_img,
            explanation_error=explain_err,
            input_view=view,
        )
