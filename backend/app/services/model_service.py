"""Loads the predictor exactly once (app lifespan) and exposes its state."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

from backend.app.config import Settings
from backend.app.errors import APIError
from backend.app.services.varieties import VarietyCatalog
from ml.inference import BasePredictor, PredictorLoadError, build_predictor
from ml.registry import ModelRegistry

logger = logging.getLogger("backend.model")


class ModelService:
    def __init__(self, settings: Settings, catalog: VarietyCatalog) -> None:
        self.settings = settings
        self.catalog = catalog
        self.predictor: BasePredictor | None = None
        self.status: str = "loading"
        self.error: str | None = None
        self.loaded_at: float | None = None
        self._lock = threading.Lock()

    def _get_mock_fallback_classes(self) -> list[str]:
        # Explicit mock classes configuration
        mock_file = self.settings.registry_path.parent.parent / "config" / "mock_classes.json"
        if mock_file.exists():
            import json
            try:
                with open(mock_file, encoding="utf-8") as fh:
                    data = json.load(fh)
                    if "class_names" in data and isinstance(data["class_names"], list):
                        return [str(c) for c in data["class_names"]]
            except Exception as exc:
                logger.warning("Failed loading mock_classes.json: %s", exc)
        return self.catalog.all_class_names()

    # ------------------------------------------------------------------ lifecycle
    def load(self) -> None:
        with self._lock:
            self.status, self.error = "loading", None
            t0 = time.perf_counter()
            try:
                self.predictor = build_predictor(
                    mode=self.settings.model_mode,
                    registry_path=self.settings.registry_path,
                    fallback_class_names=self._get_mock_fallback_classes(),
                    unknown_threshold=self.settings.unknown_threshold,
                    device=self.settings.model_device,
                    image_size=self.settings.mock_image_size,
                    warm=self.settings.warm_model_on_startup,
                )
                self.status, self.loaded_at = "ready", time.time()
                logger.info(
                    "model_loaded",
                    extra={
                        "mode": self.settings.model_mode,
                        "model": self.predictor.model_name,
                        "device": self.predictor.device,
                        "seconds": round(time.perf_counter() - t0, 2),
                    },
                )
            except PredictorLoadError as exc:
                self.predictor, self.status, self.error = None, "error", str(exc)
                logger.error("model_load_failed", extra={"mode": self.settings.model_mode, "error": str(exc)})
            except Exception as exc:  # corrupt checkpoint, driver errors ...
                self.predictor, self.status, self.error = None, "error", f"{type(exc).__name__}: {exc}"
                logger.exception("model_load_crashed")

    def require(self) -> BasePredictor:
        if self.predictor is None or self.status != "ready":
            raise APIError(503, "model_unavailable", "No model is loaded. " + (self.error or "The model is still loading."), {"mode": self.settings.model_mode})
        return self.predictor

    # ------------------------------------------------------------------ queries
    @property
    def is_mock(self) -> bool:
        return self.predictor.is_mock if self.predictor else self.settings.model_mode == "mock"

    def class_names(self) -> tuple[list[str], str]:
        if self.predictor:
            if not self.predictor.is_mock:
                return list(self.predictor.class_names), "registry"
            return list(self.predictor.class_names), "fallback_config"
        if self.settings.model_mode == "trained":
            # In trained mode without an active predictor, never leak mock classes!
            entry = self.registry().active_entry()
            if entry and entry.class_names:
                return list(entry.class_names), "registry"
            return [], "registry"
        return self._get_mock_fallback_classes(), "fallback_config"

    def registry(self) -> ModelRegistry:
        return ModelRegistry(self.settings.registry_path)

    def active_info(self) -> dict[str, Any]:
        entry = self.registry().active_entry()
        base: dict[str, Any] = {
            "mode": self.settings.model_mode,
            "status": self.status,
            "is_mock": self.is_mock,
            "registry_entry": entry.to_dict() if entry else None,
            "error": self.error,
        }
        if self.predictor:
            info = self.predictor.info()
            base.update(
                {
                    "model_name": info["model_name"],
                    "model_version": info["model_version"],
                    "architecture": info["architecture"],
                    "device": info["device"],
                    "num_classes": info["num_classes"],
                    "class_names": info["class_names"],
                    "image_size": info["image_size"],
                    "calibration_temperature": info["calibration_temperature"],
                    "ood": info["ood"],
                    "num_parameters": info.get("num_parameters"),
                }
            )
            base["message"] = (
                "Demo mode — trained model not loaded. Predictions are deterministic placeholders."
                if self.predictor.is_mock
                else f"Serving trained model '{info['model_name']}' v{info['model_version']}."
            )
        else:
            base.update(
                {k: None for k in ("model_name", "model_version", "architecture", "device", "num_classes", "image_size", "calibration_temperature", "ood")}
            )
            base["class_names"] = []
            base["message"] = self.error or "Model is loading."
        return base
