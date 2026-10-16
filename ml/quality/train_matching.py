"""Compare and install dedicated known-lot classifiers without retraining property regression."""

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
from sklearn.model_selection import StratifiedKFold, StratifiedShuffleSplit

from ml.data.preprocessing import PreprocessConfig, load_image, normalize_array, prepare_view
from ml.quality.lot_classifier import CLASSIFIER_SIZE, PREFIX_BLOCKS, cnn_scores, fit_cnn, fit_linear, linear_scores
from ml.quality.matching import evaluate_known_lot_matching, matching_metrics
from ml.quality.model import image_tokens, make_encoder
from ml.quality.predictor import QualityPredictor, contained, sha256
from ml.quality.train import write_json
from ml.utils.paths import REPO_ROOT

CANDIDATES = ("logistic_224", "logistic_336", "cnn_finetuned_336")
NAMES = {
    "cosine_centroid": "Cosine lot centroid",
    "logistic_224": "CNN features + linear classifier (224px)",
    "logistic_336": "CNN features + linear classifier (336px)",
    "cnn_finetuned_336": "Fine-tuned CNN classifier (336px)",
}


def encode_views(records: list[dict], backbone_path: Path, batch_size: int) -> tuple[dict, torch.Tensor]:
    encoder = make_encoder(backbone_path)
    prefix = encoder[:PREFIX_BLOCKS]
    vectors224, vectors336, prefixes = [], [], []
    for offset in range(0, len(records), batch_size):
        images = [load_image(record["image_path"]) for record in records[offset : offset + batch_size]]
        vectors224.append(image_tokens(encoder, images).mean(1))
        arrays = []
        for image in images:
            view = prepare_view(image, PreprocessConfig(image_size=CLASSIFIER_SIZE))
            # Source photos are partitioned before fitting. Augmented variants never cross folds.
            variants = [view, ImageOps.mirror(view), ImageOps.flip(view), view.transpose(Image.Transpose.ROTATE_90)]
            arrays.extend(normalize_array(np.asarray(variant), PreprocessConfig(image_size=CLASSIFIER_SIZE)) for variant in variants)
        with torch.inference_mode():
            features = prefix(torch.tensor(np.stack(arrays)))
            original = features.reshape(len(images), 4, *features.shape[1:])[:, 0]
            frozen = encoder[PREFIX_BLOCKS:](original)
            vectors336.append(torch.nn.functional.adaptive_avg_pool2d(frozen, (4, 4)).flatten(2).mean(2).numpy())
            prefixes.append(features.reshape(len(images), 4, *features.shape[1:]).clone())
        print(f"Encoded classifier views: {min(offset + batch_size, len(records))}/{len(records)}", flush=True)
    # Materialize ordinary tensors: training autograd must not retain inference tensors.
    return {"logistic_224": np.concatenate(vectors224), "logistic_336": np.concatenate(vectors336)}, torch.tensor(torch.cat(prefixes).numpy())


def fit(name, vectors, views, targets, train, validation, backbone, epochs, seed, fixed_epochs=None):
    if name == "cnn_finetuned_336":
        return fit_cnn(views, targets, train, validation, backbone, epochs=epochs, seed=seed, fixed_epochs=fixed_epochs)
    return fit_linear(vectors[name], targets, train)


def predict(name, fitted, vectors, views, indices):
    if name == "cnn_finetuned_336":
        return cnn_scores(fitted["model"], views[indices, 0]).argmax(1)
    return fitted["classes"][linear_scores(fitted, vectors[name][indices]).argmax(1)]


def selection_split(targets, indices, seed):
    a, b = next(StratifiedShuffleSplit(1, test_size=0.2, random_state=seed).split(indices, targets[indices]))
    return indices[a], indices[b]


def run(args) -> dict:
    torch.set_num_threads(4)
    active = Path(args.active).resolve()
    parent = QualityPredictor(active)  # Authenticate serving weights and the exact reference-label snapshot.
    if parent.meta["label_status"] != "verified" and not args.allow_provisional:
        raise ValueError("Use --allow-provisional only for the unverified ten-lot research pilot")
    pointer = json.loads(active.read_text())
    source = contained(active.parent, pointer["artifact"]).parent
    manifest = json.loads((source / "manifest.json").read_text())
    records = [record for record in manifest["records"] if record["training_eligible"]]
    for record in records:
        if sha256(Path(record["image_path"])) != record["sha256"]:
            raise ValueError("A source photograph changed since the property-model training run")
    groups = np.asarray([record["lot_id"] for record in records])
    classes = sorted(set(groups.tolist()), key=lambda value: int(value[1:]))
    if set(classes) != set(parent.meta["reference_lots"]):
        raise ValueError("Classifier classes do not match the parent lab profiles")
    if min(np.sum(groups == value) for value in classes) < 10:
        raise ValueError("At least ten eligible photographs per lot are needed for nested image evaluation")
    targets = np.asarray([classes.index(value) for value in groups])
    output = Path(args.output).resolve()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destination = output / "runs" / timestamp
    destination.mkdir(parents=True, exist_ok=False)
    backbone = source / "backbone.pt"
    vectors, views = encode_views(records, backbone, args.batch_size)
    np.savez_compressed(destination / "classifier_features.npz", **vectors)
    # Recomputed frozen 224 features must represent the property bundle's exact source order.
    with np.load(source / "features.npz", allow_pickle=False) as archive:
        original_tokens = archive["tokens"].copy()
    if not np.allclose(vectors["logistic_224"], original_tokens.mean(1), rtol=1e-4, atol=2e-5):
        raise ValueError("Cached property features do not match the recomputed source-photo features")
    centroid = evaluate_known_lot_matching(original_tokens, groups, args.seed)
    outer = list(StratifiedKFold(5, shuffle=True, random_state=args.seed).split(targets, targets))
    held_out = np.empty(len(groups), dtype=int)
    candidate_predictions = {name: np.empty(len(groups), dtype=int) for name in CANDIDATES}
    folds = []
    for fold, (outer_train, query) in enumerate(outer):
        train, validation = selection_split(targets, outer_train, args.seed + fold)
        candidates, scores = {}, {}
        for name in CANDIDATES:
            print(f"Matching fold {fold + 1}: {NAMES[name]}", flush=True)
            fitted = fit(name, vectors, views, targets, train, validation, backbone, args.epochs, args.seed + fold)
            scores[name] = float(balanced_accuracy_score(targets[validation], predict(name, fitted, vectors, views, validation)))
            candidates[name] = fitted
        chosen = max(CANDIDATES, key=lambda name: scores[name])
        # Selection and stopping are complete before any outer-query label is examined.
        for name in CANDIDATES:
            epoch = candidates[name].get("epoch")
            refitted = fit(name, vectors, views, targets, outer_train, None, backbone, args.epochs, args.seed + fold, fixed_epochs=epoch)
            candidate_predictions[name][query] = predict(name, refitted, vectors, views, query)
        held_out[query] = candidate_predictions[chosen][query]
        folds.append(
            {
                "fold": fold + 1,
                "train_indices": train.tolist(),
                "validation_indices": validation.tolist(),
                "refit_indices": outer_train.tolist(),
                "query_indices": query.tolist(),
                "selected_model": chosen,
                "validation_scores": scores,
                "selected_epoch": candidates[chosen].get("epoch"),
            }
        )
        print(f"Fold {fold + 1} selected {chosen}; held-out accuracy={(held_out[query] == targets[query]).mean():.3f}", flush=True)
    # Final serving-model selection uses separate CV within the complete collection.
    # It cannot change the already-recorded nested outer predictions or their score.
    validation_scores = {name: [] for name in CANDIDATES}
    stopping_epochs = []
    final_folds = []
    for fold, (train, validation) in enumerate(StratifiedKFold(3, shuffle=True, random_state=args.seed + 100).split(targets, targets)):
        scores = {}
        for name in CANDIDATES:
            print(f"Final selection fold {fold + 1}: {NAMES[name]}", flush=True)
            fitted = fit(name, vectors, views, targets, train, validation, backbone, args.epochs, args.seed + 100 + fold)
            score = float(balanced_accuracy_score(targets[validation], predict(name, fitted, vectors, views, validation)))
            scores[name] = score
            validation_scores[name].append(score)
            if name == "cnn_finetuned_336":
                stopping_epochs.append(fitted["epoch"])
        final_folds.append({"train_indices": train.tolist(), "validation_indices": validation.tolist(), "scores": scores})
    means = {name: float(np.mean(value)) for name, value in validation_scores.items()}
    winner = max(CANDIDATES, key=lambda name: means[name])
    final_epochs = max(1, int(np.median(stopping_epochs))) if winner == "cnn_finetuned_336" else None
    final = fit(winner, vectors, views, targets, np.arange(len(groups)), None, backbone, args.epochs, args.seed, fixed_epochs=final_epochs)
    if winner == "cnn_finetuned_336":
        torch.save(final["model"].state_dict(), destination / "lot_classifier.pt")
        kind, filename = "cnn", "lot_classifier.pt"
    else:
        np.savez_compressed(destination / "lot_classifier.npz", **{key: value for key, value in final.items() if key != "classes"})
        kind, filename = "linear", "lot_classifier.npz"
    config = {
        "schema_version": 1,
        "kind": kind,
        "model": winner,
        "name": NAMES[winner],
        "classes": classes,
        "image_size": 224 if winner == "logistic_224" else CLASSIFIER_SIZE,
        "final_epochs": final_epochs,
        "preprocessing": "EXIF orientation, shorter-side resize, center crop, ImageNet normalization",
        "augmentations": ["original", "horizontal flip", "vertical flip", "90 degree rotation"],
        "augmentation_scope": "Training source photographs only; validation and queries use the original center view.",
        "prefix_blocks_frozen": PREFIX_BLOCKS,
        "batchnorm_statistics": "frozen ImageNet statistics",
        "version": timestamp,
    }
    meta = {**parent.meta, "model_version": timestamp, "matching_classifier": config}
    for name in parent.meta["files"]:
        if name not in {"evaluation.json", "lot_classifier.pt", "lot_classifier.npz", "lot_backbone.pt", "classifier_features.npz", "convnext_features.npz"}:
            shutil.copyfile(contained(source, name), destination / name)
    shutil.copyfile(source / "manifest.json", destination / "manifest.json")
    shutil.copyfile(source / "features.npz", destination / "features.npz")
    comparison = [
        {
            "model": "cosine_centroid",
            "name": NAMES["cosine_centroid"],
            "accuracy": centroid["accuracy"],
            "balanced_accuracy": centroid["balanced_accuracy"],
            "macro_f1": centroid["macro_f1"],
            "selected": False,
        }
    ]
    for name in CANDIDATES:
        metric = matching_metrics(groups, np.asarray(classes)[candidate_predictions[name]], classes)
        comparison.append(
            {"model": name, "name": NAMES[name], **{key: metric[key] for key in ["accuracy", "balanced_accuracy", "macro_f1"]}, "selected": name == winner}
        )
    matching = {
        **matching_metrics(groups, np.asarray(classes)[held_out], classes),
        "fold_count": 5,
        "seed": args.seed,
        "method": "Nested image evaluation: classifier selection and early stopping inside each outer training partition",
        "scope": "Exploratory held-out photos of the same ten known lots. Capture sessions and near duplicates are unconfirmed; this is not accuracy on new lots or laboratory-value accuracy.",
        "evaluation_kind": "nested_image_cv",
        "installed_model": winner,
        "installed_name": NAMES[winner],
        "selection_rule": "Inner 20% stratified validation selects classifier by balanced accuracy; refit only outer-training photos before querying held-out photos.",
        "folds": folds,
        "comparison": comparison,
        "candidate_comparison_scope": "Exploratory candidate comparisons from shared outer folds, not independent final-test scores.",
        "final_selection": {"folds": final_folds, "validation_scores": means, "model": winner, "epochs": final_epochs},
        "training_protocol": config,
        "target_accuracy": 0.85,
        "target_met": float((held_out == targets).mean()) >= 0.85,
    }
    report = {
        **parent.report,
        "matching_evaluation": matching,
        "matching_upgrade": {
            "source_artifact": pointer,
            "created_at": timestamp,
            "numeric_property_model_unchanged": True,
            "property_source_version": parent.meta["model_version"],
        },
    }
    write_json(destination / "evaluation.json", report)
    files = set(parent.meta["files"]) - {"lot_classifier.pt", "lot_classifier.npz", "lot_backbone.pt", "classifier_features.npz", "convnext_features.npz"}
    files.update([filename, "classifier_features.npz", "features.npz", "manifest.json"])
    meta["files"] = {name: sha256(destination / name) for name in sorted(files)}
    write_json(destination / "artifact.json", meta)
    # Validate the entire serving bundle before modifying its active pointer.
    temporary = output / ".matching-active.json.tmp"
    write_json(
        temporary, {"schema_version": 1, "artifact": str((destination / "artifact.json").relative_to(output)), "sha256": sha256(destination / "artifact.json")}
    )
    installed = QualityPredictor(temporary)
    # Ensure exported classifier returns a valid report label on an actual source image.
    result = installed.predict(load_image(records[0]["image_path"]))
    if result["reference"] is None or result["reference"]["lot_id"] not in classes:
        raise RuntimeError("New classifier did not return a valid reference")
    previous_accuracy = parent.report.get("matching_evaluation", {}).get("accuracy", 0)
    activated = args.activate and matching["accuracy"] >= previous_accuracy
    if activated:
        temporary.replace(output / "active.json")
    else:
        temporary.unlink()
    print(
        f"Trained candidate: {NAMES[winner]}; nested matching accuracy={matching['accuracy']:.1%}; activated={activated}; target met={matching['target_met']}",
        flush=True,
    )
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--active", default=str(REPO_ROOT / "models/quality/active.json"))
    parser.add_argument("--output", default=str(REPO_ROOT / "models/quality"))
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=12)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--allow-provisional", action="store_true")
    parser.add_argument("--activate", action="store_true")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("Epochs and batch size must be positive")
    run(args)


if __name__ == "__main__":
    main()
