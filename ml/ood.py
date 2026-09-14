"""Unknown / out-of-distribution rejection.

A closed-set classifier always produces *some* class. To avoid labelling a
random photograph as a cotton cultivar we run every prediction through a
``Rejector``. The default is a calibrated-confidence threshold; an energy-score
rejector is provided as the first step of the extension path (Mahalanobis,
deep-embedding or one-class detectors implement the same interface).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class OODDecision:
    is_unknown: bool
    reason: str | None = None
    scores: dict[str, float] = field(default_factory=dict)


class Rejector(ABC):
    """Interface for all unknown-detection strategies."""

    name: str = "base"

    @abstractmethod
    def decide(self, logits: np.ndarray, calibrated_probs: np.ndarray, **context: Any) -> OODDecision:
        """``logits``/``calibrated_probs`` are 1-D arrays for a single sample."""

    def describe(self) -> dict[str, Any]:
        return {"name": self.name}


class ConfidenceThresholdRejector(Rejector):
    """Reject when the calibrated top-1 confidence is below ``threshold``."""

    name = "confidence_threshold"

    def __init__(self, threshold: float = 0.6) -> None:
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("threshold must be within [0, 1]")
        self.threshold = float(threshold)

    def decide(self, logits: np.ndarray, calibrated_probs: np.ndarray, **context: Any) -> OODDecision:
        conf = float(np.max(calibrated_probs))
        unknown = conf < self.threshold
        return OODDecision(
            is_unknown=unknown,
            reason=f"calibrated confidence {conf:.3f} below threshold {self.threshold:.2f}" if unknown else None,
            scores={"max_calibrated_confidence": conf, "threshold": self.threshold},
        )

    def describe(self) -> dict[str, Any]:
        return {"name": self.name, "threshold": self.threshold}


class EnergyScoreRejector(Rejector):
    """Energy-based OOD score (Liu et al., 2020): ``E = -T * logsumexp(logits / T)``.

    Higher energy => less in-distribution. ``energy_threshold`` must be
    estimated on validation data (e.g. the 95th percentile of in-distribution
    energies); it is *not* a universal constant.
    """

    name = "energy_score"

    def __init__(self, energy_threshold: float, temperature: float = 1.0) -> None:
        self.energy_threshold = float(energy_threshold)
        self.temperature = float(temperature)

    @staticmethod
    def energy(logits: np.ndarray, temperature: float = 1.0) -> float:
        z = logits / temperature
        m = z.max()
        return float(-temperature * (m + np.log(np.exp(z - m).sum())))

    def decide(self, logits: np.ndarray, calibrated_probs: np.ndarray, **context: Any) -> OODDecision:
        e = self.energy(np.asarray(logits, dtype=np.float64), self.temperature)
        unknown = e > self.energy_threshold
        return OODDecision(
            is_unknown=unknown,
            reason=f"energy {e:.3f} above threshold {self.energy_threshold:.3f}" if unknown else None,
            scores={"energy": e, "energy_threshold": self.energy_threshold},
        )

    def describe(self) -> dict[str, Any]:
        return {"name": self.name, "energy_threshold": self.energy_threshold, "temperature": self.temperature}


class CompositeRejector(Rejector):
    """Unknown if *any* member rejects. Lets us stack threshold + energy later."""

    name = "composite"

    def __init__(self, members: list[Rejector]) -> None:
        if not members:
            raise ValueError("CompositeRejector needs at least one member")
        self.members = members

    def decide(self, logits: np.ndarray, calibrated_probs: np.ndarray, **context: Any) -> OODDecision:
        scores: dict[str, float] = {}
        for m in self.members:
            d = m.decide(logits, calibrated_probs, **context)
            scores.update({f"{m.name}.{k}": v for k, v in d.scores.items()})
            if d.is_unknown:
                return OODDecision(True, d.reason, scores)
        return OODDecision(False, None, scores)

    def describe(self) -> dict[str, Any]:
        return {"name": self.name, "members": [m.describe() for m in self.members]}


def build_rejector(config: dict[str, Any] | None, default_threshold: float = 0.6) -> Rejector:
    """Factory from a registry/model-metadata dict, e.g.
    ``{"strategy": "confidence_threshold", "threshold": 0.6}`` or
    ``{"strategy": "energy", "energy_threshold": -5.2}``.
    """
    config = config or {}
    strategy = config.get("strategy", "confidence_threshold")
    if strategy == "confidence_threshold":
        return ConfidenceThresholdRejector(float(config.get("threshold", default_threshold)))
    if strategy == "energy":
        return EnergyScoreRejector(float(config["energy_threshold"]), float(config.get("temperature", 1.0)))
    if strategy == "composite":
        return CompositeRejector([build_rejector(m, default_threshold) for m in config.get("members", [])])
    raise ValueError(f"Unknown OOD strategy '{strategy}'")


def confidence_level(confidence: float, is_unknown: bool, high: float = 0.85, medium: float = 0.65) -> str:
    """Bucket used by the UI: unknown | high | medium | low."""
    if is_unknown:
        return "unknown"
    if confidence >= high:
        return "high"
    if confidence >= medium:
        return "medium"
    return "low"
