"""Temperature scaling (Guo et al., 2017) and calibration diagnostics.

A softmax output is *not* a validated probability: modern CNNs are typically
over-confident. Temperature scaling learns one scalar ``T`` on the validation
set such that ``softmax(logits / T)`` minimises NLL, leaving the arg-max (and
thus accuracy) unchanged while making confidence values meaningful.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np


def softmax_np(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    z = logits / max(temperature, 1e-6)
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def nll_np(logits: np.ndarray, labels: np.ndarray, temperature: float) -> float:
    p = softmax_np(logits, temperature)
    return float(-np.mean(np.log(np.clip(p[np.arange(len(labels)), labels], 1e-12, 1.0))))


@dataclass
class CalibrationResult:
    temperature: float
    nll_before: float
    nll_after: float
    ece_before: float
    ece_after: float
    reliability_before: list[dict[str, float]]
    reliability_after: list[dict[str, float]]

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


def expected_calibration_error(probs: np.ndarray, labels: np.ndarray, n_bins: int = 15) -> tuple[float, list[dict[str, float]]]:
    """ECE plus per-bin reliability data (confidence vs. accuracy)."""
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    correct = (pred == labels).astype(float)
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece, table = 0.0, []
    for lo, hi in zip(bins[:-1], bins[1:], strict=True):
        mask = (conf > lo) & (conf <= hi)
        if not mask.any():
            table.append({"bin_lower": float(lo), "bin_upper": float(hi), "count": 0, "confidence": 0.0, "accuracy": 0.0})
            continue
        bin_conf, bin_acc = float(conf[mask].mean()), float(correct[mask].mean())
        ece += (mask.sum() / len(conf)) * abs(bin_acc - bin_conf)
        table.append({"bin_lower": float(lo), "bin_upper": float(hi), "count": int(mask.sum()), "confidence": bin_conf, "accuracy": bin_acc})
    return float(ece), table


def fit_temperature(logits: np.ndarray, labels: np.ndarray, grid: tuple[float, float, int] = (0.05, 10.0, 400)) -> float:
    """Fit T by NLL minimisation: coarse log-spaced grid search then local refinement.

    Grid search is robust, deterministic and dependency-free (no LBFGS
    convergence issues) — with a single scalar this is exact enough.
    """
    if len(labels) == 0:
        return 1.0
    lo, hi, n = grid
    candidates = np.exp(np.linspace(np.log(lo), np.log(hi), n))
    losses = np.array([nll_np(logits, labels, t) for t in candidates])
    best = candidates[int(losses.argmin())]
    fine = np.linspace(best * 0.9, best * 1.1, 201)
    fine_losses = np.array([nll_np(logits, labels, t) for t in fine])
    return float(fine[int(fine_losses.argmin())])


def calibrate(logits: np.ndarray, labels: np.ndarray, n_bins: int = 15) -> CalibrationResult:
    logits = np.asarray(logits, dtype=np.float64)
    labels = np.asarray(labels)
    t = fit_temperature(logits, labels)
    ece_b, rel_b = expected_calibration_error(softmax_np(logits, 1.0), labels, n_bins)
    ece_a, rel_a = expected_calibration_error(softmax_np(logits, t), labels, n_bins)
    return CalibrationResult(
        temperature=t,
        nll_before=nll_np(logits, labels, 1.0),
        nll_after=nll_np(logits, labels, t),
        ece_before=ece_b,
        ece_after=ece_a,
        reliability_before=rel_b,
        reliability_after=rel_a,
    )


def plot_reliability(result: CalibrationResult, path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 2, figsize=(10, 4.5), sharey=True)
    for ax, table, title, ece in (
        (axes[0], result.reliability_before, "Before (T=1)", result.ece_before),
        (axes[1], result.reliability_after, f"After (T={result.temperature:.3f})", result.ece_after),
    ):
        centers = [(b["bin_lower"] + b["bin_upper"]) / 2 for b in table]
        accs = [b["accuracy"] for b in table]
        ax.bar(centers, accs, width=1 / len(table), edgecolor="black", alpha=0.7, label="accuracy")
        ax.plot([0, 1], [0, 1], "--", color="grey", label="perfect")
        ax.set_title(f"{title} — ECE {ece:.3f}")
        ax.set_xlabel("confidence")
        ax.legend()
    axes[0].set_ylabel("accuracy")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
