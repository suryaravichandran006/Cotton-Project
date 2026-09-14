"""Training / evaluation transforms built from ``config/augmentation.yaml``.

Training augmentation is intentionally conservative — cotton texture, lustre
and colour cast are the discriminative cues we must not destroy.
Evaluation transforms are deterministic and match ``ml.data.preprocessing``.
"""

from __future__ import annotations

from typing import Any

import albumentations as A
import numpy as np
from albumentations.pytorch import ToTensorV2

from ml.config import IMAGENET_MEAN, IMAGENET_STD


def _random_resized_crop(size: int, scale: tuple[float, float]) -> A.BasicTransform:
    """Version-tolerant RandomResizedCrop (albumentations 1.x vs 2.x signature)."""
    try:
        return A.RandomResizedCrop(size=(size, size), scale=tuple(scale), ratio=(0.85, 1.18), p=1.0)
    except TypeError:  # pragma: no cover - old albumentations
        return A.RandomResizedCrop(height=size, width=size, scale=tuple(scale), ratio=(0.85, 1.18), p=1.0)


def build_train_transform(image_size: int, preset: dict[str, Any], enable_lighting_aug: bool = False) -> A.Compose:
    """Compose augmentation pipeline from a preset dict (see config/augmentation.yaml).

    Lighting augmentations (brightness, contrast, HSV shift, shadow) are disabled by default
    to preserve subtle cultivar lustre and colour cast signals, unless enable_lighting_aug=True.
    """
    p = preset
    steps: list[A.BasicTransform] = [
        A.SmallestMaxSize(max_size=int(image_size * 1.15), p=1.0),
        _random_resized_crop(image_size, tuple(p.get("random_crop_scale", (0.75, 1.0)))),
    ]
    if p.get("horizontal_flip", 0) > 0:
        steps.append(A.HorizontalFlip(p=p["horizontal_flip"]))
    if p.get("vertical_flip", 0) > 0:
        steps.append(A.VerticalFlip(p=p["vertical_flip"]))
    if p.get("rotate_p", 0) > 0 and p.get("rotate_limit", 0) > 0:
        steps.append(A.Rotate(limit=p["rotate_limit"], p=p["rotate_p"]))
    if p.get("affine_p", 0) > 0:
        steps.append(
            A.Affine(
                scale=tuple(p.get("affine_scale", (0.9, 1.1))),
                translate_percent=p.get("affine_translate", 0.05),
                shear=p.get("affine_shear", 5),
                p=p["affine_p"],
            )
        )
    if enable_lighting_aug:
        if p.get("color_p", 0) > 0:
            steps.append(
                A.RandomBrightnessContrast(
                    brightness_limit=p.get("brightness_limit", 0.15),
                    contrast_limit=p.get("contrast_limit", 0.15),
                    p=p["color_p"],
                )
            )
        if p.get("tone_curve_p", 0) > 0 and hasattr(A, "RandomToneCurve"):
            steps.append(A.RandomToneCurve(scale=float(p.get("tone_curve_scale", 0.1)), p=float(p["tone_curve_p"])))
        if p.get("hsv_p", 0) > 0:
            steps.append(
                A.HueSaturationValue(
                    hue_shift_limit=p.get("hue_shift_limit", 5),
                    sat_shift_limit=p.get("sat_shift_limit", 15),
                    val_shift_limit=p.get("val_shift_limit", 10),
                    p=p["hsv_p"],
                )
            )
        if p.get("shadow_p", 0) > 0:
            steps.append(A.RandomShadow(p=p["shadow_p"]))
    if p.get("blur_p", 0) > 0:
        steps.append(A.GaussianBlur(blur_limit=(3, int(p.get("blur_limit", 3)) | 1), p=p["blur_p"]))
    if p.get("noise_p", 0) > 0:
        steps.append(A.GaussNoise(p=p["noise_p"]))
    steps += [A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD), ToTensorV2()]
    return A.Compose(steps)


def build_eval_transform(image_size: int) -> A.Compose:
    """Deterministic resize-shorter-side + centre-crop + normalise."""
    return A.Compose(
        [
            A.SmallestMaxSize(max_size=image_size, p=1.0),
            A.CenterCrop(height=image_size, width=image_size, p=1.0),
            A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ToTensorV2(),
        ]
    )


def apply_transform(transform: A.Compose, image_rgb: np.ndarray):
    """Apply an albumentations pipeline to an HWC uint8 RGB array and return a tensor."""
    return transform(image=image_rgb)["image"]
