"""
Tests for System Health Probe (GET /healthz and GET /)
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient):
    """Verify API root endpoint returns system identity."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["system"] == "O-Finance Private Financial OS"
    assert data["status"] == "operational"
    assert "version" in data


@pytest.mark.asyncio
async def test_healthz_unconfigured_subsystems(async_client: AsyncClient):
    """
    Verify GET /healthz returns correct granular status when database and
    Gemini keys are unconfigured. Must NOT falsely report connected.
    """
    response = await async_client.get("/healthz")
    assert response.status_code == 200
    data = response.json()

    assert data["api_service_alive"] is True
    assert "subsystems" in data

    subsystems = data["subsystems"]
    assert "postgres" in subsystems
    assert "gemini_api_key" in subsystems
    assert "gemini_model" in subsystems

    # When unconfigured, PostgreSQL must show unconfigured, not healthy
    postgres = subsystems["postgres"]
    assert postgres["status"] == "unconfigured"
    assert postgres["configured"] is False
    assert postgres["reachable"] is False

    # Gemini key must show unconfigured
    gemini_key = subsystems["gemini_api_key"]
    assert gemini_key["configured"] is False
    assert gemini_key["status"] == "unconfigured"

    # Gemini model must show unconfigured/unreachable
    gemini_model = subsystems["gemini_model"]
    assert gemini_model["reachable"] is False
