"""Trained-model predictor: loads a registry entry's checkpoint into PyTorch once."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from ml.inference.base import BasePredictor, PredictorLoadError
from ml.ood import Rejector
from ml.registry import ModelEntry

logger = logging.getLogger("ml.inference.torch")


class TorchPredictor(BasePredictor):
    """Serves a Cotton Grade checkpoint (``format_version`` 1) with Grad-CAM support."""

    def __init__(self, entry: ModelEntry, rejector: Rejector, device: str = "auto", warm: bool = True) -> None:
        try:
            import torch

            from ml.models.factory import get_architecture_spec, get_model, resolve_gradcam_layer
            from ml.training.trainer import load_checkpoint
            from ml.utils.device import select_device
        except ImportError as exc:  # torch/timm not installed
            raise PredictorLoadError(f"PyTorch stack not available: {exc}. Install ml/requirements.txt") from exc

        ckpt_path = entry.resolve("checkpoint")
        if ckpt_path is None or not Path(ckpt_path).is_file():
            raise PredictorLoadError(f"Checkpoint for model '{entry.name}' not found at {ckpt_path}")
        try:
            payload = load_checkpoint(ckpt_path)
        except (RuntimeError, FileNotFoundError) as exc:
            raise PredictorLoadError(str(exc)) from exc

        class_names = list(payload.get("class_names") or entry.class_names)
        if entry.class_names and list(entry.class_names) != class_names:
            raise PredictorLoadError(
                f"Class names in registry entry '{entry.name}' do not match the checkpoint. Re-register the model with `python -m ml.register_model`."
            )
        temperature = entry.calibration_temperature if entry.calibration_temperature is not None else (payload.get("calibration_temperature") or 1.0)
        resolved_device = select_device(device)

        super().__init__(
            class_names=class_names,
            image_size=int(payload.get("image_size", entry.image_size)),
            rejector=rejector,
            model_name=entry.name,
            model_version=entry.version,
            architecture=payload["architecture"],
            device=resolved_device,
            calibration_temperature=float(temperature),
            normalization=payload.get("normalization") or entry.normalization,
        )
        self._torch = torch
        try:
            self.model = get_model(self.architecture, len(class_names), pretrained=False, dropout=float(payload.get("dropout", 0.0)))
            self.model.load_state_dict(payload["model_state_dict"])
        except Exception as exc:
            raise PredictorLoadError(f"Checkpoint incompatible with architecture '{self.architecture}': {exc}") from exc
        self.model.eval().to(self.device)
        self._gradcam_layer = resolve_gradcam_layer(self.model, get_architecture_spec(self.architecture).gradcam_layer)
        self.num_parameters = sum(p.numel() for p in self.model.parameters())
        logger.info("Loaded %s (%s) on %s with %d classes", entry.name, self.architecture, self.device, len(class_names))
        if warm:
            self.warmup()

    def _tensor(self, chw: np.ndarray):
        return self._torch.from_numpy(np.ascontiguousarray(chw)).unsqueeze(0).to(self.device)

    def _logits(self, chw: np.ndarray) -> np.ndarray:
        with self._torch.inference_mode():
            logits = self.model(self._tensor(chw))
        return logits[0].float().cpu().numpy()

    def _heatmap(self, chw: np.ndarray, class_index: int) -> np.ndarray:
        from ml.explain.gradcam import GradCAM

        cam = GradCAM(self.model, self._gradcam_layer)
        try:
            heat, _ = cam(self._tensor(chw), class_index)
        finally:
            cam.remove()
        return heat

    def info(self) -> dict:
        base = super().info()
        base["num_parameters"] = self.num_parameters
        return base
