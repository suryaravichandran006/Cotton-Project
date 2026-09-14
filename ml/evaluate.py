"""Evaluate a checkpoint: ``python -m ml.evaluate --checkpoint models/checkpoints/<exp>/best.pt``.

Writes ``reports/<experiment>/evaluation_<split>/`` containing metrics (JSON/CSV),
confusion matrices, calibration data, confidence distribution, per-sample
predictions and a misclassified-image report.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from ml.calibration import calibrate, expected_calibration_error, plot_reliability, softmax_np
from ml.config import TrainConfig
from ml.data.dataset import CottonImageDataset, make_dataloader
from ml.data.splits import load_splits
from ml.data.transforms import build_eval_transform
from ml.models.factory import get_model
from ml.training.metrics import compute_classification_metrics, save_metrics_bundle
from ml.training.trainer import load_checkpoint, run_inference
from ml.utils.device import select_device
from ml.utils.paths import resolve_path, write_json

logger = logging.getLogger("ml.evaluate")


def plot_confidence_histogram(conf: np.ndarray, correct: np.ndarray, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 4))
    bins = np.linspace(0, 1, 21)
    ax.hist(conf[correct], bins=bins, alpha=0.7, label="correct")
    ax.hist(conf[~correct], bins=bins, alpha=0.7, label="incorrect")
    ax.set_xlabel("calibrated confidence")
    ax.set_ylabel("count")
    ax.legend()
    ax.set_title("Confidence distribution")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Evaluate a Cotton Grade checkpoint")
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--split", default="test", choices=["val", "test"])
    p.add_argument("--splits-dir", default=None, help="Defaults to the splits_dir stored in the checkpoint config")
    p.add_argument("--output-dir", default=None, help="Defaults to reports/<experiment>/evaluation_<split>")
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--num-workers", type=int, default=2)
    p.add_argument("--device", default="auto")
    p.add_argument("--refit-temperature", action="store_true", help="Re-estimate T on this split (only sensible for val)")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    payload = load_checkpoint(resolve_path(args.checkpoint))
    cfg = TrainConfig(**payload["config"]) if payload.get("config") else TrainConfig()
    class_names = payload["class_names"]
    device = select_device(args.device)

    splits = load_splits(resolve_path(args.splits_dir) if args.splits_dir else cfg.splits_path)
    records = splits.test if args.split == "test" else splits.val
    if not records:
        logger.error("Split '%s' is empty", args.split)
        return 2
    ds = CottonImageDataset(records, class_names, build_eval_transform(payload["image_size"]))
    loader = make_dataloader(ds, args.batch_size, False, args.num_workers, cfg.seed, device)

    model = get_model(payload["architecture"], len(class_names), pretrained=False, dropout=float(payload.get("dropout", 0.0)))
    model.load_state_dict(payload["model_state_dict"])
    model.to(device)

    logits, labels, _ = run_inference(model, loader, device)
    logits_np, y = logits.numpy(), labels.numpy()
    temperature = float(payload.get("calibration_temperature") or 1.0)
    cal_result = None
    if args.refit_temperature:
        cal_result = calibrate(logits_np, y)
        temperature = cal_result.temperature
    probs = softmax_np(logits_np, temperature)
    raw_probs = softmax_np(logits_np, 1.0)
    pred = probs.argmax(1)

    out = resolve_path(args.output_dir) if args.output_dir else cfg.report_path / f"evaluation_{args.split}"
    out.mkdir(parents=True, exist_ok=True)

    metrics = compute_classification_metrics(y, pred, probs, class_names)
    metrics["calibration_temperature"] = temperature
    ece, table = expected_calibration_error(probs, y)
    raw_ece, _ = expected_calibration_error(raw_probs, y)
    metrics["ece_calibrated"], metrics["ece_raw"] = ece, raw_ece
    save_metrics_bundle(metrics, out, prefix=args.split)
    write_json(
        out / "calibration.json",
        {
            "temperature": temperature,
            "ece_raw": raw_ece,
            "ece_calibrated": ece,
            "reliability": table,
            **({"refit": cal_result.to_dict()} if cal_result else {}),
        },
    )
    if cal_result:
        plot_reliability(cal_result, out / "reliability_diagram.png")

    conf = probs.max(1)
    correct = pred == y
    plot_confidence_histogram(conf, correct, out / "confidence_distribution.png")
    write_json(out / "confidence_distribution.json", {"bins": np.histogram(conf, bins=20, range=(0, 1))[0].tolist(), "mean_confidence": float(conf.mean())})

    rows = pd.DataFrame(
        {
            "image_path": [r.image_path for r in records],
            "true_class": [class_names[i] for i in y],
            "predicted_class": [class_names[i] for i in pred],
            "calibrated_confidence": conf,
            "raw_probability": raw_probs.max(1),
            "correct": correct,
        }
    )
    rows.to_csv(out / "predictions.csv", index=False)
    rows[~rows["correct"]].sort_values("calibrated_confidence", ascending=False).to_csv(out / "misclassified.csv", index=False)

    logger.info(
        "%s | acc %.4f | balanced acc %s | macro-F1 %.4f | top-2 %s | ECE raw %.4f -> cal %.4f | %d misclassified",
        args.split,
        metrics["accuracy"],
        metrics["balanced_accuracy"],
        metrics["macro_f1"],
        metrics.get("top2_accuracy"),
        raw_ece,
        ece,
        int((~correct).sum()),
    )
    logger.info("Reports written to %s", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
