"""Training loop: AMP, early stopping, checkpoints, schedulers, TensorBoard, metrics."""

from __future__ import annotations

import json
import logging
import math
import platform
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader

from ml.config import IMAGENET_MEAN, IMAGENET_STD, TrainConfig
from ml.training.metrics import compute_classification_metrics, plot_training_curves
from ml.utils.device import amp_enabled
from ml.utils.paths import git_commit_hash, write_json

logger = logging.getLogger("ml.train")

CHECKPOINT_FORMAT_VERSION = 1


@dataclass
class EpochResult:
    epoch: int
    train_loss: float
    val_loss: float
    val_accuracy: float
    val_macro_f1: float
    val_balanced_accuracy: float | None
    lr: float
    seconds: float

    def as_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


@dataclass
class TrainState:
    best_metric: float = -math.inf
    best_epoch: int = -1
    epochs_without_improvement: int = 0
    history: list[dict[str, Any]] = field(default_factory=list)


def build_optimizer(model: nn.Module, cfg: TrainConfig) -> torch.optim.Optimizer:
    params = [p for p in model.parameters() if p.requires_grad]
    if cfg.optimizer == "sgd":
        return torch.optim.SGD(params, lr=cfg.learning_rate, momentum=cfg.momentum, weight_decay=cfg.weight_decay, nesterov=True)
    return torch.optim.AdamW(params, lr=cfg.learning_rate, weight_decay=cfg.weight_decay)


def build_scheduler(optimizer: torch.optim.Optimizer, cfg: TrainConfig):
    """Cosine (with linear warm-up) or ReduceLROnPlateau or none."""
    if cfg.scheduler == "cosine":
        warm = max(0, cfg.warmup_epochs)

        def lr_lambda(epoch: int) -> float:
            if epoch < warm:
                return (epoch + 1) / (warm + 1)
            progress = (epoch - warm) / max(1, cfg.epochs - warm)
            return 0.5 * (1 + math.cos(math.pi * min(1.0, progress)))

        return torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)
    if cfg.scheduler == "plateau":
        return torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=3)
    return None


def build_checkpoint_payload(
    model: nn.Module,
    cfg: TrainConfig,
    class_names: list[str],
    epoch: int,
    metrics: dict[str, Any],
    calibration_temperature: float | None = None,
) -> dict[str, Any]:
    """Everything needed to reload and serve the model without the training config."""
    return {
        "format_version": CHECKPOINT_FORMAT_VERSION,
        "model_state_dict": model.state_dict(),
        "architecture": cfg.architecture,
        "num_classes": len(class_names),
        "class_names": list(class_names),
        "image_size": cfg.image_size,
        "normalization": {"mean": list(IMAGENET_MEAN), "std": list(IMAGENET_STD)},
        "dropout": cfg.dropout,
        "epoch": epoch,
        "metrics": metrics,
        "calibration_temperature": calibration_temperature,
        "config": cfg.to_dict(),
        "experiment_name": cfg.experiment_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "git_commit": git_commit_hash(),
        "torch_version": torch.__version__,
        "python_version": platform.python_version(),
    }


@torch.inference_mode()
def run_inference(model: nn.Module, loader: DataLoader, device: str, criterion: nn.Module | None = None):
    """Return ``(logits, labels, mean_loss)`` over a loader."""
    model.eval()
    all_logits, all_labels, losses = [], [], []
    for x, y in loader:
        x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
        logits = model(x)
        if criterion is not None:
            losses.append(float(criterion(logits, y).item()))
        all_logits.append(logits.float().cpu())
        all_labels.append(y.cpu())
    logits = torch.cat(all_logits) if all_logits else torch.empty(0)
    labels = torch.cat(all_labels) if all_labels else torch.empty(0, dtype=torch.long)
    return logits, labels, (float(np.mean(losses)) if losses else float("nan"))


def evaluate_loader(model: nn.Module, loader: DataLoader, device: str, class_names: list[str], criterion=None):
    logits, labels, loss = run_inference(model, loader, device, criterion)
    probs = torch.softmax(logits, dim=1).numpy()
    metrics = compute_classification_metrics(labels.numpy(), probs.argmax(1), probs, class_names)
    metrics["loss"] = loss
    return metrics, logits, labels


class Trainer:
    """Minimal but complete supervised trainer for image classification."""

    def __init__(
        self,
        model: nn.Module,
        cfg: TrainConfig,
        class_names: list[str],
        device: str,
        class_weights: torch.Tensor | None = None,
    ) -> None:
        self.model = model.to(device)
        self.cfg = cfg
        self.class_names = class_names
        self.device = device
        self.criterion = nn.CrossEntropyLoss(
            weight=class_weights.to(device) if class_weights is not None else None,
            label_smoothing=cfg.label_smoothing,
        )
        self.optimizer = build_optimizer(self.model, cfg)
        self.scheduler = build_scheduler(self.optimizer, cfg)
        self.use_amp = amp_enabled(device, cfg.mixed_precision)
        self.scaler = torch.cuda.amp.GradScaler(enabled=self.use_amp) if device == "cuda" else None
        self.state = TrainState()
        self.ckpt_dir = cfg.checkpoint_path
        self.ckpt_dir.mkdir(parents=True, exist_ok=True)
        self.writer = self._make_writer()

    def _make_writer(self):
        if not self.cfg.tensorboard:
            return None
        try:
            from torch.utils.tensorboard import SummaryWriter

            return SummaryWriter(log_dir=str(self.cfg.report_path / "tensorboard"))
        except Exception as exc:  # pragma: no cover - tensorboard optional
            logger.warning("TensorBoard unavailable (%s); continuing without it", exc)
            return None

    # ------------------------------------------------------------------ epoch
    def _train_epoch(self, loader: DataLoader, epoch: int) -> float:
        self.model.train()
        total, n = 0.0, 0
        for step, (x, y) in enumerate(loader):
            x, y = x.to(self.device, non_blocking=True), y.to(self.device, non_blocking=True)
            self.optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type="cuda", enabled=self.use_amp):
                logits = self.model(x)
                loss = self.criterion(logits, y)
            if self.scaler is not None and self.use_amp:
                self.scaler.scale(loss).backward()
                if self.cfg.grad_clip_norm:
                    self.scaler.unscale_(self.optimizer)
                    nn.utils.clip_grad_norm_(self.model.parameters(), self.cfg.grad_clip_norm)
                self.scaler.step(self.optimizer)
                self.scaler.update()
            else:
                loss.backward()
                if self.cfg.grad_clip_norm:
                    nn.utils.clip_grad_norm_(self.model.parameters(), self.cfg.grad_clip_norm)
                self.optimizer.step()
            total += float(loss.item()) * x.size(0)
            n += x.size(0)
            if self.cfg.log_every_n_steps and step % self.cfg.log_every_n_steps == 0:
                logger.info("epoch %d step %d/%d loss %.4f", epoch, step, len(loader), loss.item())
        return total / max(1, n)

    # -------------------------------------------------------------------- fit
    def fit(self, train_loader: DataLoader, val_loader: DataLoader) -> TrainState:
        cfg = self.cfg
        logger.info(
            "Training %s | %d classes | device=%s | amp=%s | epochs=%d",
            cfg.architecture,
            len(self.class_names),
            self.device,
            self.use_amp,
            cfg.epochs,
        )
        for epoch in range(1, cfg.epochs + 1):
            t0 = time.perf_counter()
            train_loss = self._train_epoch(train_loader, epoch)
            val_metrics, _, _ = evaluate_loader(self.model, val_loader, self.device, self.class_names, self.criterion)
            monitored = float(val_metrics.get(cfg.monitor_metric) or 0.0)

            if isinstance(self.scheduler, torch.optim.lr_scheduler.ReduceLROnPlateau):
                self.scheduler.step(monitored)
            elif self.scheduler is not None:
                self.scheduler.step()

            result = EpochResult(
                epoch=epoch,
                train_loss=train_loss,
                val_loss=val_metrics["loss"],
                val_accuracy=val_metrics["accuracy"],
                val_macro_f1=val_metrics["macro_f1"],
                val_balanced_accuracy=val_metrics["balanced_accuracy"],
                lr=self.optimizer.param_groups[0]["lr"],
                seconds=time.perf_counter() - t0,
            )
            self.state.history.append(result.as_dict())
            self._log_epoch(result)

            improved = monitored > self.state.best_metric
            if improved:
                self.state.best_metric, self.state.best_epoch, self.state.epochs_without_improvement = monitored, epoch, 0
                torch.save(build_checkpoint_payload(self.model, cfg, self.class_names, epoch, val_metrics), self.ckpt_dir / "best.pt")
                logger.info("New best %s=%.4f at epoch %d -> %s", cfg.monitor_metric, monitored, epoch, self.ckpt_dir / "best.pt")
            else:
                self.state.epochs_without_improvement += 1

            torch.save(build_checkpoint_payload(self.model, cfg, self.class_names, epoch, val_metrics), self.ckpt_dir / "last.pt")
            self._write_history()

            if cfg.early_stopping_patience and self.state.epochs_without_improvement >= cfg.early_stopping_patience:
                logger.info("Early stopping: no improvement for %d epochs", cfg.early_stopping_patience)
                break

        if self.writer:
            self.writer.close()
        return self.state

    def _log_epoch(self, r: EpochResult) -> None:
        logger.info(
            "epoch %d | train_loss %.4f | val_loss %.4f | val_acc %.4f | val_macroF1 %.4f | lr %.2e | %.1fs",
            r.epoch,
            r.train_loss,
            r.val_loss,
            r.val_accuracy,
            r.val_macro_f1,
            r.lr,
            r.seconds,
        )
        if self.writer:
            for k, v in r.as_dict().items():
                if k != "epoch" and v is not None:
                    self.writer.add_scalar(k, v, r.epoch)

    def _write_history(self) -> None:
        out = self.cfg.report_path
        out.mkdir(parents=True, exist_ok=True)
        write_json(out / "training_history.json", self.state.history)
        with open(out / "training_history.csv", "w", encoding="utf-8") as fh:
            keys = list(self.state.history[0].keys())
            fh.write(",".join(keys) + "\n")
            for h in self.state.history:
                fh.write(",".join("" if h[k] is None else str(h[k]) for k in keys) + "\n")
        plot_training_curves(self.state.history, out / "training_curves.png")


def load_checkpoint(path: str | Path, map_location: str = "cpu") -> dict[str, Any]:
    """Load a Cotton Grade checkpoint and validate its structure."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {path}")
    try:
        payload = torch.load(path, map_location=map_location, weights_only=False)
    except Exception as exc:  # corrupt / incompatible file
        raise RuntimeError(f"Checkpoint {path} could not be loaded: {exc}") from exc
    required = {"model_state_dict", "architecture", "class_names", "image_size"}
    missing = required - set(payload)
    if missing:
        raise RuntimeError(f"Checkpoint {path} is missing keys {sorted(missing)} — not a Cotton Grade checkpoint")
    return payload


def summarize_history(history: list[dict[str, Any]]) -> str:
    return json.dumps(history[-1], indent=2) if history else "{}"
