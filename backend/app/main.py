"""FastAPI application factory.

Run from the repository root::

    uvicorn backend.app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app import __version__
from backend.app.config import Settings, get_settings
from backend.app.container import build_services
from backend.app.database import init_db
from backend.app.errors import register_exception_handlers
from backend.app.logging_config import configure_logging
from backend.app.routers import api_router

logger = logging.getLogger("backend")

API_DESCRIPTION = """
Cotton Grade identifies the **variety / cultivar of raw (ginned) cotton fibre** from an RGB photograph.

* `POST /api/v1/predict` — upload an image, receive the top prediction, calibrated confidence,
  top-k ranking, unknown/OOD flag, optional Grad-CAM and timing information.
* Every response carries `is_mock`. When the server runs with `MODEL_MODE=mock` no trained model
  is loaded and predictions are deterministic placeholders.
* Designed API-first so web and mobile clients share the same contract (see docs/API.md).
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.started_at = time.time()
        init_db()
        services = build_services(settings)
        app.state.services = services
        services.models.load()  # load once; never per request
        app.mount("/files/uploads", StaticFiles(directory=str(settings.upload_path)), name="uploads")
        app.mount("/files/gradcam", StaticFiles(directory=str(settings.gradcam_path)), name="gradcam")
        logger.info("startup_complete", extra={"mode": settings.model_mode, "model_status": services.models.status, "env": settings.app_env})
        yield
        logger.info("shutdown")

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=API_DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time-Ms"],
    )

    @app.middleware("http")
    async def request_logging(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed = (time.perf_counter() - t0) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{elapsed:.1f}"
        if not request.url.path.startswith("/files/"):
            logger.info(
                "request",
                extra={"method": request.method, "path": request.url.path, "status": response.status_code, "ms": round(elapsed, 1), "request_id": request_id},
            )
        return response

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {"app": settings.app_name, "version": __version__, "docs": "/docs", "api": settings.api_prefix, "health": f"{settings.api_prefix}/health"}

    @app.get("/health", include_in_schema=False)
    def root_health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
