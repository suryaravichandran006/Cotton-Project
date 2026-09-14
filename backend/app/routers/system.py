from __future__ import annotations

import platform
import time

from fastapi import APIRouter, Depends, Request

from backend.app import __version__
from backend.app.container import Services, get_services
from backend.app.schemas import SystemInfoResponse
from backend.app.services.validation import SUPPORTED_MIME

router = APIRouter()


def _torch_info() -> tuple[str | None, bool | None, bool | None]:
    try:
        import torch

        mps = getattr(torch.backends, "mps", None)
        return torch.__version__, torch.cuda.is_available(), bool(mps and mps.is_available())
    except ImportError:
        return None, None, None


@router.get("/info", response_model=SystemInfoResponse, summary="Runtime / environment information")
def system_info(request: Request, services: Services = Depends(get_services)) -> SystemInfoResponse:
    torch_version, cuda, mps = _torch_info()
    s = services.settings
    return SystemInfoResponse(
        app=s.app_name,
        version=__version__,
        environment=s.app_env,
        python_version=platform.python_version(),
        platform=platform.platform(),
        torch_version=torch_version,
        cuda_available=cuda,
        mps_available=mps,
        device=services.models.predictor.device if services.models.predictor else None,
        mode=s.model_mode,
        model_status=services.models.status,
        max_upload_mb=s.max_upload_mb,
        supported_formats=list(SUPPORTED_MIME),
        database_backend=s.database_url.split(":", 1)[0],
        storage_backend=services.storage.name,
        uptime_seconds=round(time.time() - request.app.state.started_at, 1),
    )
