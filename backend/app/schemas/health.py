"""
O-Finance Health Check Schemas
Explicitly separates API liveness, PostgreSQL connectivity,
Gemini API Key configuration, and actual Model verification.
"""

from typing import Dict, Literal, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class SubsystemStatusDto(BaseModel):
    status: Literal["healthy", "degraded", "unconfigured", "unreachable"]
    configured: bool
    reachable: bool
    detail: str


class HealthCheckDto(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    api_service_alive: bool = True
    app_env: str
    subsystems: Dict[str, SubsystemStatusDto]
