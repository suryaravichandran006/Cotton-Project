from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.app.container import Services, get_services
from backend.app.errors import APIError
from backend.app.schemas import ClassesResponse, ClassInfo, VarietyInfo

router = APIRouter()


@router.get("", response_model=ClassesResponse, summary="Classes the active model can predict")
def list_classes(services: Services = Depends(get_services)) -> ClassesResponse:
    names, source = services.models.class_names()
    return ClassesResponse(
        num_classes=len(names),
        source=source,  # type: ignore[arg-type]
        is_mock=services.models.is_mock,
        classes=[
            ClassInfo(index=i, class_name=n, display_name=services.catalog.display_name(n), variety=services.catalog.lookup(n)) for i, n in enumerate(names)
        ],
    )


@router.get("/{class_name}", response_model=VarietyInfo, summary="Variety information for one class")
def class_detail(class_name: str, services: Services = Depends(get_services)) -> VarietyInfo:
    names, _ = services.models.class_names()
    if not services.models.is_mock:
        if class_name not in names:
            raise APIError(404, "not_found", f"Class '{class_name}' is not known to the active model")
    else:
        if class_name not in names and services.catalog.lookup(class_name) is None:
            raise APIError(404, "not_found", f"Class '{class_name}' is not known to the active model")
    return services.catalog.describe(class_name)

