"""API routers mounted under ``/api/v1``."""

from fastapi import APIRouter

from backend.app.routers import classes, health, models, predict, predictions, quality, research, statistics, system

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(classes.router, prefix="/classes", tags=["classes"])
api_router.include_router(predict.router, prefix="/predict", tags=["prediction"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["history"])
api_router.include_router(statistics.router, prefix="/statistics", tags=["statistics"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(research.router, prefix="/research", tags=["research"])
api_router.include_router(quality.router, prefix="/quality", tags=["cotton quality"])

__all__ = ["api_router"]
