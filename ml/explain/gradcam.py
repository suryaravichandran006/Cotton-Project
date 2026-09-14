"""Grad-CAM (Selvaraju et al., 2017) with a dependency-free overlay renderer.

The heatmap highlights the fibre regions whose activations most increased the
score of the predicted (or requested) class. It is a *qualitative* aid: it
tells you where the network looked, not whether it was right.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from PIL import Image, ImageDraw


class GradCAM:
    """Hook-based Grad-CAM for any module producing a 4-D (N, C, H, W) activation map.

    Usage::

        cam = GradCAM(model, target_layer)
        heatmap = cam(input_tensor, class_idx)   # (H, W) float32 in [0, 1]
        cam.remove()
    """

    def __init__(self, model, target_layer) -> None:
        self.model = model
        self.target_layer = target_layer
        self._activations = None
        self._gradients = None
        self._handles = [
            target_layer.register_forward_hook(self._save_activation),
            target_layer.register_full_backward_hook(self._save_gradient),
        ]

    def _save_activation(self, module, inputs, output) -> None:
        self._activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output) -> None:
        self._gradients = grad_output[0].detach()

    def __call__(self, input_tensor, class_idx: int | None = None) -> tuple[np.ndarray, Any]:
        """Return ``(heatmap, logits)``. Runs its own forward/backward with grads enabled."""
        import torch

        self.model.eval()
        self.model.zero_grad(set_to_none=True)
        with torch.enable_grad():
            x = input_tensor.clone().requires_grad_(True)
            logits = self.model(x)
            if class_idx is None:
                class_idx = int(logits.argmax(dim=1).item())
            logits[:, class_idx].sum().backward()

        if self._activations is None or self._gradients is None:
            raise RuntimeError("Grad-CAM hooks did not fire — check the target layer")
        act, grad = self._activations, self._gradients
        if act.ndim != 4:
            raise RuntimeError(f"Grad-CAM target layer must output a 4-D map, got shape {tuple(act.shape)}")
        weights = grad.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((weights * act).sum(dim=1, keepdim=True))  # (N, 1, h, w)
        cam = torch.nn.functional.interpolate(cam, size=input_tensor.shape[-2:], mode="bilinear", align_corners=False)
        cam = cam[0, 0].float().cpu().numpy()
        cam -= cam.min()
        denom = cam.max()
        heatmap = cam / denom if denom > 0 else np.zeros_like(cam)
        return heatmap.astype(np.float32), logits.detach()

    def remove(self) -> None:
        for h in self._handles:
            h.remove()
        self._handles = []


def _jet(v: np.ndarray) -> np.ndarray:
    """Vectorised jet colormap ([0,1] -> uint8 RGB), avoiding matplotlib at inference."""
    v = np.clip(v, 0, 1)
    r = np.clip(1.5 - np.abs(4 * v - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * v - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * v - 1), 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def heatmap_to_overlay(
    base_image: Image.Image,
    heatmap: np.ndarray,
    alpha: float = 0.45,
    label: str | None = None,
) -> Image.Image:
    """Blend a [0,1] heatmap over ``base_image`` (RGB). Optional caption (e.g. 'DEMO')."""
    base = base_image.convert("RGB")
    hm = Image.fromarray(_jet(heatmap)).resize(base.size, Image.Resampling.BILINEAR)
    overlay = Image.blend(base, hm, alpha)
    if label:
        draw = ImageDraw.Draw(overlay)
        w, h = overlay.size
        pad = max(4, w // 60)
        text_w = int(len(label) * max(6, w // 40) * 0.6) + 2 * pad
        text_h = max(6, w // 40) + 2 * pad
        draw.rectangle([(pad, pad), (pad + text_w, pad + text_h)], fill=(0, 0, 0))
        draw.text((2 * pad, 2 * pad), label, fill=(255, 255, 255))
    return overlay
