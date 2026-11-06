"""
O-Finance Market Intelligence Schemas
Strict snake_case DTOs matching /api/v1/market-intelligence/* wire contract.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ConnectorStatusDto(BaseModel):
    """Response payload for connector health/status probe."""
    status: str = Field(..., description="Connection status: 'connected' or 'not_connected'.")
    connector_id: str = Field(..., description="Unique connector identifier.")
    url: str = Field(..., description="Base URL that was probed.")
    service_name: Optional[str] = Field(
        None, description="Human-readable service name."
    )
    message: Optional[str] = Field(
        None,
        description="Optional human-readable status message.",
    )
    response_time_ms: Optional[float] = Field(
        None,
        description="Probe response time in milliseconds, if available.",
    )
    boundary_policy: Optional[str] = Field(
        None,
        description="Security boundary policy declaration.",
    )
    details: Optional[Any] = Field(
        None,
        description="Additional probe details.",
    )


class ReportsResponseDto(BaseModel):
    """Response payload for external research report retrieval."""
    status: str = Field(..., description="Connection status: 'connected' or 'not_connected'.")
    connector_id: str = Field(..., description="Unique connector identifier.")
    count: Optional[int] = Field(
        None, description="Number of reports retrieved."
    )
    reports: List[Dict[str, Any]] = Field(
        ...,
        description="List of report metadata dicts.",
    )
    message: Optional[str] = Field(
        None,
        description="Optional human-readable status message.",
    )
    url: Optional[str] = Field(
        None,
        description="Base URL of the connector.",
    )
