"""Connect the original ImageNet -> leaf -> seed weights to both final cotton tasks.

The progressive route is fixed by the research question, not chosen using outer
test scores. Direct and leaf-only routes use identical photo folds and settings
as descriptive controls. This remains an exploratory known-lot image study.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import torch
from PIL import Image, ImageOps
from torchvision.models import ConvNeXt_Tiny_Weights

from ml.data.preprocessing import load_image
from ml.quality.data import DEFAULT_LABELS, build_manifest, read_labels
from ml.quality.lot_classifier import fit_linear, linear_scores
from ml.quality.predictor import QualityPredictor
from ml.quality.progressive_encoder import ENCODER, TimmCottonEncoder, checkpoint_backbone, digest
from ml.quality.train import train, write_json
from ml.quality.train_convnext_matching import display_name, evaluate_candidates, feature_vectors
from ml.utils.paths import REPO_ROOT

ROUTES = {
    "direct": "ImageNet → cotton",
    "leaf": "ImageNet → leaves → cotton",
    "progressive": "ImageNet → leaves → seeds → cotton",
}


def encode_views(records, backbone, batch_size, device="cpu"):
    encoder = TimmCottonEncoder(backbone).to(device)
    transform = ConvNeXt_Tiny_Weights.IMAGENET1K_V1.transforms()
    high_transform = ConvNeXt_Tiny_Weights.IMAGENET1K_V1.transforms(crop_size=336, resize_size=354)
    rows = []
    with torch.inference_mode():
        for offset in range(0, len(records), batch_size):
            images = [load_image(record["image_path"]) for record in records[offset : offset + batch_size]]
            variants = [
                view
                for image in images
                for view in [image, ImageOps.mirror(image), image.transpose(Image.Transpose.ROTATE_90), image.transpose(Image.Transpose.ROTATE_180)]
            ]
            standard = encoder.pooled(torch.stack([transform(view) for view in variants]).to(device)).cpu().numpy().reshape(len(images), 4, 768)
            high = encoder.pooled(torch.stack([high_transform(image) for image in images]).to(device)).cpu().numpy()
            rows.append(np.concatenate([standard, high[:, None]], axis=1))
            print(f"{backbone.stem}: encoded {min(offset + batch_size, len(records))}/{len(records)}", flush=True)
    return np.concatenate(rows)


def cached_views(records, backbone, cache, batch_size, device="cpu"):
    signature = {
        "encoder_sha256": digest(backbone),
        "source_record_hashes": [record["sha256"] for record in records],
        "encoder": ENCODER,
        "preprocessing": "torchvision_bilinear_236_crop224_354_crop336_v1",
    }
    meta_path = cache.with_suffix(".json")
    if cache.is_file() and meta_path.is_file():
        saved = json.loads(meta_path.read_text())
        if any(saved.get(key) != value for key, value in signature.items()) or saved.get("features_sha256") != digest(cache):
            raise ValueError("Cached features do not match the exact checkpoint, photos and preprocessing")
        with np.load(cache, allow_pickle=False) as data:
            views = data["views"].copy()
    else:
        views = encode_views(records, backbone, batch_size, device)
        np.savez_compressed(cache, views=views)
        write_json(meta_path, {**signature, "features_sha256": digest(cache)})
    if views.shape != (len(records), 5, 768) or not np.isfinite(views).all():
        raise ValueError("Invalid progressive encoder features")
    return views


def run(args):
    torch.set_num_threads(4)
    output = Path(args.output).resolve()
    encoders = output / "encoders"
    encoders.mkdir(parents=True, exist_ok=True)
    metadata = json.loads(Path(args.checkpoints).read_text())
    proofs, weights = {}, {}
    for stage, route in [("leaf", "leaf"), ("seed", "progressive")]:
        record = metadata["checkpoints"][stage]
        source = REPO_ROOT / record["path"]
        if digest(source) != record["sha256"]:
            raise ValueError(f"Original {stage} checkpoint changed")
        state, proof = checkpoint_backbone(source, stage)
        path = encoders / f"{stage}_convnext_tiny.pt"
        # Keep existing validated exports stable so their feature caches remain reusable.
        if not path.exists():
            torch.save(state, path)
        restored = torch.load(path, map_location="cpu", weights_only=True)
        if set(restored) != set(state) or any(not torch.equal(state[key], restored[key]) for key in state):
            raise ValueError("Existing backbone export differs from the original checkpoint")
        proof["exported_backbone_sha256"] = digest(path)
        proofs[route], weights[route] = proof, path
    # This matches the pretraining identifier recorded in the supplied notebook.
    direct = Path(args.direct_backbone).resolve()
    direct_meta = json.loads(direct.with_suffix(".json").read_text())
    if direct_meta.get("model") != "timm/convnext_tiny.in12k_ft_in1k" or direct_meta.get("sha256") != digest(direct):
        raise ValueError("Direct control requires the original official timm pretraining weights")
    TimmCottonEncoder(direct)
    weights["direct"] = direct
    proofs["progressive"]["available_leaf_checkpoint_sha256"] = metadata["checkpoints"]["leaf"]["sha256"]
    labels = read_labels(args.labels)
    if labels["label_status"] != "verified" and not args.allow_provisional:
        raise ValueError("Use --allow-provisional for this explicitly exploratory collection")
    manifest = build_manifest(args.images, labels)
    records = [record for record in manifest["records"] if record["training_eligible"]]
    groups = np.asarray([record["lot_id"] for record in records])
    evaluations, features = {}, {}
    for route in ROUTES:
        print(f"Evaluating controlled route: {ROUTES[route]}", flush=True)
        features[route] = cached_views(records, weights[route], encoders / f"{route}_cotton_views.npz", args.batch_size, args.device)
        evaluations[route] = evaluate_candidates(features[route], groups, args.seed)
    # New property heads are fitted using the SAME transferred seed backbone.
    # Lot-isolated regression folds are separate from image-level matching folds.
    report = train(
        SimpleNamespace(
            images=args.images,
            labels=args.labels,
            backbone=weights["progressive"],
            output=output,
            epochs=args.epochs,
            batch_size=args.batch_size,
            seed=args.seed,
            allow_provisional=args.allow_provisional,
            activate=False,
            encoder=ENCODER,
            transfer_lineage=proofs["progressive"],
            device=args.device,
        )
    )
    destination = output / "runs" / report["created_at"]
    matching = evaluations["progressive"]
    selected = matching["final_selection"]
    mode, c = selected["view_mode"], selected["c"]
    classes = matching["labels"]
    targets = np.asarray([classes.index(value) for value in groups])
    fitted = fit_linear(feature_vectors(features["progressive"], mode), targets, np.arange(len(groups)), c)
    np.savez_compressed(destination / "lot_classifier.npz", **{key: value for key, value in fitted.items() if key != "classes"})
    config = {
        "schema_version": 1,
        "kind": "linear",
        "model": f"progressive_{mode}_c{c:g}",
        "name": f"Leaf → seed → cotton · {display_name(mode, c)}",
        "classes": classes,
        "encoder": ENCODER,
        "encoder_sha256": digest(weights["progressive"]),
        "view_mode": mode,
        "image_size": 336 if mode == "highres" else 224,
        "resize_size": 354 if mode == "highres" else 236,
        "input_sizes": [224, 336] if mode == "multiscale" else [336] if mode == "highres" else [224],
        "interpolation": "bilinear",
        "c": c,
    }
    matching.update(
        {
            "method": "Fixed progressive backbone; nested image CV selects final matching views and regularization inside each training fold",
            "scope": "Exploratory held-out photos of the same ten known lots. Earlier architecture exploration reused this collection; capture sessions and near duplicates remain unconfirmed. This is not new-lot, cultivar or lab-value accuracy.",
            "evaluation_kind": "nested_image_cv",
            "installed_model": config["model"],
            "installed_name": config["name"],
            "selection_rule": "The progressive route is fixed by the research question. Three inner folds select views/C; every outer query is excluded from scaling, fitting and selection.",
            "target_accuracy": 0.85,
            "target_met": matching["accuracy"] >= 0.85,
            "route_comparison": [
                {
                    "route": route,
                    "name": name,
                    "accuracy": evaluations[route]["accuracy"],
                    "macro_f1": evaluations[route]["macro_f1"],
                    "installed": route == "progressive",
                }
                for route, name in ROUTES.items()
            ],
            "route_comparison_scope": "Identical outer/inner photo splits and classifier candidates for all routes. Descriptive same-collection comparison; the installed route was not selected using these test scores. No seed-only-from-ImageNet checkpoint was available.",
        }
    )
    report["matching_evaluation"] = matching
    report["transfer_route_evaluations"] = evaluations
    report["transfer_controls"] = {
        "direct_pretraining": direct_meta["model"],
        "direct_backbone_sha256": digest(direct),
        "leaf": proofs["leaf"],
        "progressive": proofs["progressive"],
    }
    write_json(destination / "evaluation.json", report)
    meta = json.loads((destination / "artifact.json").read_text())
    meta["matching_classifier"] = config
    for name in ["evaluation.json", "lot_classifier.npz", "manifest.json", "features.npz"]:
        meta["files"][name] = digest(destination / name)
    write_json(destination / "artifact.json", meta)
    temporary = output / ".progressive-active.json.tmp"
    write_json(
        temporary, {"schema_version": 1, "artifact": str((destination / "artifact.json").relative_to(output)), "sha256": digest(destination / "artifact.json")}
    )
    installed = QualityPredictor(temporary)
    for index in [0, len(records) // 2, len(records) - 1]:
        expected = classes[int(linear_scores(fitted, feature_vectors(features["progressive"][index : index + 1], mode)).argmax(1)[0])]
        actual = installed.predict(load_image(records[index]["image_path"]))
        if actual["reference"] is None or actual["reference"]["lot_id"] != expected:
            raise RuntimeError("Serving features differ from evaluated features")
    if args.activate:
        temporary.replace(output / "active.json")
    else:
        temporary.unlink()
    print(
        json.dumps(
            {
                "artifact": str(destination),
                "matching_accuracy": matching["accuracy"],
                "property_model": meta["model"],
                "route_comparison": matching["route_comparison"],
                "activated": args.activate,
            }
        ),
        flush=True,
    )
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoints", default=str(REPO_ROOT / "data/metadata/transfer_checkpoints.json"))
    parser.add_argument("--images", default=str(REPO_ROOT / "Lab Reports"))
    parser.add_argument("--labels", default=str(DEFAULT_LABELS))
    parser.add_argument("--output", default=str(REPO_ROOT / "models/quality"))
    parser.add_argument("--direct-backbone", default=str(REPO_ROOT / "models/quality/encoders/timm_convnext_tiny_in12k_ft_in1k.pt"))
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--device", choices=["cpu", "mps", "cuda"], default="cpu")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--allow-provisional", action="store_true")
    parser.add_argument("--activate", action="store_true")
    args = parser.parse_args()
    if args.batch_size < 1 or args.epochs < 1:
        parser.error("Batch size and epochs must be positive")
    run(args)


if __name__ == "__main__":
    main()
