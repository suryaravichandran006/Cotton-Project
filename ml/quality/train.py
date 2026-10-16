"""Compare lot-isolated baselines and neural heads, then fit and atomically activate a local pilot."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.linear_model import Ridge

from ml.quality.data import DEFAULT_LABELS, build_manifest, fingerprint, read_labels, targets_for
from ml.quality.matching import evaluate_known_lot_matching
from ml.quality.model import IMAGE_SIZE, TOKEN_GRID, QualityHead, image_tokens, make_encoder
from ml.quality.schema import CATEGORY_KEYS, NUMERIC_KEYS, PROPERTY_VERSION
from ml.utils.paths import REPO_ROOT

CANDIDATES = ("mean", "ridge", "cnn", "cnn_lstm")


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def group_weights(groups: np.ndarray) -> np.ndarray:
    counts = Counter(groups.tolist())
    weights = np.asarray([1 / counts[g] for g in groups], dtype=np.float32)
    return weights / weights.sum()


def group_rows(values: np.ndarray, groups: np.ndarray) -> np.ndarray:
    return np.stack([values[groups == g].mean(axis=0) for g in sorted(set(groups.tolist()))])


def grouped_folds(groups: np.ndarray, seed: int = 42):
    unique = np.asarray(sorted(set(groups.tolist())))
    if len(unique) < 6:
        raise ValueError("At least six independent lots are needed for train/validation/test isolation")
    np.random.default_rng(seed).shuffle(unique)
    chunks = np.array_split(unique, min(5, len(unique) // 2))
    for i, test_groups in enumerate(chunks):
        remaining = np.asarray([g for g in unique if g not in test_groups])
        val_groups = np.roll(remaining, i * 2)[:2]
        train_groups = np.asarray([g for g in remaining if g not in val_groups])
        yield tuple(np.flatnonzero(np.isin(groups, g)) for g in (train_groups, val_groups, test_groups))


def regression_metrics(truth: np.ndarray, predicted: np.ndarray) -> dict:
    error = predicted - truth
    return {key: {"mae": float(np.abs(error[:, j]).mean()), "rmse": float(np.sqrt(np.square(error[:, j]).mean()))} for j, key in enumerate(NUMERIC_KEYS)}


def fit_candidate(name, x, y, cats, groups, category_sizes, train, val, epochs=60, seed=42, fixed_epochs=None):
    torch.manual_seed(seed)
    # All label scaling and feature normalization is fitted inside the training lots.
    independent_y = group_rows(y[train], groups[train])
    y_mean, y_scale = independent_y.mean(0), np.maximum(independent_y.std(0), 0.01)
    x_mean = x[train].mean(axis=(0, 1))
    x_scale = np.maximum(x[train].std(axis=(0, 1)), 0.01)
    weights = group_weights(groups[train])
    base = {
        "name": name,
        "y_mean": y_mean,
        "y_scale": y_scale,
        "x_mean": x_mean,
        "x_scale": x_scale,
        "category_defaults": [int(np.argmax(np.bincount(cats[train, j], weights=weights, minlength=n))) for j, n in enumerate(category_sizes)],
        "best_epoch": 0,
    }
    if name == "mean":
        return base
    if name == "ridge":
        ridge = Ridge(alpha=10.0)
        pooled = ((x[train] - x_mean) / x_scale).mean(1)
        ridge.fit(pooled, (y[train] - y_mean) / y_scale, sample_weight=weights * len(train))
        base.update({"coef": ridge.coef_.astype(np.float32), "intercept": ridge.intercept_.astype(np.float32)})
        return base
    head = QualityHead(name, x.shape[2], y.shape[1], category_sizes)
    optimizer = torch.optim.AdamW(head.parameters(), lr=0.002, weight_decay=0.01)
    tx = torch.tensor((x[train] - x_mean) / x_scale)
    ty = torch.tensor((y[train] - y_mean) / y_scale)
    tc = torch.tensor(cats[train], dtype=torch.long)
    tw = torch.tensor(weights)
    best_score, bad_epochs, best_state = float("inf"), 0, None
    for epoch in range(1, (fixed_epochs or epochs) + 1):
        head.train()
        optimizer.zero_grad()
        pred, category_logits = head(tx)
        loss = (torch.nn.functional.huber_loss(pred, ty, reduction="none").mean(1) * tw).sum()
        for j, logits in enumerate(category_logits):
            loss = loss + 0.1 * (torch.nn.functional.cross_entropy(logits, tc[:, j], reduction="none") * tw).sum()
        if not torch.isfinite(loss):
            raise RuntimeError("Non-finite quality training loss")
        loss.backward()
        torch.nn.utils.clip_grad_norm_(head.parameters(), 1.0)
        optimizer.step()
        if fixed_epochs:
            base["best_epoch"] = epoch
            continue
        head.eval()
        with torch.inference_mode():
            vp = head(torch.tensor((x[val] - x_mean) / x_scale))[0].numpy()
        errors = group_rows(np.abs(vp - (y[val] - y_mean) / y_scale), groups[val])
        score = float(errors.mean())
        if score < best_score - 1e-5:
            best_score, bad_epochs, base["best_epoch"] = score, 0, epoch
            best_state = {k: v.detach().clone() for k, v in head.state_dict().items()}
        else:
            bad_epochs += 1
        if bad_epochs >= 8:
            break
    if best_state is not None:
        head.load_state_dict(best_state)
    base["head"] = head.eval()
    return base


def predict_candidate(fit: dict, tokens: np.ndarray):
    x = (tokens - fit["x_mean"]) / fit["x_scale"]
    name = fit["name"]
    categories = np.tile(fit["category_defaults"], (len(tokens), 1))
    if name == "mean":
        return np.tile(fit["y_mean"], (len(tokens), 1)), categories
    if name == "ridge":
        output = x.mean(1) @ fit["coef"].T + fit["intercept"]
    else:
        with torch.inference_mode():
            numeric, category_logits = fit["head"](torch.tensor(x))
        output = numeric.numpy()
        categories = np.stack([p.argmax(1).numpy() for p in category_logits], axis=1)
    return output * fit["y_scale"] + fit["y_mean"], categories


def train(args) -> dict:
    torch.set_num_threads(4)
    labels = read_labels(args.labels)
    if labels["label_status"] != "verified" and not args.allow_provisional:
        raise ValueError("Physical report/photo provenance is unconfirmed. Use --allow-provisional only for an explicitly experimental pilot.")
    manifest = build_manifest(args.images, labels)
    records = [r for r in manifest["records"] if r["training_eligible"]]
    groups = np.asarray([r["lot_id"] for r in records])
    if set(groups) != {lot["lot_id"] for lot in labels["lots"]}:
        raise ValueError("Every lot must have loose-fibre photographs")
    y = targets_for(records, labels)
    category_values = [sorted({lot["average"][k] for lot in labels["lots"]}) for k in CATEGORY_KEYS]
    averages = {lot["lot_id"]: lot["average"] for lot in labels["lots"]}
    cats = np.asarray([[category_values[j].index(averages[r["lot_id"]][k]) for j, k in enumerate(CATEGORY_KEYS)] for r in records])
    category_sizes = [len(v) for v in category_values]
    output_root = Path(args.output).resolve()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run = output_root / "runs" / timestamp
    run.mkdir(parents=True, exist_ok=False)
    backbone = Path(args.backbone).resolve()
    if not backbone.is_file():
        raise FileNotFoundError("Missing pretrained encoder. Run python -m ml.quality.download_backbone first.")
    shutil.copyfile(backbone, run / "backbone.pt")
    encoder_name = getattr(args, "encoder", "torchvision_mobilenet_v3_small_imagenet1k_v1")
    device = getattr(args, "device", "cpu")
    encoder = make_encoder(backbone, device=device, encoder_name=encoder_name)
    features = []
    for offset in range(0, len(records), args.batch_size):
        images = []
        for record in records[offset : offset + args.batch_size]:
            with Image.open(record["image_path"]) as im:
                images.append(im.copy())
        features.append(image_tokens(encoder, images, device=device))
        print(f"Encoded {min(offset + args.batch_size, len(records))}/{len(records)} loose-fibre photos", flush=True)
    x = np.concatenate(features).astype(np.float32)
    np.savez_compressed(run / "features.npz", tokens=x)
    write_json(run / "manifest.json", manifest)
    folds = list(grouped_folds(groups, args.seed))
    validation = {name: [] for name in CANDIDATES}
    fitted_folds = {name: [] for name in CANDIDATES}
    split_records = []
    for fold, (train_idx, val_idx, test_idx) in enumerate(folds):
        split_records.append(
            {
                "fold": fold + 1,
                **{
                    key: sorted(set(groups[idx].tolist()))
                    for key, idx in zip(["train_lots", "validation_lots", "test_lots"], [train_idx, val_idx, test_idx], strict=True)
                },
            }
        )
        for name in CANDIDATES:
            fit = fit_candidate(name, x, y, cats, groups, category_sizes, train_idx, val_idx, args.epochs, args.seed + fold)
            val_pred, _ = predict_candidate(fit, x[val_idx])
            score = float(group_rows(np.abs(val_pred - y[val_idx]) / fit["y_scale"], groups[val_idx]).mean())
            validation[name].append(score)
            fitted_folds[name].append(fit)
            print(f"Fold {fold + 1}: {name} validation normalized MAE={score:.4f}, epoch={fit['best_epoch']}", flush=True)
    # Select BEFORE examining held-out test predictions. Test results are only comparison evidence.
    winner = min(CANDIDATES, key=lambda name: float(np.mean(validation[name])))
    comparison = []
    predictions_by_model = {}
    for name in CANDIDATES:
        true_rows, predicted_rows, cat_true, cat_pred, lot_ids, absolute_errors, squared_errors = [], [], [], [], [], [], []
        for (_, _, test_idx), fit in zip(folds, fitted_folds[name], strict=True):
            pred, cp = predict_candidate(fit, x[test_idx])
            for group in sorted(set(groups[test_idx])):
                mask = groups[test_idx] == group
                true_rows.append(y[test_idx][mask][0])
                predicted_rows.append(pred[mask].mean(0))
                lot_ids.append(group)
                errors = pred[mask] - y[test_idx][mask]
                absolute_errors.append(np.abs(errors).mean(0))
                squared_errors.append(np.square(errors).mean(0))
                cat_true.append(cats[test_idx][mask][0])
                cat_pred.append([int(np.bincount(cp[mask, j], minlength=n).argmax()) for j, n in enumerate(category_sizes)])
        truth, prediction = np.stack(true_rows), np.stack(predicted_rows)
        metrics = regression_metrics(truth, prediction)
        # The product accepts ONE photograph. Aggregate its errors within each lot first,
        # then give each lot equal weight; averaging predictions before errors is optimistic.
        for j, key in enumerate(NUMERIC_KEYS):
            metrics[key]["lot_mean_mae"] = metrics[key]["mae"]
            metrics[key]["mae"] = float(np.stack(absolute_errors)[:, j].mean())
            metrics[key]["rmse"] = float(np.sqrt(np.stack(squared_errors)[:, j].mean()))
        comparison.append(
            {
                "model": name,
                "validation_normalized_mae": float(np.mean(validation[name])),
                "selected": name == winner,
                "held_out_lot_count": len(truth),
                "properties": metrics,
                "category_accuracy": {key: float((np.asarray(cat_true)[:, j] == np.asarray(cat_pred)[:, j]).mean()) for j, key in enumerate(CATEGORY_KEYS)},
            }
        )
        predictions_by_model[name] = [
            {"lot_id": lot, "truth": dict(zip(NUMERIC_KEYS, t.tolist(), strict=True)), "prediction": dict(zip(NUMERIC_KEYS, p.tolist(), strict=True))}
            for lot, t, p in zip(lot_ids, truth, prediction, strict=True)
        ]
    selected = next(item for item in comparison if item["selected"])
    baseline = next(item for item in comparison if item["model"] == "mean")
    for key in NUMERIC_KEYS:
        selected["properties"][key]["beats_mean_baseline"] = selected["properties"][key]["mae"] < baseline["properties"][key]["mae"]
    epoch_count = max(1, int(np.median([fit["best_epoch"] for fit in fitted_folds[winner]])))
    all_indices = np.arange(len(records))
    fit = fit_candidate(winner, x, y, cats, groups, category_sizes, all_indices, all_indices, args.epochs, args.seed, fixed_epochs=epoch_count)
    arrays = {k: v for k, v in fit.items() if isinstance(v, np.ndarray)}
    arrays["category_defaults"] = np.asarray(fit["category_defaults"])
    np.savez_compressed(run / "parameters.npz", **arrays)
    if "head" in fit:
        torch.save(fit["head"].state_dict(), run / "head.pt")
    # Each lot contributes one reference vector. Matching is a visual comparison, never verified identity.
    lot_ids = sorted(set(groups.tolist()))
    reference = np.stack([x[groups == lot].mean(axis=(0, 1)) for lot in lot_ids])
    unit = reference / np.maximum(np.linalg.norm(reference, axis=1, keepdims=True), 1e-8)
    distances = 1 - unit @ unit.T
    np.fill_diagonal(distances, np.inf)
    threshold = float(min(1.0, distances.min(1).max() + 0.10))
    np.savez_compressed(run / "references.npz", vectors=reference)
    write_json(run / "labels.json", labels)
    report = {
        "schema_version": 1,
        "created_at": timestamp,
        "selected_model": winner,
        "selection_rule": "Mean validation normalized MAE across fixed lot-isolated folds; test metrics never select the winner.",
        "evaluation_scope": "Exploratory cross-validation on ten provisional profiles. Single-photo errors are equally weighted by lot. Model selection shares this small collection; an independent external test remains required.",
        "independent_lots": len(lot_ids),
        "training_images": len(records),
        "usable_images": manifest["usable_images"],
        "excluded_prepared_views": manifest["usable_images"] - len(records),
        "splits": split_records,
        "comparison": comparison,
        "matching_evaluation": evaluate_known_lot_matching(x, groups, args.seed),
        "held_out_predictions": predictions_by_model,
        "final_refit": {
            "lots": lot_ids,
            "epochs": fit["best_epoch"],
            "purpose": "All-lot pilot fitting after model selection; training fit is not reported as test accuracy.",
        },
        "limitations": labels["limitations"],
        "transfer_learning": getattr(args, "transfer_lineage", None),
    }
    write_json(run / "evaluation.json", report)
    files = ["backbone.pt", "parameters.npz", "references.npz", "labels.json", "evaluation.json"]
    if "head" in fit:
        files.append("head.pt")
    artifact = {
        "schema_version": 1,
        "property_version": PROPERTY_VERSION,
        "model_version": timestamp,
        "model": winner,
        "encoder": encoder_name,
        "transfer_learning": getattr(args, "transfer_lineage", None),
        "image_size": IMAGE_SIZE,
        "token_grid": TOKEN_GRID,
        "feature_channels": x.shape[2],
        "numeric_keys": NUMERIC_KEYS,
        "category_keys": CATEGORY_KEYS,
        "category_values": category_values,
        "reference_lots": lot_ids,
        "distance_threshold": threshold,
        "label_fingerprint": fingerprint(labels),
        "label_status": labels["label_status"],
        "experimental": True,
        "files": {name: digest(run / name) for name in files},
    }
    write_json(run / "artifact.json", artifact)
    if args.activate:
        temporary = output_root / ".active.json.tmp"
        write_json(temporary, {"schema_version": 1, "artifact": str((run / "artifact.json").relative_to(output_root)), "sha256": digest(run / "artifact.json")})
        from ml.quality.predictor import QualityPredictor

        # Never replace the working pointer with an artifact that cannot be served.
        QualityPredictor(temporary)
        temporary.replace(output_root / "active.json")
    print(f"Selected {winner} using validation results. Pilot artifact: {run}", flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--images", default=str(REPO_ROOT / "Lab Reports"))
    parser.add_argument("--labels", default=str(DEFAULT_LABELS))
    parser.add_argument("--backbone", default=str(REPO_ROOT / "models/quality/backbone.pt"))
    parser.add_argument(
        "--encoder", choices=["torchvision_mobilenet_v3_small_imagenet1k_v1", "timm_convnext_tiny"], default="torchvision_mobilenet_v3_small_imagenet1k_v1"
    )
    parser.add_argument("--output", default=str(REPO_ROOT / "models/quality"))
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--device", choices=["cpu", "mps", "cuda"], default="cpu")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--allow-provisional", action="store_true")
    parser.add_argument("--activate", action="store_true")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("epochs and batch size must be positive")
    train(args)


if __name__ == "__main__":
    main()
