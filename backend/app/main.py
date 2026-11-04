"""
O-Finance Private Financial OS — FastAPI Application Entry Point
Phase 2.1 Backend Foundation
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import get_engine
from app.api.v1.router import api_v1_router
from app.schemas.health import HealthCheckDto
from app.services.health_service import HealthService

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ofinance.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application startup and graceful shutdown."""
    logger.info(
        "Starting O-Finance Backend (Env: %s, Host: %s:%s)...",
        settings.app_env,
        settings.app_host,
        settings.app_port,
    )
    yield
    # Cleanup database engine pools
    engine = get_engine()
    if engine is not None:
        logger.info("Disposing async database connection pool...")
        await engine.dispose()
    logger.info("O-Finance Backend stopped.")


app = FastAPI(
    title="O-Finance Private Financial OS API",
    version="0.4.0",
    description=(
        "Local-First Private Financial Operating System Backend. "
        "Provides REST endpoints for OFinanceAssistant, multi-institution account feeds, "
        "and Beancount plain-text double-entry integration."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 Routes (/api/v1/...)
app.include_router(api_v1_router)


@app.get(
    "/healthz",
    response_model=HealthCheckDto,
    status_code=status.HTTP_200_OK,
    tags=["System"],
    summary="Health & Liveness Probe",
    description="Returns live system health, PostgreSQL database reachability, and AI key configuration status.",
)
async def healthz() -> HealthCheckDto:
    """System health check endpoint."""
    return await HealthService.get_health_status()


@app.get("/", tags=["System"], summary="API Root")
async def root():
    """Root landing endpoint with system identity."""
    return {
        "system": "O-Finance Private Financial OS",
        "version": "0.4.0",
        "status": "operational",
        "docs": "/docs",
        "health": "/healthz",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "development",
    )
