"""Evaluate ConvNeXt and deterministic orientation views for known-lot classification."""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageOps
from sklearn.metrics import balanced_accuracy_score
from sklearn.model_selection import StratifiedKFold
from torchvision.models import ConvNeXt_Tiny_Weights, convnext_tiny

from ml.data.preprocessing import load_image
from ml.quality.lot_classifier import fit_linear, linear_scores
from ml.quality.matching import evaluate_known_lot_matching, matching_metrics
from ml.quality.predictor import QualityPredictor, contained, sha256
from ml.quality.train import write_json
from ml.utils.paths import REPO_ROOT

VIEW_MODES = ("single", "mean", "original_and_mean", "highres", "multiscale")
REGULARIZATION = (0.1, 1.0, 10.0)


def feature_vectors(views, mode):
    if mode == "single":
        return views[:, 0]
    if mode == "mean":
        return views[:, :4].mean(1)
    if mode == "original_and_mean":
        return np.concatenate([views[:, 0], views[:, :4].mean(1)], axis=1)
    if mode == "highres":
        return views[:, 4]
    if mode == "multiscale":
        return np.concatenate([views[:, 0], views[:, 4]], axis=1)
    raise ValueError("Unknown orientation view mode")


def encode(records, backbone, batch_size):
    model = convnext_tiny(weights=None).eval().requires_grad_(False)
    model.load_state_dict(torch.load(backbone, map_location="cpu", weights_only=True), strict=True)
    encoder = torch.nn.Sequential(model.features, model.avgpool, model.classifier[0], torch.nn.Flatten()).eval()
    transform = ConvNeXt_Tiny_Weights.IMAGENET1K_V1.transforms()
    high_transform = ConvNeXt_Tiny_Weights.IMAGENET1K_V1.transforms(crop_size=336, resize_size=354)
    rows = []
    with torch.inference_mode():
        for offset in range(0, len(records), batch_size):
            images = [load_image(record["image_path"]) for record in records[offset : offset + batch_size]]
            batch = torch.stack(
                [
                    transform(view)
                    for image in images
                    for view in [image, ImageOps.mirror(image), image.transpose(Image.Transpose.ROTATE_90), image.transpose(Image.Transpose.ROTATE_180)]
                ]
            )
            standard = encoder(batch).numpy().reshape(len(images), 4, 768)
            high = encoder(torch.stack([high_transform(image) for image in images])).numpy()
            rows.append(np.concatenate([standard, high[:, None]], axis=1))
            print(f"ConvNeXt orientation features: {min(offset + batch_size, len(records))}/{len(records)}", flush=True)
    return np.concatenate(rows)


def candidate_name(mode, c):
    return f"convnext_{mode}_c{c:g}"


def display_name(mode, c):
    names = {
        "single": "224px single view",
        "mean": "224px four-view average",
        "original_and_mean": "224px original + four-view average",
        "highres": "336px single view",
        "multiscale": "224px + 336px features",
    }
    return f"ConvNeXt + linear classifier · {names[mode]} · C={c:g}"


def evaluate_candidates(views: np.ndarray, groups: np.ndarray, seed: int = 42) -> dict:
    classes = sorted(set(groups.tolist()), key=lambda value: int(value[1:]))
    targets = np.asarray([classes.index(value) for value in groups])
    candidates = [(mode, c) for mode in VIEW_MODES for c in REGULARIZATION]
    vectors = {mode: feature_vectors(views, mode) for mode in VIEW_MODES}
    predictions = np.empty(len(groups), dtype=int)
    comparison_predictions = {candidate_name(mode, c): np.empty(len(groups), dtype=int) for mode, c in candidates}
    folds = []
    for fold, (train, query) in enumerate(StratifiedKFold(5, shuffle=True, random_state=seed).split(targets, targets)):
        scores = {}
        inner = list(StratifiedKFold(3, shuffle=True, random_state=seed + fold).split(targets[train], targets[train]))
        for mode, c in candidates:
            name = candidate_name(mode, c)
            scores[name] = []
            for a, b in inner:
                fitted = fit_linear(vectors[mode], targets, train[a], c)
                prediction = fitted["classes"][linear_scores(fitted, vectors[mode][train[b]]).argmax(1)]
                scores[name].append(float(balanced_accuracy_score(targets[train[b]], prediction)))
        means = {name: float(np.mean(values)) for name, values in scores.items()}
        chosen = max(candidates, key=lambda item: means[candidate_name(*item)])
        # Fixed-candidate refits and selected refit use only this outer fold's training photos.
        for mode, c in candidates:
            fitted = fit_linear(vectors[mode], targets, train, c)
            comparison_predictions[candidate_name(mode, c)][query] = fitted["classes"][linear_scores(fitted, vectors[mode][query]).argmax(1)]
        predictions[query] = comparison_predictions[candidate_name(*chosen)][query]
        folds.append(
            {
                "fold": fold + 1,
                "train_indices": train.tolist(),
                "query_indices": query.tolist(),
                "inner_folds": [{"train_indices": train[a].tolist(), "validation_indices": train[b].tolist()} for a, b in inner],
                "selected_model": candidate_name(*chosen),
                "validation_scores": means,
            }
        )
        print(
            f"ConvNeXt fold {fold + 1}: selected {candidate_name(*chosen)}, held-out accuracy={(predictions[query] == targets[query]).mean():.3f}", flush=True
        )
    # Serving model selection uses full-collection validation, separate from recording outer predictions.
    final_scores = {}
    final_folds = list(StratifiedKFold(3, shuffle=True, random_state=seed + 100).split(targets, targets))
    for mode, c in candidates:
        scores = []
        for train, validation in final_folds:
            fitted = fit_linear(vectors[mode], targets, train, c)
            predicted = fitted["classes"][linear_scores(fitted, vectors[mode][validation]).argmax(1)]
            scores.append(float(balanced_accuracy_score(targets[validation], predicted)))
        final_scores[candidate_name(mode, c)] = float(np.mean(scores))
    selected_mode, selected_c = max(candidates, key=lambda item: final_scores[candidate_name(*item)])
    metric = matching_metrics(groups, np.asarray(classes)[predictions], classes)
    comparison = []
    for mode, c in candidates:
        candidate = matching_metrics(groups, np.asarray(classes)[comparison_predictions[candidate_name(mode, c)]], classes)
        comparison.append(
            {
                "model": candidate_name(mode, c),
                "name": display_name(mode, c),
                "selected": (mode, c) == (selected_mode, selected_c),
                **{key: candidate[key] for key in ["accuracy", "balanced_accuracy", "macro_f1"]},
            }
        )
    return {
        **metric,
        "folds": folds,
        "fold_count": 5,
        "seed": seed,
        "comparison": comparison,
        "final_selection": {
            "view_mode": selected_mode,
            "c": selected_c,
            "validation_scores": final_scores,
            "folds": [{"train_indices": a.tolist(), "validation_indices": b.tolist()} for a, b in final_folds],
        },
    }


def run(args):
    torch.set_num_threads(2)
    source_active = Path(args.active).resolve()
    parent = QualityPredictor(source_active)
    if parent.meta["label_status"] != "verified" and not args.allow_provisional:
        raise ValueError("Use --allow-provisional only for an explicitly exploratory pilot")
    pointer = json.loads(source_active.read_text())
    source = contained(source_active.parent, pointer["artifact"]).parent
    manifest = json.loads((source / "manifest.json").read_text())
    records = [record for record in manifest["records"] if record["training_eligible"]]
    if any(sha256(Path(record["image_path"])) != record["sha256"] for record in records):
        raise ValueError("Source photographs changed after their lab-profile mapping")
    groups = np.asarray([record["lot_id"] for record in records])
    if set(groups.tolist()) != set(parent.meta["reference_lots"]) or min(np.sum(groups == value) for value in set(groups)) < 10:
        raise ValueError("Every reference lot requires at least ten eligible photographs")
    backbone = Path(args.backbone).resolve()
    if not backbone.is_file() or not sha256(backbone).startswith("983f1562"):
        raise ValueError("Install the official torchvision ConvNeXt-Tiny ImageNet1K V1 weights first")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output = Path(args.output).resolve()
    destination = output / "runs" / timestamp
    destination.mkdir(parents=True, exist_ok=False)
    if args.feature_cache:
        cache = Path(args.feature_cache).resolve()
        metadata = json.loads(cache.with_suffix(".json").read_text())
        if (
            metadata.get("source_record_hashes") != [record["sha256"] for record in records]
            or metadata.get("encoder_sha256") != sha256(backbone)
            or metadata.get("features_sha256") != sha256(cache)
        ):
            raise ValueError("Classifier feature cache does not match these source images and pretrained weights")
        with np.load(cache, allow_pickle=False) as archive:
            views = archive["views"].copy()
    else:
        views = encode(records, backbone, args.batch_size)
    if views.shape != (len(records), 5, 768) or not np.isfinite(views).all():
        raise ValueError("Invalid ConvNeXt feature cache")
    np.savez_compressed(destination / "convnext_features.npz", views=views)
    matching = evaluate_candidates(views, groups, args.seed)
    selected = matching["final_selection"]
    mode, c = selected["view_mode"], selected["c"]
    classes = matching["labels"]
    targets = np.asarray([classes.index(value) for value in groups])
    fitted = fit_linear(feature_vectors(views, mode), targets, np.arange(len(groups)), c)
    np.savez_compressed(destination / "lot_classifier.npz", **{key: value for key, value in fitted.items() if key != "classes"})
    shutil.copyfile(backbone, destination / "lot_backbone.pt")
    config = {
        "schema_version": 1,
        "kind": "linear",
        "model": candidate_name(mode, c),
        "name": display_name(mode, c),
        "classes": classes,
        "encoder": "convnext_tiny",
        "encoder_weights": "torchvision ConvNeXt_Tiny_Weights.IMAGENET1K_V1",
        "encoder_sha256": sha256(backbone),
        "view_mode": mode,
        "image_size": 336 if mode == "highres" else 224,
        "resize_size": 354 if mode == "highres" else 236,
        "input_sizes": [224, 336] if mode == "multiscale" else [336] if mode == "highres" else [224],
        "interpolation": "bilinear",
        "version": timestamp,
        "orientation_views": ["original", "horizontal flip", "90 degree rotation", "180 degree rotation"],
        "augmentation_scope": "Deterministic photo views averaged within each source; identical training and serving transforms. Each source counts once.",
        "preprocessing": "EXIF orientation, bilinear shorter-side resize 236/crop224 or resize354/crop336, ImageNet normalization",
        "c": c,
    }
    with np.load(source / "features.npz", allow_pickle=False) as archive:
        centroid = evaluate_known_lot_matching(archive["tokens"], groups, args.seed)
    matching["comparison"].insert(
        0,
        {
            "model": "cosine_centroid",
            "name": "Original cosine lot centroid",
            "accuracy": centroid["accuracy"],
            "balanced_accuracy": centroid["balanced_accuracy"],
            "macro_f1": centroid["macro_f1"],
            "selected": False,
        },
    )
    matching.update(
        {
            "method": "Nested image cross-validation of trained ConvNeXt classifiers; view mode and regularization chosen inside each training fold",
            "scope": "Exploratory held-out photos of the same ten known lots. Architecture exploration reused this collection; capture sessions and near duplicates remain unconfirmed. This is not new-lot origin or lab-value accuracy.",
            "evaluation_kind": "nested_image_cv",
            "installed_model": config["model"],
            "installed_name": config["name"],
            "selection_rule": "Three inner stratified folds select orientation view mode and regularization by balanced accuracy. Feature scaling fits only training photos; outer queries are excluded from all fitting and selection.",
            "training_protocol": config,
            "target_accuracy": 0.85,
            "target_met": matching["accuracy"] >= 0.85,
        }
    )
    report = {
        **parent.report,
        "matching_evaluation": matching,
        "matching_upgrade": {
            "source_artifact": pointer,
            "created_at": timestamp,
            "numeric_property_model_unchanged": True,
            "property_source_version": parent.report.get("matching_upgrade", {}).get("property_source_version", parent.meta["model_version"]),
        },
    }
    write_json(destination / "evaluation.json", report)
    skip = {"evaluation.json", "lot_classifier.pt", "lot_classifier.npz", "lot_backbone.pt", "classifier_features.npz", "convnext_features.npz"}
    files = {name for name in parent.meta["files"] if name not in skip}
    for name in files:
        shutil.copyfile(contained(source, name), destination / name)
    for name in ["manifest.json", "features.npz"]:
        if name not in files:
            shutil.copyfile(source / name, destination / name)
            files.add(name)
    files.update(["evaluation.json", "lot_classifier.npz", "lot_backbone.pt", "convnext_features.npz"])
    meta = {**parent.meta, "model_version": timestamp, "matching_classifier": config, "files": {name: sha256(destination / name) for name in sorted(files)}}
    write_json(destination / "artifact.json", meta)
    temporary = output / ".convnext-active.json.tmp"
    write_json(
        temporary, {"schema_version": 1, "artifact": str((destination / "artifact.json").relative_to(output)), "sha256": sha256(destination / "artifact.json")}
    )
    installed = QualityPredictor(temporary)
    # Check that numeric-array export and actual image inference use the exact same features.
    for index in [0, len(records) // 2, len(records) - 1]:
        expected = classes[int(linear_scores(fitted, feature_vectors(views[index : index + 1], mode)).argmax(1)[0])]
        actual = installed.predict(load_image(records[index]["image_path"]))
        if actual["reference"] is None or actual["reference"]["lot_id"] != expected:
            raise RuntimeError("Exported classifier does not match evaluated source-photo preprocessing")
    # Never silently replace a better installed matching procedure with a lower observed score.
    previous_accuracy = parent.report.get("matching_evaluation", {}).get("accuracy", 0)
    if args.activate and matching["accuracy"] >= previous_accuracy:
        temporary.replace(output / "active.json")
        activated = True
    else:
        temporary.unlink()
        activated = False
    print(
        f"ConvNeXt selected {config['name']}; nested accuracy={matching['accuracy']:.1%}, activated={activated}, target met={matching['target_met']}",
        flush=True,
    )
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--active", default=str(REPO_ROOT / "models/quality/active.json"))
    parser.add_argument("--backbone", default=str(REPO_ROOT / "models/quality/encoders/convnext_tiny-983f1562.pth"))
    parser.add_argument("--output", default=str(REPO_ROOT / "models/quality"))
    parser.add_argument("--feature-cache")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--allow-provisional", action="store_true")
    parser.add_argument("--activate", action="store_true")
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("Batch size must be positive")
    run(args)


if __name__ == "__main__":
    main()
