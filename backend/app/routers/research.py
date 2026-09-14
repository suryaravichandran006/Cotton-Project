"""Research and transfer-learning metadata endpoints."""
from fastapi import APIRouter

from backend.app.services.research import experiment_comparison, research_overview

router = APIRouter()


@router.get("")
def overview():
    return research_overview()


@router.get("/experiments")
def experiments():
    return experiment_comparison()
