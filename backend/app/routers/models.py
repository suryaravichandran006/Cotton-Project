from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.app.container import Services, get_services
from backend.app.schemas import ActiveModelResponse, ModelsResponse, RegistryModel

router = APIRouter()


@router.get("", response_model=ModelsResponse, summary="List models in the registry")
def list_models(services: Services = Depends(get_services)) -> ModelsResponse:
    registry = services.models.registry()
    return ModelsResponse(
        registry_path=str(registry.path),
        active_model=registry.active_model,
        mode=services.settings.model_mode,
        models=[
            RegistryModel(
                name=m.name,
                version=m.version,
                architecture=m.architecture,
                checkpoint=m.checkpoint,
                class_names=m.class_names,
                image_size=m.image_size,
                calibration_temperature=m.calibration_temperature,
                ood=m.ood,
                metrics=m.metrics,
                trained_at=m.trained_at,
                registered_at=m.registered_at,
                git_commit=m.git_commit,
                description=m.description,
                size_mb=m.size_mb,
                is_active=m.name == registry.active_model,
                checkpoint_exists=bool((p := m.resolve("checkpoint")) and p.exists()),
            )
            for m in registry.models
        ],
    )


@router.get("/active", response_model=ActiveModelResponse, summary="Currently served model (or mock)")
def active_model(services: Services = Depends(get_services)) -> ActiveModelResponse:
    return ActiveModelResponse(**services.models.active_info())
