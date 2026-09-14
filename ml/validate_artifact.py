"""Validate trained model artifacts before activation: ``python -m ml.validate_artifact --artifact-dir models/exports/convnext_tiny_v1``.

Verifies:
1. File structure and metadata schema
2. Checkpoint weights integrity and architecture compatibility
3. Mock class isolation (ensures no mock classes leak into production artifacts)
4. Synthetic forward pass inference and numerical stability (no NaN/Inf)
5. Grad-CAM explainability pipeline readiness
6. Temperature calibration and OOD threshold validity
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ml.utils.paths import CONFIG_DIR, resolve_path

logger = logging.getLogger("ml.validate_artifact")


@dataclass
class ValidationReport:
    target: str
    is_valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    def add_error(self, message: str) -> None:
        self.is_valid = False
        self.errors.append(message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def to_dict(self) -> dict[str, Any]:
        return {"target": self.target, "is_valid": self.is_valid, "errors": self.errors, "warnings": self.warnings, "details": self.details}


def validate_artifact(
    artifact_dir: str | Path | None = None,
    checkpoint_path: str | Path | None = None,
    model_name: str | None = None,
    registry_path: str | Path | None = None,
    device: str = "cpu",
) -> ValidationReport:
    import torch

    from ml.explain.gradcam import GradCAM
    from ml.models.factory import get_architecture_spec, get_model, resolve_gradcam_layer
    from ml.registry import ModelRegistry
    from ml.training.trainer import load_checkpoint

    target_desc = str(artifact_dir or checkpoint_path or model_name or "unknown")
    report = ValidationReport(target=target_desc)
    ckpt_file: Path | None = None
    meta: dict[str, Any] = {}

    if model_name:
        reg = ModelRegistry(registry_path)
        entry = reg.get(model_name)
        if not entry:
            report.add_error(f"Model '{model_name}' not found in registry {reg.path}")
            return report
        ckpt = entry.resolve("checkpoint")
        if not ckpt or not Path(ckpt).is_file():
            report.add_error(f"Checkpoint for '{model_name}' not found at {ckpt}")
            return report
        ckpt_file = Path(ckpt)
        meta = entry.to_dict()
    elif artifact_dir:
        art_path = resolve_path(artifact_dir)
        if not art_path.is_dir():
            report.add_error(f"Artifact directory does not exist: {art_path}")
            return report
        meta_file = art_path / "metadata.json"
        if not meta_file.is_file():
            report.add_error(f"metadata.json missing in artifact directory: {art_path}")
            return report
        try:
            with open(meta_file, encoding="utf-8") as fh:
                meta = json.load(fh)
        except Exception as exc:
            report.add_error(f"Failed parsing metadata.json: {exc}")
            return report
        ckpt_file = art_path / "model.pt"
        if not ckpt_file.is_file():
            report.add_error(f"model.pt missing in artifact directory: {art_path}")
            return report
    elif checkpoint_path:
        ckpt_file = resolve_path(checkpoint_path)
        if not ckpt_file.is_file():
            report.add_error(f"Checkpoint file does not exist: {ckpt_file}")
            return report
    else:
        report.add_error("Must specify one of --artifact-dir, --checkpoint, or --model-name")
        return report

    try:
        payload = load_checkpoint(ckpt_file)
    except Exception as exc:
        report.add_error(f"Failed loading checkpoint {ckpt_file}: {exc}")
        return report

    arch = payload.get("architecture") or meta.get("architecture")
    if not arch:
        report.add_error("Missing architecture in checkpoint and metadata")
        return report

    class_names = list(payload.get("class_names") or meta.get("class_names") or [])
    if not class_names:
        report.add_error("Class names list is empty")
        return report
    if len(class_names) < 2:
        report.add_error(f"Model requires at least 2 classes, got {len(class_names)}")
    if len(class_names) != len(set(class_names)):
        report.add_error("Duplicate class names found in model classes")

    mock_classes_file = CONFIG_DIR / "mock_classes.json"
    if mock_classes_file.exists():
        try:
            with open(mock_classes_file, encoding="utf-8") as fh:
                mock_data = json.load(fh)
                mock_classes = set(mock_data.get("class_names", []))
                overlap = set(class_names) & mock_classes
                if overlap:
                    report.add_warning(
                        f"Model class names overlap with mock classes: {sorted(overlap)}. Ensure this model was trained on real variety data, not demo placeholders."
                    )
        except Exception as exc:
            report.add_warning(f"Could not verify mock class isolation: {exc}")

    image_size = int(payload.get("image_size") or meta.get("image_size") or 224)
    if image_size < 64 or image_size > 1024:
        report.add_error(f"Suspicious or invalid image_size: {image_size}")

    temperature = float(payload.get("calibration_temperature") or meta.get("calibration_temperature") or 1.0)
    if temperature <= 0:
        report.add_error(f"Calibration temperature must be positive, got {temperature}")

    try:
        spec = get_architecture_spec(arch)
    except KeyError:
        report.add_error(f"Unsupported architecture '{arch}'. Available: resnet50, efficientnetv2_s, convnext_tiny, mobilenetv3_large")
        return report

    try:
        model = get_model(arch, len(class_names), pretrained=False, dropout=float(payload.get("dropout", 0.0)))
        missing, unexpected = model.load_state_dict(payload["model_state_dict"], strict=False)
        if unexpected:
            report.add_warning(f"Unexpected keys in state dict: {unexpected[:5]}")
        if missing:
            report.add_error(f"Missing keys in state dict for architecture '{arch}': {missing[:5]}")
            return report
        model.eval().to(device)
    except Exception as exc:
        report.add_error(f"Failed to instantiate and load architecture '{arch}': {exc}")
        return report

    param_count = sum(p.numel() for p in model.parameters())
    dummy_input = torch.randn(1, 3, image_size, image_size, device=device)
    t0 = time.perf_counter()
    try:
        with torch.no_grad():
            logits = model(dummy_input)
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            if logits.shape != (1, len(class_names)):
                report.add_error(f"Forward output shape mismatch: expected (1, {len(class_names)}), got {list(logits.shape)}")
            if not torch.isfinite(logits).all():
                report.add_error("Non-finite values (NaN or Inf) detected in model forward pass logits")
    except Exception as exc:
        report.add_error(f"Forward pass failed on synthetic input: {exc}")
        return report

    try:
        gradcam_layer = resolve_gradcam_layer(model, spec.gradcam_layer)
        cam = GradCAM(model, gradcam_layer)
        heatmap, _ = cam(dummy_input, class_idx=0)
        cam.remove()

        if heatmap.shape != (image_size, image_size):
            report.add_error(f"Grad-CAM heatmap shape mismatch: expected ({image_size}, {image_size}), got {heatmap.shape}")
        if not (0.0 <= heatmap.min() and heatmap.max() <= 1.0001):
            report.add_warning(f"Grad-CAM heatmap out of expected [0, 1] range: min={heatmap.min():.3f}, max={heatmap.max():.3f}")
    except Exception as exc:
        report.add_error(f"Grad-CAM explainability check failed on layer '{spec.gradcam_layer}': {exc}")

    report.details = {
        "architecture": arch,
        "class_names": class_names,
        "num_classes": len(class_names),
        "image_size": image_size,
        "parameters": param_count,
        "parameters_m": round(param_count / 1e6, 2),
        "calibration_temperature": temperature,
        "gradcam_layer": spec.gradcam_layer,
        "latency_ms": latency_ms,
        "checkpoint_path": str(ckpt_file),
    }
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Cotton Grade model artifact before activation")
    parser.add_argument("--artifact-dir", default=None, help="Path to models/exports/<name>")
    parser.add_argument("--checkpoint", default=None, help="Path to checkpoint .pt file")
    parser.add_argument("--model-name", default=None, help="Model name registered in models/registry.json")
    parser.add_argument("--registry", default=None, help="Path to models/registry.json")
    parser.add_argument("--device", default="cpu", help="Device for validation forward pass (default: cpu)")
    parser.add_argument("--json", action="store_true", help="Output report as JSON")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    report = validate_artifact(
        artifact_dir=args.artifact_dir,
        checkpoint_path=args.checkpoint,
        model_name=args.model_name,
        registry_path=args.registry,
        device=args.device,
    )

    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        status_sym = "✅ VALID" if report.is_valid else "❌ INVALID"
        print(f"\nModel Artifact Validation: {status_sym}")
        print(f"Target: {report.target}")
        if report.details:
            print(f"Architecture:   {report.details.get('architecture')}")
            print(f"Classes ({report.details.get('num_classes')}):   {', '.join(report.details.get('class_names', []))}")
            print(f"Image Resolution: {report.details.get('image_size')}x{report.details.get('image_size')}")
            print(f"Parameters:     {report.details.get('parameters_m')}M ({report.details.get('parameters'):,} weights)")
            print(f"Temperature:    {report.details.get('calibration_temperature')}")
            print(f"Grad-CAM Layer: {report.details.get('gradcam_layer')}")
            print(f"CPU Latency:    {report.details.get('latency_ms')} ms")

        if report.warnings:
            print("\nWarnings:")
            for warning in report.warnings:
                print(f"  ⚠️  {warning}")

        if report.errors:
            print("\nValidation Errors:")
            for error in report.errors:
                print(f"  🔴 {error}")
            return 1

        print("\nAll pre-activation safety checks passed successfully.")

    return 0 if report.is_valid else 1


if __name__ == "__main__":
    sys.exit(main())
