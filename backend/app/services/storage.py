"""File storage abstraction. ``LocalStorage`` today; S3-compatible later via the same interface."""

from __future__ import annotations

import secrets
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from backend.app.config import Settings

SAFE_EXT = {"jpeg": "jpg", "jpg": "jpg", "png": "png", "webp": "webp"}


@dataclass(frozen=True)
class StoredFile:
    key: str  # e.g. "uploads/2f3a...jpg" — what the DB stores
    path: Path | None  # local path when applicable


class StorageBackend(ABC):
    @abstractmethod
    def save(self, data: bytes, category: str, extension: str) -> StoredFile: ...

    @abstractmethod
    def delete(self, key: str) -> bool: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...

    @abstractmethod
    def public_url(self, key: str, base_url: str) -> str: ...

    @property
    @abstractmethod
    def name(self) -> str: ...


def secure_filename(extension: str) -> str:
    """Random, unguessable filename with a whitelisted extension (never the client's name)."""
    ext = SAFE_EXT.get(extension.lower().lstrip("."), "bin")
    return f"{secrets.token_hex(16)}.{ext}"


class LocalStorage(StorageBackend):
    """Stores files under per-category directories and serves them via ``/files``."""

    def __init__(self, settings: Settings) -> None:
        self.roots: dict[str, Path] = {"uploads": settings.upload_path, "gradcam": settings.gradcam_path}
        for root in self.roots.values():
            root.mkdir(parents=True, exist_ok=True)

    @property
    def name(self) -> str:
        return "local"

    def _resolve(self, key: str) -> Path:
        category, _, filename = key.partition("/")
        if category not in self.roots or not filename or "/" in filename or ".." in filename:
            raise ValueError(f"Invalid storage key: {key}")
        return self.roots[category] / filename

    def save(self, data: bytes, category: str, extension: str) -> StoredFile:
        if category not in self.roots:
            raise ValueError(f"Unknown storage category '{category}'")
        filename = secure_filename(extension)
        path = self.roots[category] / filename
        path.write_bytes(data)
        return StoredFile(key=f"{category}/{filename}", path=path)

    def delete(self, key: str) -> bool:
        try:
            path = self._resolve(key)
        except ValueError:
            return False
        if path.exists():
            path.unlink()
            return True
        return False

    def exists(self, key: str) -> bool:
        try:
            return self._resolve(key).exists()
        except ValueError:
            return False

    def public_url(self, key: str, base_url: str) -> str:
        return f"{base_url.rstrip('/')}/files/{key}"
