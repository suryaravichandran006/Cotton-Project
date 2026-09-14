"""Deterministic mock predictor used before a trained model exists.

* Runs the real preprocessing pipeline (so upload/validation/preprocess bugs surface).
* Produces a *deterministic* pseudo-prediction derived from a hash of the
  preprocessed pixels — the same image always yields the same demo result.
* Produces a clearly-labelled demonstration heatmap based on local texture
  variance. It is NOT a model explanation and is captioned as such.
* Every output carries ``is_mock=True``; the API and UI surface this loudly.
"""

from __future__ import annotations

import hashlib

import numpy as np
from PIL import Image, ImageFilter

from ml.inference.base import BasePredictor
from ml.ood import ConfidenceThresholdRejector, Rejector

MOCK_MODEL_NAME = "mock-demo-predictor"
MOCK_MODEL_VERSION = "0.0.0-mock"
MOCK_OVERLAY_LABEL = "DEMO HEATMAP - NOT A MODEL EXPLANATION"


class MockPredictor(BasePredictor):
    is_mock = True

    def __init__(
        self,
        class_names: list[str],
        image_size: int = 224,
        rejector: Rejector | None = None,
        seed: int = 0,
    ) -> None:
        super().__init__(
            class_names=class_names,
            image_size=image_size,
            rejector=rejector or ConfidenceThresholdRejector(0.6),
            model_name=MOCK_MODEL_NAME,
            model_version=MOCK_MODEL_VERSION,
            architecture="none (mock)",
            device="cpu",
            calibration_temperature=1.0,
        )
        self.seed = seed

    def _rng(self, chw: np.ndarray) -> np.random.Generator:
        digest = hashlib.sha256(np.ascontiguousarray(chw[:, ::8, ::8]).tobytes()).digest()
        return np.random.default_rng(int.from_bytes(digest[:8], "little") ^ self.seed)

    def _logits(self, chw: np.ndarray) -> np.ndarray:
        rng = self._rng(chw)
        n = len(self.class_names)
        logits = rng.normal(0.0, 1.0, size=n)
        # Vary peakiness so the UI exercises high / medium / low / unknown states.
        winner = int(rng.integers(0, n))
        logits[winner] += float(rng.choice([0.4, 1.2, 2.2, 3.5]))
        return logits

    def _heatmap(self, chw: np.ndarray, class_index: int) -> np.ndarray:
        """Local-variance texture map, blurred — visibly a demo, not Grad-CAM."""
        mean = np.asarray(self.preprocess_cfg.mean, dtype=np.float32).reshape(3, 1, 1)
        std = np.asarray(self.preprocess_cfg.std, dtype=np.float32).reshape(3, 1, 1)
        rgb = np.clip(chw * std + mean, 0, 1)
        gray = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]).astype(np.float32)
        gx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
        gy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
        energy = gx + gy
        img = Image.fromarray((255 * energy / max(float(energy.max()), 1e-6)).astype(np.uint8))
        img = img.filter(ImageFilter.GaussianBlur(radius=max(4, self.image_size // 28)))
        heat = np.asarray(img, dtype=np.float32) / 255.0
        heat -= heat.min()
        return heat / max(float(heat.max()), 1e-6)

    def _overlay_label(self) -> str | None:
        return MOCK_OVERLAY_LABEL
