"""Upload validation: size, magic bytes, decodability, dimensions. Extensions are never trusted."""

from __future__ import annotations

import re
from dataclasses import dataclass

from PIL import Image

from backend.app.config import Settings
from backend.app.errors import APIError
from ml.data.preprocessing import InvalidImageError, load_image

SUPPORTED_FORMATS: dict[str, str] = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
SUPPORTED_MIME: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")


@dataclass
class ValidatedImage:
    image: Image.Image
    format: str  # JPEG | PNG | WEBP
    extension: str
    width: int
    height: int
    size_bytes: int
    original_filename: str | None


def sniff_format(data: bytes) -> str | None:
    """Identify JPEG/PNG/WEBP from magic bytes."""
    if data[:3] == b"\xff\xd8\xff":
        return "JPEG"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "PNG"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"
    return None


def sanitize_filename(name: str | None, max_len: int = 120) -> str | None:
    """Keep a display-safe version of the client filename (never used on disk)."""
    if not name:
        return None
    name = name.replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .")
    return name[:max_len] or None


def validate_upload(data: bytes, filename: str | None, content_type: str | None, settings: Settings) -> ValidatedImage:
    if not data:
        raise APIError(400, "empty_file", "The uploaded file is empty")
    if len(data) > settings.max_upload_bytes:
        raise APIError(
            413,
            "file_too_large",
            f"Image exceeds the maximum upload size of {settings.max_upload_mb:g} MB",
            {"max_upload_mb": settings.max_upload_mb, "received_bytes": len(data)},
        )

    fmt = sniff_format(data)
    if fmt is None:
        raise APIError(
            415,
            "unsupported_media_type",
            "Unsupported or unrecognised image format. Upload a JPEG, PNG or WEBP image.",
            {"declared_content_type": content_type},
        )

    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    try:
        img = load_image(data)
    except InvalidImageError as exc:
        raise APIError(400, "corrupt_image", f"The image could not be decoded: {exc}") from exc
    except Image.DecompressionBombError as exc:
        raise APIError(413, "image_too_large", "Image pixel count exceeds the allowed maximum") from exc

    w, h = img.size
    if w < settings.min_image_dimension or h < settings.min_image_dimension:
        raise APIError(400, "image_too_small", f"Image must be at least {settings.min_image_dimension}px on each side (got {w}x{h})")
    if w > settings.max_image_dimension or h > settings.max_image_dimension:
        raise APIError(413, "image_too_large", f"Image must be at most {settings.max_image_dimension}px on each side (got {w}x{h})")

    return ValidatedImage(
        image=img,
        format=fmt,
        extension=SUPPORTED_FORMATS[fmt],
        width=w,
        height=h,
        size_bytes=len(data),
        original_filename=sanitize_filename(filename),
    )
