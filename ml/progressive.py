"""Orchestrate controlled progressive-transfer experiments.

Examples:
    python -m ml.progressive --route progressive --dry-run
    python -m ml.progressive --route baseline
    python -m ml.progressive --route progressive

Every route reuses the same final-task split manifests so comparisons remain fair.
Intermediate heads are never deployed; only compatible backbone tensors transfer.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml

from ml.utils.paths import resolve_path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def load_plan(path: str) -> dict[str, Any]:
    with resolve_path(path).open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run a Cotton Grade progressive transfer-learning route")
    p.add_argument("--config", default="config/progressive_transfer.yaml")
    p.add_argument("--route", default="progressive", choices=["baseline", "leaf_to_final", "seed_to_final", "progressive"])
    p.add_argument("--device", default="auto")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args(argv)


def _stage_command(plan: dict[str, Any], route: str, stage_id: str, init_checkpoint: Path | None, device: str) -> tuple[list[str], Path]:
    stage = plan["stages"][stage_id]
    final = stage_id == "final"
    experiment = f"transfer_{route}" if final else f"transfer_{route}_{stage_id}"
    checkpoint = resolve_path("models/checkpoints") / experiment / "best.pt"
    command = [
        sys.executable,
        "-m",
        "ml.train",
        "--config",
        plan.get("base_train_config", "config/train.yaml"),
        "--architecture",
        plan["architecture"],
        "--experiment-name",
        experiment,
        "--data-dir",
        stage["data_dir"],
        "--splits-dir",
        stage["splits_dir"],
        "--epochs",
        str(stage["epochs"]),
        "--batch-size",
        str(stage["batch_size"]),
        "--lr",
        str(stage["learning_rate"]),
        "--augmentation-preset",
        stage.get("augmentation_preset", "default"),
        "--device",
        device,
    ]
    metadata = stage.get("metadata_csv")
    if metadata and resolve_path(metadata).is_file():
        command += ["--metadata-csv", metadata]
    if init_checkpoint is not None:
        command += ["--init-checkpoint", str(init_checkpoint), "--transfer-source", str(init_checkpoint)]
    return command, checkpoint


def _contains_images(data_dir: Path) -> bool:
    return data_dir.is_dir() and any(path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS for path in data_dir.rglob("*"))


def validate_plan(plan: dict[str, Any], route: str) -> list[str]:
    errors: list[str] = []
    if route not in plan.get("routes", {}):
        errors.append(f"Unknown route: {route}")
        return errors
    if plan.get("architecture") is None:
        errors.append("architecture is required")
    for stage_id in plan["routes"][route]:
        stage = plan.get("stages", {}).get(stage_id)
        if not stage:
            errors.append(f"Missing stage config: {stage_id}")
            continue
        data_dir = resolve_path(stage["data_dir"])
        if not data_dir.exists():
            errors.append(f"Dataset directory does not exist yet: {data_dir}")
        elif not _contains_images(data_dir):
            errors.append(f"Dataset directory contains no supported images yet: {data_dir}")
    return errors


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    plan = load_plan(args.config)
    errors = validate_plan(plan, args.route)
    if args.dry_run:
        print(f"Route: {args.route}")
        print(" -> ".join(plan.get("routes", {}).get(args.route, [])) or "invalid")
        if errors:
            print("Dataset readiness: pending")
            for error in errors:
                print(f" - {error}")
        else:
            print("Dataset readiness: ready")
        previous: Path | None = None
        for stage_id in plan.get("routes", {}).get(args.route, []):
            command, previous = _stage_command(plan, args.route, stage_id, previous, args.device)
            print(" ".join(command))
        return 0
    if errors:
        raise SystemExit("Cannot start route:\n" + "\n".join(f"- {error}" for error in errors))

    previous: Path | None = None
    for stage_id in plan["routes"][args.route]:
        command, output_checkpoint = _stage_command(plan, args.route, stage_id, previous, args.device)
        print(f"\n=== {args.route}: {stage_id} ===")
        subprocess.run(command, check=True)
        if not output_checkpoint.is_file():
            raise RuntimeError(f"Expected checkpoint was not produced: {output_checkpoint}")
        previous = output_checkpoint
    print(f"\nCompleted route '{args.route}'. Final checkpoint: {previous}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
