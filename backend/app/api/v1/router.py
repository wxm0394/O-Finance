"""
O-Finance API v1 Central Router
"""

from fastapi import APIRouter
from app.api.v1.assistant import router as assistant_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(assistant_router)
