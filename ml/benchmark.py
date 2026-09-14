"""Multi-model benchmark pipeline for Cotton Grade.

Usage:
  python -m ml.benchmark --dry-run
  python -m ml.benchmark --config config/train.yaml --epochs 25
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ml.config import load_models_config, load_train_config
from ml.models.factory import get_model, resolve_gradcam_layer
from ml.utils.paths import resolve_path, write_json

logger = logging.getLogger("ml.benchmark")


@dataclass
class ModelDryRunResult:
    architecture: str
    role: str
    description: str
    gradcam_layer: str
    parameters: int
    parameters_m: float
    forward_pass_ok: bool
    gradcam_hook_ok: bool
    latency_ms: float
    error: str | None = None


def run_dry_run(
    num_classes: int = 5,
    image_size: int = 224,
    models_config_path: str | Path | None = None,
    train_config_path: str | Path | None = None,
    device_name: str = "cpu",
) -> list[ModelDryRunResult]:
    """Validate candidate architectures, forward passes, and Grad-CAM layers on synthetic data."""
    import torch

    from ml.explain.gradcam import GradCAM

    models_cfg = load_models_config(models_config_path)
    arch_dict = models_cfg.get("architectures", {})
    order = models_cfg.get("benchmark_order", list(arch_dict.keys()))
    results: list[ModelDryRunResult] = []
    dummy_input = torch.randn(1, 3, image_size, image_size, device=device_name)

    print(f"\nCotton Grade Benchmark Dry-Run: Validating {len(order)} candidate architectures...")
    print(f"Synthetic Resolution: {image_size}x{image_size} | Assumed Classes: {num_classes} | Device: {device_name}\n")

    for arch in order:
        spec = arch_dict.get(arch, {})
        role = spec.get("role", "candidate")
        desc = spec.get("description", "")
        gc_layer_name = spec.get("gradcam_layer", "")
        try:
            load_train_config(train_config_path, {"architecture": arch})
            model = get_model(arch, num_classes=num_classes, pretrained=False)
            model.eval().to(device_name)
            params = sum(p.numel() for p in model.parameters())

            t0 = time.perf_counter()
            with torch.no_grad():
                out = model(dummy_input)
            latency = (time.perf_counter() - t0) * 1000
            forward_ok = out.shape == (1, num_classes) and torch.isfinite(out).all().item()

            resolved_layer = resolve_gradcam_layer(model, gc_layer_name)
            cam = GradCAM(model, resolved_layer)
            cam_map, _ = cam(dummy_input, class_idx=0)
            cam.remove()
            gc_ok = cam_map.shape == (image_size, image_size) and (0.0 <= cam_map.min() and cam_map.max() <= 1.0001)

            results.append(
                ModelDryRunResult(
                    architecture=arch,
                    role=role,
                    description=desc,
                    gradcam_layer=gc_layer_name,
                    parameters=params,
                    parameters_m=round(params / 1e6, 2),
                    forward_pass_ok=bool(forward_ok),
                    gradcam_hook_ok=bool(gc_ok),
                    latency_ms=round(latency, 2),
                )
            )
            print(f"  [PASS] {arch:<20} ({role:<18}) | {round(params / 1e6, 2):>5.2f}M params | Grad-CAM: {gc_layer_name} -> OK")
        except Exception as exc:
            logger.exception("Dry-run failed for %s", arch)
            results.append(
                ModelDryRunResult(
                    architecture=arch,
                    role=role,
                    description=desc,
                    gradcam_layer=gc_layer_name,
                    parameters=0,
                    parameters_m=0.0,
                    forward_pass_ok=False,
                    gradcam_hook_ok=False,
                    latency_ms=0.0,
                    error=str(exc),
                )
            )
            print(f"  [FAIL] {arch:<20} ({role:<18}) | ERROR: {exc}")
    return results


def run_benchmark(
    config_path: str = "config/train.yaml",
    models_config_path: str | None = None,
    epochs: int | None = None,
    device: str | None = None,
    splits_dir: str | None = None,
    output_dir: str = "reports/benchmark",
) -> dict[str, Any]:
    """Execute full benchmark training and test evaluation across candidate architectures."""
    from ml.evaluate import main as eval_main
    from ml.train import run as train_run
    from ml.utils.paths import read_json

    models_cfg = load_models_config(models_config_path)
    order = models_cfg.get("benchmark_order", list(models_cfg.get("architectures", {}).keys()))
    out_path = resolve_path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    summary: dict[str, Any] = {"timestamp": time.time(), "architectures": {}, "winner": None}
    results_table: list[dict[str, Any]] = []

    for arch in order:
        exp_name = f"benchmark_{arch}"
        overrides: dict[str, Any] = {"architecture": arch, "experiment_name": exp_name}
        if epochs is not None:
            overrides["epochs"] = epochs
        if device is not None:
            overrides["device"] = device
        if splits_dir is not None:
            overrides["splits_dir"] = splits_dir

        cfg = load_train_config(config_path, overrides, models_config_path)
        logger.info("=== Benchmarking architecture: %s (Experiment: %s) ===", arch, exp_name)
        train_run(cfg, resplit=False)

        best_ckpt = cfg.checkpoint_path / "best.pt"
        eval_args = ["--checkpoint", str(best_ckpt), "--split", "test"]
        if device:
            eval_args.extend(["--device", device])
        eval_main(eval_args)

        metrics_file = cfg.report_path / "evaluation_test" / "test_metrics.json"
        cal_file = cfg.report_path / "evaluation_test" / "calibration.json"
        metrics = read_json(metrics_file) if metrics_file.exists() else {}
        cal_info = read_json(cal_file) if cal_file.exists() else {}
        row = {
            "architecture": arch,
            "experiment": exp_name,
            "accuracy": metrics.get("accuracy", 0.0),
            "balanced_accuracy": metrics.get("balanced_accuracy", 0.0),
            "macro_f1": metrics.get("macro_f1", 0.0),
            "top2_accuracy": metrics.get("top2_accuracy", 0.0),
            "ece_raw": cal_info.get("ece_raw", 0.0),
            "ece_calibrated": cal_info.get("ece_calibrated", 0.0),
            "temperature": cal_info.get("temperature", 1.0),
            "checkpoint": str(best_ckpt),
        }
        results_table.append(row)
        summary["architectures"][arch] = row

    if results_table:
        winner = max(results_table, key=lambda r: (r.get("macro_f1", 0.0), r.get("balanced_accuracy", 0.0)))
        summary["winner"] = winner["architecture"]
        print(f"\nBenchmark Complete! Winner: {winner['architecture']} (Macro F1: {winner['macro_f1']:.4f})")

    write_json(out_path / "benchmark_summary.json", summary)
    md_lines = [
        "# Cotton Grade: Candidate Architecture Benchmark Results",
        "",
        f"**Benchmark Run Completed**: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}  ",
        f"**Winning Model Selected**: `{summary['winner']}`  ",
        "",
        "| Architecture | Macro F1 | Balanced Acc | Top-1 Acc | Top-2 Acc | ECE (Raw) | ECE (Calibrated) | Temperature |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]
    for result in results_table:
        star = " 🏆" if result["architecture"] == summary["winner"] else ""
        md_lines.append(
            f"| `{result['architecture']}`{star} | {result['macro_f1']:.4f} | {result['balanced_accuracy']:.4f} | {result['accuracy']:.4f} | {result['top2_accuracy']:.4f} | {result['ece_raw']:.4f} | {result['ece_calibrated']:.4f} | {result['temperature']:.3f} |"
        )
    (out_path / "benchmark_summary.md").write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    print(f"Summary written to: {out_path / 'benchmark_summary.md'}")
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Cotton Grade multi-model architecture benchmark")
    parser.add_argument("--dry-run", action="store_true", help="Validate architectures, forward pass, and Grad-CAM without training")
    parser.add_argument("--config", default="config/train.yaml", help="Path to base training config")
    parser.add_argument("--models-config", default="config/models.yaml", help="Path to models config")
    parser.add_argument("--epochs", type=int, default=None, help="Override epochs for benchmark")
    parser.add_argument("--device", default=None, help="Compute device: auto | cpu | cuda | mps")
    parser.add_argument("--splits-dir", default=None, help="Path to pre-computed splits")
    parser.add_argument("--output-dir", default="reports/benchmark", help="Directory for benchmark outputs")
    parser.add_argument("--json", action="store_true", help="Output JSON results")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.dry_run:
        results = run_dry_run(models_config_path=args.models_config, train_config_path=args.config, device_name=args.device or "cpu")
        all_ok = all(result.forward_pass_ok and result.gradcam_hook_ok for result in results)
        if args.json:
            print(json.dumps([result.__dict__ for result in results], indent=2))
        else:
            print("\nDry-Run Architecture Benchmark Summary:")
            print("| Architecture | Role | Parameters | Forward Pass | Grad-CAM | Latency |")
            print("| :--- | :--- | :---: | :---: | :---: | :---: |")
            for result in results:
                fwd = "PASS" if result.forward_pass_ok else "FAIL"
                cam = "PASS" if result.gradcam_hook_ok else "FAIL"
                print(f"| `{result.architecture}` | {result.role} | {result.parameters_m}M | {fwd} | {cam} | {result.latency_ms}ms |")
            print(f"\nStatus: {'ALL ARCHITECTURES READY' if all_ok else 'VALIDATION ERRORS DETECTED'}")
        return 0 if all_ok else 1

    run_benchmark(
        config_path=args.config,
        models_config_path=args.models_config,
        epochs=args.epochs,
        device=args.device,
        splits_dir=args.splits_dir,
        output_dir=args.output_dir,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
