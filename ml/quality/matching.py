"""Measure reference-lot retrieval on held-out photos of the SAME known physical lots."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import StratifiedKFold


def matching_metrics(groups: np.ndarray, predictions: np.ndarray, labels: list[str]) -> dict:
    precision, recall, f1, support = precision_recall_fscore_support(groups, predictions, labels=labels, zero_division=0)
    return {
        "accuracy": float(accuracy_score(groups, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(groups, predictions)),
        "macro_precision": float(precision.mean()),
        "macro_recall": float(recall.mean()),
        "macro_f1": float(f1.mean()),
        "correct": int(np.sum(groups == predictions)),
        "total": len(groups),
        "labels": labels,
        "confusion_matrix": confusion_matrix(groups, predictions, labels=labels).tolist(),
        "per_lot": {
            label: {"precision": float(precision[i]), "recall": float(recall[i]), "f1": float(f1[i]), "support": int(support[i])}
            for i, label in enumerate(labels)
        },
        "predictions": predictions.tolist(),
        "truth": groups.tolist(),
    }


def evaluate_known_lot_matching(tokens: np.ndarray, groups: np.ndarray, seed: int = 42) -> dict:
    """Every query is absent from its fold's centroids; this is not unseen-lot validation."""
    labels = sorted(set(groups.tolist()), key=lambda label: int(label[1:]))
    fold_count = min(5, min(int(np.sum(groups == label)) for label in labels))
    if fold_count < 2:
        raise ValueError("At least two photographs per known lot are required for matching evaluation")
    vectors = tokens.mean(axis=1)
    predictions = np.empty(len(groups), dtype=groups.dtype)
    assignments = []
    for fold, (train, test) in enumerate(StratifiedKFold(n_splits=fold_count, shuffle=True, random_state=seed).split(vectors, groups)):
        references = np.stack([vectors[train][groups[train] == label].mean(axis=0) for label in labels])
        references /= np.maximum(np.linalg.norm(references, axis=1, keepdims=True), 1e-8)
        queries = vectors[test] / np.maximum(np.linalg.norm(vectors[test], axis=1, keepdims=True), 1e-8)
        selected = (queries @ references.T).argmax(axis=1)
        predictions[test] = np.asarray(labels)[selected]
        assignments.append({"fold": fold + 1, "reference_indices": train.tolist(), "query_indices": test.tolist()})
    return {
        **matching_metrics(groups, predictions, labels),
        "method": "Frozen ImageNet CNN features, cosine similarity to training-photo lot centroids",
        "scope": "Held-out photographs of the same ten known source lots. Shared physical lots and unknown capture sessions limit generalization; this is not accuracy on new lots.",
        "fold_count": fold_count,
        "folds": assignments,
        "seed": seed,
    }
