"""Environment-driven settings (pydantic-settings).

Values are read from process environment variables and ``backend/.env``.
Relative paths resolve against the repository root so the backend can be
started from any working directory.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR: Path = Path(__file__).resolve().parents[1]
REPO_ROOT: Path = BACKEND_DIR.parent


def _abs(path: str | Path) -> Path:
    p = Path(path).expanduser()
    return p if p.is_absolute() else (REPO_ROOT / p).resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Cotton Grade API"
    app_env: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"
    log_json: bool = False

    # ---- model -----------------------------------------------------------
    model_mode: Literal["mock", "trained"] = "mock"
    model_registry_path: str = "models/registry.json"
    model_device: str = "auto"
    unknown_threshold: float = Field(0.6, ge=0.0, le=1.0)
    varieties_path: str = "config/varieties.yaml"
    mock_image_size: int = 224
    default_top_k: int = 3
    max_top_k: int = 10
    warm_model_on_startup: bool = True

    # ---- storage / database ---------------------------------------------
    database_url: str = f"sqlite:///{(REPO_ROOT / 'backend' / 'storage' / 'cottonvision.db').as_posix()}"
    upload_dir: str = "backend/storage/uploads"
    gradcam_dir: str = "backend/storage/gradcam"
    public_base_url: str | None = None  # e.g. https://api.example.com ; defaults to request base URL

    # ---- uploads ---------------------------------------------------------
    max_upload_mb: float = Field(10.0, gt=0)
    min_image_dimension: int = 64
    max_image_dimension: int = 8000
    max_image_pixels: int = 40_000_000
    max_batch_size: int = 8
    inference_timeout_s: float = 60.0

    # ---- security --------------------------------------------------------
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    api_key: str | None = None  # when set, X-API-Key is required on mutating/predict endpoints
    rate_limit_per_minute: int = 0  # 0 disables the in-memory limiter

    @field_validator("log_level")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    # ---- derived ---------------------------------------------------------
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def registry_path(self) -> Path:
        return _abs(self.model_registry_path)

    @property
    def upload_path(self) -> Path:
        return _abs(self.upload_dir)

    @property
    def gradcam_path(self) -> Path:
        return _abs(self.gradcam_dir)

    @property
    def varieties_file(self) -> Path:
        return _abs(self.varieties_path)

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
