"""
O-Finance External Research Read-Only Connector
Enforces localhost/loopback URL boundary validation and HTTP GET method restriction.
Provides graceful fallback when port 8090 external service is inactive.
"""

from urllib.parse import urlparse
from typing import Dict, Any, Optional
import httpx


class SecurityViolationError(Exception):
    """Raised when external connector request violates security boundary policies."""
    pass


ALLOWED_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def validate_connector_request(url: str, method: str = "GET") -> None:
    """
    Validates that connector request is restricted to loopback address and HTTP GET method.
    Raises SecurityViolationError on policy violation.
    """
    if method.upper() != "GET":
        raise SecurityViolationError(
            f"Security Violation: External connector strictly permits GET operations only. Received '{method}'."
        )

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise SecurityViolationError(
            f"Security Violation: Invalid URL scheme '{parsed.scheme}'. Only http/https supported."
        )

    hostname = parsed.hostname or ""
    if hostname.lower() not in ALLOWED_LOOPBACK_HOSTS:
        raise SecurityViolationError(
            f"Security Violation: External connector restricted to local loopback (127.0.0.1/localhost). Attempted target: '{hostname}'."
        )


async def ping_connector(
    base_url: str = "http://127.0.0.1:8090", timeout: float = 1.0, method: str = "GET"
) -> Dict[str, Any]:
    """
    Probes external daily stock analysis service status.
    Returns graceful fallback payload when port 8090 is inactive.
    """
    validate_connector_request(url=base_url, method=method)

    target_url = f"{base_url.rstrip('/')}/health"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(target_url)
            if resp.status_code == 200:
                return {
                    "status": "connected",
                    "connector_id": "daily_analysis_connector",
                    "url": base_url,
                    "service_name": "Daily Stock Analysis Service",
                    "response_time_ms": resp.elapsed.total_seconds() * 1000.0 if hasattr(resp, "elapsed") else 5.0,
                    "details": resp.json() if resp.headers.get("content-type") == "application/json" else resp.text,
                }
    except Exception:
        pass

    return {
        "status": "not_connected",
        "connector_id": "daily_analysis_connector",
        "url": base_url,
        "service_name": "Daily Stock Analysis Service (External)",
        "boundary_policy": "Read-Only Loopback Connector (127.0.0.1:8090)",
        "message": "External research connector inactive or port 8090 unreachable. Operating in standalone mode.",
    }


async def fetch_reports(
    base_url: str = "http://127.0.0.1:8090", timeout: float = 1.5, method: str = "GET"
) -> Dict[str, Any]:
    """
    Fetches daily stock research reports from external service.
    Returns graceful fallback when port 8090 is inactive.
    """
    validate_connector_request(url=base_url, method=method)

    target_url = f"{base_url.rstrip('/')}/api/v1/reports"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(target_url)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "connected",
                    "connector_id": "daily_analysis_connector",
                    "count": len(data) if isinstance(data, list) else 1,
                    "reports": data,
                }
    except Exception:
        pass

    return {
        "status": "not_connected",
        "connector_id": "daily_analysis_connector",
        "url": base_url,
        "reports": [
            {
                "id": "REP-DEMO-001",
                "date": "2026-11-05",
                "title": "Daily Semiconductor & AI Infrastructure CapEx Note",
                "category": "Sector Research",
                "summary": "Standalone report briefing loaded via read-only daily analysis connector interface.",
                "sentiment": "Constructive",
            }
        ],
        "message": "External daily analysis service unavailable. Returned cached/demo report stream.",
    }
