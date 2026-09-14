"""Service container built once per app; request dependencies resolve from ``app.state``."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request

from backend.app.config import Settings
from backend.app.services.model_service import ModelService
from backend.app.services.prediction_service import PredictionService
from backend.app.services.storage import LocalStorage, StorageBackend
from backend.app.services.varieties import VarietyCatalog


@dataclass
class Services:
    settings: Settings
    storage: StorageBackend
    catalog: VarietyCatalog
    models: ModelService
    predictions: PredictionService


def build_services(settings: Settings) -> Services:
    storage = LocalStorage(settings)
    catalog = VarietyCatalog(settings.varieties_file)
    models = ModelService(settings, catalog)
    predictions = PredictionService(settings, storage, models, catalog)
    return Services(settings=settings, storage=storage, catalog=catalog, models=models, predictions=predictions)


def get_services(request: Request) -> Services:
    return request.app.state.services


def get_prediction_service(request: Request) -> PredictionService:
    return request.app.state.services.predictions


def get_model_service(request: Request) -> ModelService:
    return request.app.state.services.models


def base_url_of(request: Request) -> str:
    """Absolute origin for building file URLs (honours reverse-proxy headers)."""
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", request.url.netloc)
    prefix = request.headers.get("x-forwarded-prefix", "").rstrip("/")
    return f"{proto}://{host}{prefix}"
