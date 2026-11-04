"""
O-Finance Health Check Schemas
Explicitly separates API liveness, PostgreSQL connectivity,
Gemini API Key configuration, Gemini model verification,
and Local Ollama daemon connectivity.
"""

from typing import Dict, Literal, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

SubsystemState = Literal["healthy", "degraded", "unconfigured", "unreachable"]


class SubsystemStatusDto(BaseModel):
    status: SubsystemState
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
    active_llm_provider: str
    subsystems: Dict[str, SubsystemStatusDto]
