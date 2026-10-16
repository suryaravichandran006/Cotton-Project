"""Strict artifact loading and experimental single-photo inference; no mock lab measurements."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from ml.data.preprocessing import PreprocessConfig, load_image, prepare_view
from ml.quality.data import fingerprint, read_labels
from ml.quality.model import FEATURE_CHANNELS, IMAGE_SIZE, TOKEN_GRID, QualityHead, image_tokens, make_encoder
from ml.quality.schema import CATEGORY_KEYS, NUMERIC_KEYS, PROPERTIES, PROPERTY_VERSION


class QualityArtifactError(RuntimeError):
    pass


def contained(root: Path, name: str) -> Path:
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()):
        raise QualityArtifactError("Artifact path escapes its model directory")
    return path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def capture_checks(image: Image.Image) -> dict:
    view = prepare_view(load_image(image), PreprocessConfig(image_size=IMAGE_SIZE))
    gray = np.asarray(view.convert("L"), dtype=np.float32)
    lap = -4 * gray[1:-1, 1:-1] + gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:]
    brightness, focus = float(gray.mean()), float(lap.var())
    reasons = []
    if brightness < 35 or brightness > 245:
        reasons.append("The photograph is too dark or overexposed. Use even light and retake it.")
    if focus < 2:
        reasons.append("The photograph has too little visible detail. Move closer, focus on the cotton and retake it.")
    return {
        "passed": not reasons,
        "brightness": brightness,
        "focus_score": focus,
        "reasons": reasons,
        "scope": "Focus/exposure checks only; these do not verify cotton identity.",
    }


class QualityPredictor:
    def __init__(self, active_path: str | Path):
        active_path = Path(active_path).resolve()
        pointer = json.loads(active_path.read_text())
        if pointer.get("schema_version") != 1:
            raise QualityArtifactError("Unsupported activation schema")
        artifact_path = contained(active_path.parent, pointer["artifact"])
        if sha256(artifact_path) != pointer["sha256"]:
            raise QualityArtifactError("Active artifact checksum mismatch")
        meta = json.loads(artifact_path.read_text())
        encoder_name = meta.get("encoder", "torchvision_mobilenet_v3_small_imagenet1k_v1")
        channels = 768 if encoder_name == "timm_convnext_tiny" else FEATURE_CHANNELS
        if (
            meta.get("schema_version") != 1
            or meta.get("property_version") != PROPERTY_VERSION
            or meta.get("numeric_keys") != NUMERIC_KEYS
            or meta.get("category_keys") != CATEGORY_KEYS
            or meta.get("model") not in {"mean", "ridge", "cnn", "cnn_lstm"}
            or encoder_name not in {"timm_convnext_tiny", "torchvision_mobilenet_v3_small_imagenet1k_v1"}
            or meta.get("feature_channels") != channels
            or meta.get("image_size") != IMAGE_SIZE
            or meta.get("token_grid") != TOKEN_GRID
            or meta.get("experimental") is not True
        ):
            raise QualityArtifactError("Incompatible quality artifact")
        root = artifact_path.parent
        required = {"backbone.pt", "parameters.npz", "references.npz", "labels.json", "evaluation.json"}
        if meta["model"] in {"cnn", "cnn_lstm"}:
            required.add("head.pt")
        classifier_config = meta.get("matching_classifier")
        if classifier_config:
            if encoder_name == "timm_convnext_tiny" and classifier_config.get("encoder") != "timm_convnext_tiny":
                raise QualityArtifactError("Progressive matching and properties must share the transferred backbone")
            if classifier_config.get("kind") not in {"linear", "cnn"}:
                raise QualityArtifactError("Unsupported lot classifier kind")
            if set(classifier_config.get("classes", [])) != set(meta["reference_lots"]):
                raise QualityArtifactError("Lot classifier classes do not match references")
            required.add("lot_classifier.npz" if classifier_config["kind"] == "linear" else "lot_classifier.pt")
            if classifier_config.get("encoder") == "convnext_tiny":
                required.add("lot_backbone.pt")
                if classifier_config.get("encoder_sha256") != meta.get("files", {}).get("lot_backbone.pt"):
                    raise QualityArtifactError("Lot classifier encoder fingerprint mismatch")
            if classifier_config.get("encoder") == "timm_convnext_tiny":
                if encoder_name != "timm_convnext_tiny" or classifier_config.get("encoder_sha256") != meta.get("files", {}).get("backbone.pt"):
                    raise QualityArtifactError("Progressive classifier must use the verified property backbone")
        if not required <= set(meta.get("files", {})):
            raise QualityArtifactError("Incomplete model files")
        for name in required:
            if sha256(contained(root, name)) != meta["files"][name]:
                raise QualityArtifactError(f"Checksum mismatch: {name}")
        self.labels = read_labels(root / "labels.json")
        if fingerprint(self.labels) != meta["label_fingerprint"]:
            raise QualityArtifactError("Lab labels do not match model")
        self.report = json.loads((root / "evaluation.json").read_text())
        if encoder_name == "timm_convnext_tiny":
            lineage = meta.get("transfer_learning") or {}
            if (
                lineage.get("route") != "progressive"
                or lineage.get("stages") != ["ImageNet", "cotton leaves", "cotton seeds"]
                or lineage.get("transferred_tensors") != 180
                or lineage.get("exported_backbone_sha256") != meta["files"]["backbone.pt"]
                or self.report.get("transfer_learning") != lineage
            ):
                raise QualityArtifactError("Missing or inconsistent progressive transfer lineage")
        self.meta = meta
        with np.load(root / "parameters.npz", allow_pickle=False) as archive:
            self.params = {k: archive[k].copy() for k in archive.files}
        shapes = {
            "x_mean": (channels,),
            "x_scale": (channels,),
            "y_mean": (len(NUMERIC_KEYS),),
            "y_scale": (len(NUMERIC_KEYS),),
            "category_defaults": (len(CATEGORY_KEYS),),
        }
        if meta["model"] == "ridge":
            shapes.update({"coef": (len(NUMERIC_KEYS), channels), "intercept": (len(NUMERIC_KEYS),)})
        for key, shape in shapes.items():
            if key not in self.params or self.params[key].shape != shape or not np.isfinite(self.params[key]).all():
                raise QualityArtifactError(f"Invalid parameter: {key}")
        if np.any(self.params["x_scale"] <= 0) or np.any(self.params["y_scale"] <= 0):
            raise QualityArtifactError("Invalid normalization scale")
        with np.load(root / "references.npz", allow_pickle=False) as archive:
            self.references = archive["vectors"].copy()
        if self.references.shape != (len(meta["reference_lots"]), channels) or not np.isfinite(self.references).all():
            raise QualityArtifactError("Invalid reference vectors")
        self.encoder = make_encoder(root / "backbone.pt", encoder_name=encoder_name)
        self.lot_classifier = None
        if classifier_config:
            from ml.quality.lot_classifier import InstalledLotClassifier

            self.lot_classifier = InstalledLotClassifier(root, classifier_config, root / "backbone.pt", property_encoder=self.encoder)
        self.head = None
        if meta["model"] in {"cnn", "cnn_lstm"}:
            self.head = QualityHead(meta["model"], channels, len(NUMERIC_KEYS), [len(v) for v in meta["category_values"]])
            self.head.load_state_dict(torch.load(root / "head.pt", map_location="cpu", weights_only=True), strict=True)
            self.head.eval()
        self.metrics = next(item for item in self.report["comparison"] if item["selected"])
        self.baseline_metrics = next(item for item in self.report["comparison"] if item["model"] == "mean")

    def status(self) -> dict:
        return {
            "status": "ready",
            "experimental": True,
            "model": self.meta["model"],
            "version": self.meta["model_version"],
            "label_status": self.meta["label_status"],
            "independent_lots": self.report["independent_lots"],
            "training_images": self.report["training_images"],
            "selection_rule": self.report["selection_rule"],
            "evaluation_scope": self.report["evaluation_scope"],
            "comparison": self.report["comparison"],
            "matching": self.report.get("matching_evaluation"),
            "protocol": {
                "encoder": "ConvNeXt-Tiny transferred through cotton leaves and seeds (frozen for final tasks)"
                if self.meta.get("encoder") == "timm_convnext_tiny"
                else "ImageNet-pretrained MobileNetV3-Small (frozen)",
                "transfer_learning": self.meta.get("transfer_learning"),
                "spatial_steps": TOKEN_GRID * TOKEN_GRID,
                "numeric_outputs": len(NUMERIC_KEYS),
                "regression_fold_count": len(self.report.get("splits", [])),
                "final_epochs": self.report.get("final_refit", {}).get("epochs"),
                "matching_model": self.meta.get("matching_classifier", {}).get("name", "Cosine lot centroid"),
                "matching_image_size": self.meta.get("matching_classifier", {}).get("image_size", IMAGE_SIZE),
                "matching_encoder": self.meta.get("matching_classifier", {}).get(
                    "encoder", "timm_convnext_tiny" if self.meta.get("encoder") == "timm_convnext_tiny" else "mobilenet_v3_small"
                ),
                "matching_resolutions": self.meta.get("matching_classifier", {}).get(
                    "input_sizes", [self.meta.get("matching_classifier", {}).get("image_size", IMAGE_SIZE)]
                ),
            },
            "limitations": self.report["limitations"],
            "message": "Experimental model available. Photo-to-lab provenance and external accuracy remain unverified.",
        }

    def predict(self, image: Image.Image) -> dict:
        capture = capture_checks(image)
        properties = []
        categories = self.params["category_defaults"].astype(int)
        reference = None
        reason = None if capture["passed"] else "capture_quality"
        values = None
        if capture["passed"]:
            tokens = image_tokens(self.encoder, [image])
            vector = tokens.mean(axis=(0, 1))
            ref_norm = self.references / np.maximum(np.linalg.norm(self.references, axis=1, keepdims=True), 1e-8)
            vector = vector / max(float(np.linalg.norm(vector)), 1e-8)
            distance = 1 - ref_norm @ vector
            order = np.argsort(distance)
            best = int(order[0])
            envelope_distance = float(distance[best])
            if self.lot_classifier:
                matched_lot = self.lot_classifier.predict(image, tokens)
                best = self.meta["reference_lots"].index(matched_lot)
            ref_lot = self.meta["reference_lots"][best]
            reference = {
                "lot_id": ref_lot,
                "cosine_distance": float(distance[best]),
                "identity_verified": False,
                "method": self.meta.get("matching_classifier", {}).get("model", "cosine_centroid"),
                "matcher_name": self.meta.get("matching_classifier", {}).get("name", "Cosine lot centroid"),
                "note": "Experimental known-lot classifier match; this does not verify the photographed lot or its origin."
                if self.lot_classifier
                else "Closest visual reference only; this does not identify the photographed lot.",
                "report": next(lot for lot in self.labels["lots"] if lot["lot_id"] == ref_lot),
            }
            # Capture-envelope checking is independent of the classifier's assigned label.
            if envelope_distance > self.meta["distance_threshold"]:
                reason = "outside_reference_capture"
            x = (tokens - self.params["x_mean"]) / self.params["x_scale"]
            if self.meta["model"] == "mean":
                values = self.params["y_mean"]
            elif self.meta["model"] == "ridge":
                values = (x.mean(1) @ self.params["coef"].T + self.params["intercept"])[0] * self.params["y_scale"] + self.params["y_mean"]
            else:
                with torch.inference_mode():
                    numeric, logits = self.head(torch.tensor(x))
                values = numeric.numpy()[0] * self.params["y_scale"] + self.params["y_mean"]
                categories = np.asarray([int(p.argmax(1)[0]) for p in logits])
            if not np.isfinite(values).all():
                raise QualityArtifactError("Model returned non-finite measurements")
        for j, prop in enumerate(PROPERTIES):
            metric = self.metrics["properties"][prop.key]
            value = float(values[j]) if values is not None and reason is None else None
            invalid = value is not None and (value < prop.minimum or (prop.maximum is not None and value > prop.maximum))
            properties.append(
                {
                    **prop.to_dict(),
                    "value": None if invalid else value,
                    "status": "withheld" if reason or invalid else "experimental_estimate",
                    "observed_mae": metric["mae"],
                    "beats_mean_baseline": metric.get("beats_mean_baseline", False),
                    "note": "Outside physical limits; estimate withheld."
                    if invalid
                    else "Single-photo errors are equally weighted by held-out lot; this is not a prediction interval.",
                }
            )
        for j, (key, label, code) in enumerate([(CATEGORY_KEYS[0], "Colour grade", "CGrd"), (CATEGORY_KEYS[1], "Trash grade", "TrGrd")]):
            accuracy = self.metrics["category_accuracy"][key]
            supported = accuracy > self.baseline_metrics["category_accuracy"][key]
            properties.append(
                {
                    "key": key,
                    "label": label,
                    "code": code,
                    "unit": None,
                    "decimals": 0,
                    "value": self.meta["category_values"][j][int(categories[j])] if reason is None and supported else None,
                    "status": "withheld" if reason else "experimental_estimate" if supported else "not_validated",
                    "observed_mae": None,
                    "beats_mean_baseline": supported,
                    "note": f"Held-out lot category accuracy: {accuracy:.0%}. "
                    + ("Sparse grade labels; not externally validated." if supported else "No improvement over the baseline; grade prediction is withheld."),
                }
            )
        for key, label, note in [
            ("grade", "Grade", "This field is blank in the source report."),
            ("amt", "Amount (Amt)", "Instrument field meaning is unconfirmed; no estimate is produced."),
        ]:
            properties.append(
                {
                    "key": key,
                    "label": label,
                    "code": "Grade" if key == "grade" else "Amt",
                    "unit": None,
                    "decimals": 0,
                    "value": None,
                    "status": "not_available",
                    "observed_mae": None,
                    "beats_mean_baseline": False,
                    "note": note,
                }
            )
        warnings = [
            "Experimental estimates from ten provisional lot profiles. These are not HVI laboratory measurements.",
            "Cotton identity and photo-to-lab provenance have not been verified. No calibrated prediction intervals are available.",
        ]
        if self.meta["model"] == "mean":
            warnings.append(
                "The mean baseline won model selection. These values do not depend on cotton appearance; image-based improvement was not established."
            )
        if reason == "outside_reference_capture":
            warnings.append("This photograph differs from the reference captures. Estimates are withheld; retake a close, evenly lit photo of loose cotton.")
        warnings.extend(capture["reasons"])
        return {
            "status": "withheld" if reason else "experimental",
            "withheld_reason": reason,
            "model": {
                "name": self.meta["model"],
                "version": self.meta["model_version"],
                "experimental": True,
                "label_status": self.meta["label_status"],
                "independent_lots": self.report["independent_lots"],
            },
            "properties": properties,
            "capture": capture,
            "reference": reference,
            "warnings": warnings,
            "label_fingerprint": self.meta["label_fingerprint"],
        }
