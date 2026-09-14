"""Export a trained checkpoint for serving.

Produces ``models/exports/<name>/`` with ``model.pt`` and ``metadata.json``.
Progressive-transfer lineage is preserved in both artifacts and the registry.
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import torch

from ml.models.factory import get_model
from ml.training.trainer import load_checkpoint
from ml.utils.paths import REPO_ROOT, git_commit_hash, resolve_path, write_json

logger = logging.getLogger("ml.export")


def export(checkpoint: Path, name: str, version: str, output_root: Path, torchscript: bool, onnx: bool, description: str) -> Path:
    payload = load_checkpoint(checkpoint)
    out = output_root / name
    out.mkdir(parents=True, exist_ok=True)
    class_names = payload["class_names"]

    model = get_model(payload["architecture"], len(class_names), pretrained=False, dropout=float(payload.get("dropout", 0.0)))
    model.load_state_dict(payload["model_state_dict"])
    model.eval()

    export_payload = {k: v for k, v in payload.items() if k != "model_state_dict"}
    export_payload.update({"model_state_dict": model.state_dict(), "model_name": name, "model_version": version, "exported_at": datetime.now(timezone.utc).isoformat()})
    torch.save(export_payload, out / "model.pt")

    example = torch.randn(1, 3, payload["image_size"], payload["image_size"])
    ts_path = onnx_path = None
    if torchscript:
        try:
            traced = torch.jit.trace(model, example)
            ts_path = out / "model.torchscript.pt"
            traced.save(str(ts_path))
        except Exception as exc:
            logger.warning("TorchScript export failed: %s", exc)
    if onnx:
        try:
            onnx_path = out / "model.onnx"
            torch.onnx.export(model, example, str(onnx_path), input_names=["input"], output_names=["logits"], opset_version=17, dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}})
        except Exception as exc:
            logger.warning("ONNX export failed (install `onnx` and retry): %s", exc)
            onnx_path = None

    def rel(path: Path | None) -> str | None:
        if path is None:
            return None
        return str(path.relative_to(REPO_ROOT)) if path.is_relative_to(REPO_ROOT) else str(path)

    metrics = payload.get("metrics", {})
    metadata = {
        "name": name,
        "version": version,
        "architecture": payload["architecture"],
        "checkpoint": rel(out / "model.pt"),
        "torchscript": rel(ts_path),
        "onnx": rel(onnx_path),
        "class_names": class_names,
        "num_classes": len(class_names),
        "image_size": payload["image_size"],
        "normalization": payload.get("normalization"),
        "calibration_temperature": payload.get("calibration_temperature") or 1.0,
        "metrics": metrics,
        "lineage": payload.get("lineage", {}),
        "trained_at": payload.get("created_at"),
        "exported_at": export_payload["exported_at"],
        "git_commit": git_commit_hash() or payload.get("git_commit"),
        "experiment_name": payload.get("experiment_name"),
        "torch_version": torch.__version__,
        "size_mb": round((out / "model.pt").stat().st_size / 1e6, 2),
        "description": description,
        "num_parameters": sum(p.numel() for p in model.parameters()),
    }
    write_json(out / "metadata.json", metadata)
    logger.info("Exported to %s", out)
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Export a Cotton Grade checkpoint")
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--version", default="1.0.0")
    p.add_argument("--output-dir", default="models/exports")
    p.add_argument("--description", default="")
    p.add_argument("--no-torchscript", action="store_true")
    p.add_argument("--onnx", action="store_true")
    p.add_argument("--register", action="store_true")
    p.add_argument("--activate", action="store_true")
    p.add_argument("--registry", default=None)
    p.add_argument("--unknown-threshold", type=float, default=None)
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    out = export(resolve_path(args.checkpoint), args.name, args.version, resolve_path(args.output_dir), not args.no_torchscript, args.onnx, args.description)
    if args.register or args.activate:
        from ml.register_model import register_export

        register_export(out, activate=args.activate, registry_path=args.registry, unknown_threshold=args.unknown_threshold)
    return 0


if __name__ == "__main__":
    sys.exit(main())
