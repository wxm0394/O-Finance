"""
O-Finance Market Intelligence API Endpoints (/api/v1/market-intelligence)
Provides read-only status and report fetching from external research connector.
Strictly enforces local loopback (127.0.0.1/localhost) and HTTP GET restrictions.
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status

from app.core.config import settings
from app.connectors.daily_analysis_connector import (
    ping_connector,
    fetch_reports,
    SecurityViolationError,
)
from app.schemas.market_intelligence import ConnectorStatusDto, ReportsResponseDto

router = APIRouter(prefix="/market-intelligence", tags=["Market Intelligence"])


@router.get(
    "/connector-status",
    response_model=ConnectorStatusDto,
    summary="Get Daily Analysis Connector Status",
    description="Probes external daily stock analysis connector on port 8090. "
    "Returns graceful fallback status='not_connected' when port is inactive.",
)
async def get_connector_status(
    base_url: Optional[str] = Query(None, description="Optional target URL override.")
) -> ConnectorStatusDto:
    target_url = base_url or settings.daily_analysis_api_url or "http://127.0.0.1:8090"
    try:
        res = await ping_connector(base_url=target_url)
        return ConnectorStatusDto(
            status=res.get("status", "not_connected"),
            connector_id=res.get("connector_id", "daily_analysis_connector"),
            url=res.get("url", target_url),
            service_name=res.get("service_name"),
            message=res.get("message"),
            response_time_ms=res.get("response_time_ms"),
            boundary_policy=res.get("boundary_policy"),
            details=res.get("details"),
        )
    except SecurityViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Policy Violation: {str(e)}",
        ) from e


@router.get(
    "/reports",
    response_model=ReportsResponseDto,
    summary="Fetch Research Reports from Connector",
    description="Fetches research report stream from external daily analysis connector on port 8090. "
    "Returns graceful fallback stream when port is inactive.",
)
async def get_research_reports(
    base_url: Optional[str] = Query(None, description="Optional target URL override.")
) -> ReportsResponseDto:
    target_url = base_url or settings.daily_analysis_api_url or "http://127.0.0.1:8090"
    try:
        res = await fetch_reports(base_url=target_url)
        return ReportsResponseDto(
            status=res.get("status", "not_connected"),
            connector_id=res.get("connector_id", "daily_analysis_connector"),
            count=res.get("count"),
            reports=res.get("reports", []),
            message=res.get("message"),
            url=res.get("url", target_url),
        )
    except SecurityViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Policy Violation: {str(e)}",
        ) from e