"""Multi-class metrics beyond plain accuracy (macro-F1, balanced accuracy, top-k, ...).

Rationale: cotton cultivar datasets are frequently imbalanced. Accuracy can look
excellent while a minority cultivar is never recognised; macro-averaged metrics
and per-class recall expose that failure mode.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)


def top_k_accuracy(y_true: np.ndarray, probs: np.ndarray, k: int) -> float | None:
    """Fraction of samples whose true label is among the k highest-probability classes."""
    if probs.ndim != 2 or probs.shape[1] <= k:
        return None
    topk = np.argsort(-probs, axis=1)[:, :k]
    return float(np.mean([t in row for t, row in zip(y_true, topk, strict=True)]))


def compute_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    probs: np.ndarray | None,
    class_names: list[str],
) -> dict[str, Any]:
    """Return a JSON-serialisable dictionary with global and per-class metrics."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    labels = list(range(len(class_names)))
    p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=labels, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    with np.errstate(invalid="ignore", divide="ignore"):
        cm_norm = np.nan_to_num(cm / cm.sum(axis=1, keepdims=True))

    metrics: dict[str, Any] = {
        "num_samples": int(len(y_true)),
        "num_classes": len(class_names),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)) if len(set(y_true.tolist())) > 1 else None,
        "macro_precision": float(np.mean(p)),
        "macro_recall": float(np.mean(r)),
        "macro_f1": float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y_true, y_pred, labels=labels, average="weighted", zero_division=0)),
        "per_class": {name: {"precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])} for i, name in enumerate(class_names)},
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_normalized": cm_norm.round(4).tolist(),
        "class_names": list(class_names),
    }
    if probs is not None:
        probs = np.asarray(probs)
        metrics["top2_accuracy"] = top_k_accuracy(y_true, probs, 2)
        metrics["top3_accuracy"] = top_k_accuracy(y_true, probs, 3)
        metrics["mean_max_probability"] = float(np.mean(probs.max(axis=1)))
        metrics["nll"] = float(-np.mean(np.log(np.clip(probs[np.arange(len(y_true)), y_true], 1e-12, 1.0))))
        metrics["classification_report"] = classification_report(y_true, y_pred, labels=labels, target_names=class_names, zero_division=0, output_dict=True)
    return metrics


def save_metrics_bundle(metrics: dict[str, Any], out_dir: str | Path, prefix: str = "test") -> None:
    """Write ``<prefix>_metrics.json``, per-class CSV and confusion-matrix charts."""
    import pandas as pd

    from ml.utils.paths import write_json

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    write_json(out / f"{prefix}_metrics.json", metrics)

    per_class = pd.DataFrame(metrics["per_class"]).T
    per_class.index.name = "class"
    per_class.to_csv(out / f"{prefix}_per_class_metrics.csv")

    summary_keys = [
        "accuracy",
        "balanced_accuracy",
        "macro_precision",
        "macro_recall",
        "macro_f1",
        "weighted_f1",
        "top2_accuracy",
        "top3_accuracy",
        "nll",
        "num_samples",
    ]
    pd.DataFrame([{k: metrics.get(k) for k in summary_keys}]).to_csv(out / f"{prefix}_summary.csv", index=False)

    plot_confusion_matrix(np.array(metrics["confusion_matrix"]), metrics["class_names"], out / f"{prefix}_confusion_matrix.png")
    plot_confusion_matrix(
        np.array(metrics["confusion_matrix_normalized"]),
        metrics["class_names"],
        out / f"{prefix}_confusion_matrix_normalized.png",
        normalized=True,
    )
    plot_per_class_bars(metrics, out / f"{prefix}_per_class_metrics.png")


def plot_confusion_matrix(cm: np.ndarray, class_names: list[str], path: Path, normalized: bool = False) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    n = len(class_names)
    fig, ax = plt.subplots(figsize=(max(5, 0.7 * n + 3), max(4, 0.7 * n + 2)))
    im = ax.imshow(cm, cmap="Blues", vmin=0, vmax=1 if normalized else None)
    ax.set_xticks(range(n), class_names, rotation=45, ha="right")
    ax.set_yticks(range(n), class_names)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("Normalised confusion matrix" if normalized else "Confusion matrix")
    thresh = (cm.max() if cm.size else 0) / 2
    for i in range(n):
        for j in range(n):
            val = f"{cm[i, j]:.2f}" if normalized else f"{int(cm[i, j])}"
            ax.text(j, i, val, ha="center", va="center", color="white" if cm[i, j] > thresh else "black", fontsize=8)
    fig.colorbar(im, ax=ax, fraction=0.046)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def plot_per_class_bars(metrics: dict[str, Any], path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    names = metrics["class_names"]
    x = np.arange(len(names))
    width = 0.27
    fig, ax = plt.subplots(figsize=(max(6, 0.9 * len(names) + 3), 4))
    for k, key in enumerate(("precision", "recall", "f1")):
        ax.bar(x + (k - 1) * width, [metrics["per_class"][n][key] for n in names], width, label=key)
    ax.set_xticks(x, names, rotation=45, ha="right")
    ax.set_ylim(0, 1)
    ax.set_ylabel("score")
    ax.set_title("Per-class precision / recall / F1")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def plot_training_curves(history: list[dict[str, Any]], path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if not history:
        return
    epochs = [h["epoch"] for h in history]
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].plot(epochs, [h["train_loss"] for h in history], label="train loss")
    axes[0].plot(epochs, [h["val_loss"] for h in history], label="val loss")
    axes[0].set_xlabel("epoch")
    axes[0].legend()
    axes[0].set_title("Loss")
    axes[1].plot(epochs, [h["val_accuracy"] for h in history], label="val accuracy")
    axes[1].plot(epochs, [h["val_macro_f1"] for h in history], label="val macro-F1")
    axes[1].set_xlabel("epoch")
    axes[1].set_ylim(0, 1)
    axes[1].legend()
    axes[1].set_title("Validation")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
