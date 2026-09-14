"""Train a model: ``python -m ml.train --config config/train.yaml --architecture convnext_tiny``.

Supports conventional ImageNet transfer and progressive transfer from an earlier
Cotton Grade checkpoint via ``--init-checkpoint``. Only shape-compatible tensors
are loaded, so old task classifier heads are discarded automatically.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

import torch

from ml.calibration import calibrate, plot_reliability
from ml.config import TrainConfig, load_augmentation_preset, load_train_config
from ml.data.dataset import CottonImageDataset, compute_class_weights, make_dataloader
from ml.data.discovery import discover_dataset
from ml.data.splits import SplitResult, create_splits, load_splits, save_splits
from ml.data.transforms import build_eval_transform, build_train_transform
from ml.models.factory import count_parameters, get_model, load_transfer_weights
from ml.training.metrics import save_metrics_bundle
from ml.training.trainer import Trainer, build_checkpoint_payload, evaluate_loader, load_checkpoint, run_inference
from ml.utils.device import select_device
from ml.utils.paths import git_commit_hash, write_json
from ml.utils.seed import seed_everything

logger = logging.getLogger("ml.train")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train a Cotton Grade classifier")
    p.add_argument("--config", default="config/train.yaml")
    p.add_argument("--architecture", default=None)
    p.add_argument("--experiment-name", default=None)
    p.add_argument("--epochs", type=int, default=None)
    p.add_argument("--batch-size", type=int, default=None)
    p.add_argument("--lr", dest="learning_rate", type=float, default=None)
    p.add_argument("--image-size", type=int, default=None)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--device", default=None, help="auto | cuda | mps | cpu")
    p.add_argument("--data-dir", default=None)
    p.add_argument("--metadata-csv", default=None)
    p.add_argument("--splits-dir", default=None)
    p.add_argument("--num-workers", type=int, default=None)
    p.add_argument("--augmentation-preset", default=None)
    p.add_argument("--init-checkpoint", default=None, help="Earlier-stage Cotton Grade checkpoint whose compatible backbone weights should initialize this task")
    p.add_argument("--transfer-source", default=None, help="Human-readable lineage label stored with the experiment, e.g. leaf or seed")
    p.add_argument("--no-pretrained", action="store_true")
    p.add_argument("--class-weights", action="store_true")
    p.add_argument("--enable-lighting-aug", action="store_true", default=None)
    p.add_argument("--resplit", action="store_true")
    return p.parse_args(argv)


def prepare_splits(cfg: TrainConfig, resplit: bool) -> SplitResult:
    splits_dir = cfg.splits_path
    if not resplit and (splits_dir / "train.csv").exists():
        splits = load_splits(splits_dir)
        index = discover_dataset(cfg.data_path, cfg.metadata_csv)
        if set(index.class_names) != set(splits.class_names):
            raise RuntimeError(f"Classes on disk {index.class_names} differ from saved splits {splits.class_names}. Re-run with --resplit.")
        logger.info("Reusing splits from %s (group_key=%s)", splits_dir, splits.group_key)
        return splits
    index = discover_dataset(cfg.data_path, cfg.metadata_csv)
    splits = create_splits(index, (cfg.train_ratio, cfg.val_ratio, cfg.test_ratio), cfg.seed, cfg.group_by)
    save_splits(splits, splits_dir)
    logger.info("Created splits in %s: %s", splits_dir, splits.summary()["sizes"])
    return splits


def run(cfg: TrainConfig, resplit: bool = False) -> Path:
    seed_everything(cfg.seed, cfg.deterministic)
    device = select_device(cfg.device)
    splits = prepare_splits(cfg, resplit)
    class_names = splits.class_names

    aug = load_augmentation_preset(cfg.augmentation_preset)
    train_ds = CottonImageDataset(splits.train, class_names, build_train_transform(cfg.image_size, aug, cfg.enable_lighting_aug))
    val_ds = CottonImageDataset(splits.val, class_names, build_eval_transform(cfg.image_size))
    test_ds = CottonImageDataset(splits.test, class_names, build_eval_transform(cfg.image_size))
    workers = cfg.num_workers if device != "mps" else min(cfg.num_workers, 2)
    train_loader = make_dataloader(train_ds, cfg.batch_size, True, workers, cfg.seed, device)
    val_loader = make_dataloader(val_ds, cfg.batch_size, False, workers, cfg.seed, device)
    test_loader = make_dataloader(test_ds, cfg.batch_size, False, workers, cfg.seed, device)

    model = get_model(cfg.architecture, len(class_names), pretrained=cfg.pretrained and not bool(cfg.init_checkpoint), dropout=cfg.dropout)
    transfer_info = None
    if cfg.init_checkpoint_path:
        transfer_info = load_transfer_weights(model, cfg.init_checkpoint_path)
        if transfer_info.get("source_architecture") and transfer_info["source_architecture"] != cfg.architecture:
            raise RuntimeError(f"Transfer checkpoint architecture {transfer_info['source_architecture']} does not match target {cfg.architecture}")
        logger.info("Transferred %d tensors from %s; skipped %d task-specific/incompatible tensors", transfer_info["loaded_tensors"], cfg.init_checkpoint_path, transfer_info["skipped_tensors"])

    logger.info("%s: %.2fM parameters", cfg.architecture, count_parameters(model) / 1e6)
    weights = compute_class_weights(train_ds.labels(), len(class_names)) if cfg.class_weights else None
    report_dir = cfg.report_path
    report_dir.mkdir(parents=True, exist_ok=True)
    write_json(report_dir / "config.json", cfg.to_dict())
    if transfer_info:
        write_json(report_dir / "transfer.json", {**transfer_info, "transfer_source": cfg.transfer_source})

    t0 = time.perf_counter()
    trainer = Trainer(model, cfg, class_names, device, weights)
    state = trainer.fit(train_loader, val_loader)
    train_seconds = time.perf_counter() - t0

    best_path = cfg.checkpoint_path / "best.pt"
    payload = load_checkpoint(best_path)
    model.load_state_dict(payload["model_state_dict"])
    model.to(device)

    val_logits, val_labels, _ = run_inference(model, val_loader, device)
    cal = calibrate(val_logits.numpy(), val_labels.numpy())
    write_json(report_dir / "calibration.json", cal.to_dict())
    plot_reliability(cal, report_dir / "reliability_diagram.png")

    test_metrics, _, _ = evaluate_loader(model, test_loader, device, class_names) if len(test_ds) else ({}, None, None)
    if test_metrics:
        save_metrics_bundle(test_metrics, report_dir, prefix="test")

    final_metrics = {"val": payload.get("metrics", {}), "test": test_metrics, "calibration": cal.to_dict()}
    final_payload = build_checkpoint_payload(model, cfg, class_names, payload["epoch"], final_metrics, cal.temperature)
    final_payload["lineage"] = {"transfer_source": cfg.transfer_source, "init_checkpoint": cfg.init_checkpoint, "transfer": transfer_info}
    torch.save(final_payload, best_path)

    write_json(report_dir / "experiment.json", {
        "experiment_name": cfg.experiment_name,
        "architecture": cfg.architecture,
        "num_classes": len(class_names),
        "class_names": class_names,
        "device": device,
        "best_epoch": state.best_epoch,
        "best_val_metric": {cfg.monitor_metric: state.best_metric},
        "epochs_run": len(state.history),
        "train_seconds": train_seconds,
        "parameters": count_parameters(model),
        "calibration": cal.to_dict(),
        "test": {k: test_metrics.get(k) for k in ("accuracy", "balanced_accuracy", "macro_f1", "weighted_f1", "top2_accuracy", "top3_accuracy")},
        "splits": splits.summary(),
        "lineage": final_payload["lineage"],
        "git_commit": git_commit_hash(),
        "checkpoint": str(best_path),
    })
    logger.info("Done. Best checkpoint: %s | reports: %s", best_path, report_dir)
    return best_path


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    overrides = {
        "architecture": args.architecture, "experiment_name": args.experiment_name, "epochs": args.epochs,
        "batch_size": args.batch_size, "learning_rate": args.learning_rate, "image_size": args.image_size,
        "seed": args.seed, "device": args.device, "data_dir": args.data_dir, "metadata_csv": args.metadata_csv,
        "splits_dir": args.splits_dir, "num_workers": args.num_workers, "augmentation_preset": args.augmentation_preset,
        "init_checkpoint": args.init_checkpoint, "transfer_source": args.transfer_source,
        "pretrained": False if args.no_pretrained else None, "class_weights": True if args.class_weights else None,
        "enable_lighting_aug": args.enable_lighting_aug if args.enable_lighting_aug is not None else None,
    }
    cfg = load_train_config(args.config, overrides)
    if args.experiment_name is None and args.architecture:
        cfg.experiment_name = f"{cfg.experiment_name}_{cfg.architecture}"
    run(cfg, resplit=args.resplit)
    return 0


if __name__ == "__main__":
    sys.exit(main())
