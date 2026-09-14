"""Deterministic inference-time preprocessing (PIL + NumPy only, no torch).

This exact pipeline is used by the API predictor **and** mirrored by the
validation/test transform in training, so train-time evaluation and production
inference see identical inputs:

1. EXIF orientation normalisation
2. RGB conversion
3. aspect-ratio-safe resize of the shorter side to ``image_size``
4. centre crop to ``image_size × image_size``
5. scale to [0, 1] and ImageNet mean/std normalisation
6. HWC -> CHW float32 array
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError

from ml.config import IMAGENET_MEAN, IMAGENET_STD

ImageFile.LOAD_TRUNCATED_IMAGES = False


class InvalidImageError(ValueError):
    """Raised when bytes cannot be decoded as a valid raster image."""


@dataclass(frozen=True)
class PreprocessConfig:
    image_size: int = 224
    mean: tuple[float, float, float] = field(default=IMAGENET_MEAN)
    std: tuple[float, float, float] = field(default=IMAGENET_STD)
    resample: int = Image.Resampling.BICUBIC


def load_image(source: bytes | str | io.BytesIO | Image.Image) -> Image.Image:
    """Open, verify and orientation-normalise an image. Returns an RGB PIL image."""
    if isinstance(source, Image.Image):
        img = source
    else:
        buf = io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source
        try:
            probe = Image.open(buf)
            probe.verify()  # detects truncated / corrupt files
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
            raise InvalidImageError(f"Cannot decode image: {exc}") from exc
        if hasattr(buf, "seek"):
            buf.seek(0)
        img = Image.open(buf)
    try:
        img = ImageOps.exif_transpose(img) or img
        img = img.convert("RGB")
        img.load()
    except (OSError, ValueError) as exc:
        raise InvalidImageError(f"Cannot load image pixels: {exc}") from exc
    return img


def resize_shorter_side(img: Image.Image, size: int, resample: int = Image.Resampling.BICUBIC) -> Image.Image:
    w, h = img.size
    if w == 0 or h == 0:
        raise InvalidImageError("Image has zero width or height")
    scale = size / min(w, h)
    new_w, new_h = max(size, round(w * scale)), max(size, round(h * scale))
    return img.resize((new_w, new_h), resample=resample)


def center_crop(img: Image.Image, size: int) -> Image.Image:
    w, h = img.size
    left, top = (w - size) // 2, (h - size) // 2
    return img.crop((left, top, left + size, top + size))


def prepare_view(img: Image.Image, cfg: PreprocessConfig) -> Image.Image:
    """Resize + centre crop only (uint8 RGB). Used for Grad-CAM overlays."""
    if img.mode != "RGB":
        img = img.convert("RGB")
    return center_crop(resize_shorter_side(img, cfg.image_size, cfg.resample), cfg.image_size)


def normalize_array(arr: np.ndarray, cfg: PreprocessConfig) -> np.ndarray:
    """HWC uint8 -> CHW float32 normalised."""
    x = arr.astype(np.float32) / 255.0
    x = (x - np.asarray(cfg.mean, dtype=np.float32)) / np.asarray(cfg.std, dtype=np.float32)
    return np.ascontiguousarray(x.transpose(2, 0, 1))


def preprocess_image(img: Image.Image, cfg: PreprocessConfig | None = None) -> tuple[np.ndarray, Image.Image]:
    """Return ``(chw_float32_tensor_like, cropped_view_image)`` for an RGB PIL image."""
    cfg = cfg or PreprocessConfig()
    view = prepare_view(img, cfg)
    return normalize_array(np.asarray(view), cfg), view
