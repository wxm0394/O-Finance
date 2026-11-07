from __future__ import annotations
"""
Tests for System Health Probe (GET /healthz and GET /)
Strictly tests:
- API Process Alive
- PostgreSQL reachability and unconfigured state
- Gemini Key Configured vs. Model Verified distinction
- Local Ollama Mode behavior
"""

import pytest
from httpx import AsyncClient
from app.core.config import settings


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
    assert data["status"] in ("degraded", "unhealthy")
    assert "subsystems" in data

    subsystems = data["subsystems"]
    assert "postgres" in subsystems
    assert "gemini_api_key" in subsystems
    assert "gemini_model" in subsystems
    assert "ollama" in subsystems

    # When unconfigured, PostgreSQL must show unconfigured, not healthy
    postgres = subsystems["postgres"]
    assert postgres["status"] == "unconfigured"
    assert postgres["configured"] is False
    assert postgres["reachable"] is False

    # Gemini key must show unconfigured
    gemini_key = subsystems["gemini_api_key"]
    assert gemini_key["configured"] is False
    assert gemini_key["status"] == "unconfigured"

    # Gemini model must show unconfigured and unreachable
    gemini_model = subsystems["gemini_model"]
    assert gemini_model["configured"] is False
    assert gemini_model["reachable"] is False


@pytest.mark.asyncio
async def test_healthz_key_configured_does_not_equal_model_verified(
    async_client: AsyncClient, monkeypatch
):
    """
    CRITICAL HEALTH INVARIANT:
    Having a GEMINI_API_KEY configured marks gemini_api_key as healthy,
    but gemini_model MUST remain reachable=False and status='degraded'
    because no live model inference probe has verified it yet.
    """
    monkeypatch.setattr(settings, "gemini_api_key", "AIzaSyTestKey123")
    monkeypatch.setattr(settings, "llm_provider", "Gemini")

    response = await async_client.get("/healthz")
    assert response.status_code == 200
    data = response.json()

    subsystems = data["subsystems"]

    # Key is configured (presence in env), but not yet verified with live API
    assert subsystems["gemini_api_key"]["configured"] is True
    assert subsystems["gemini_api_key"]["reachable"] is False
    assert subsystems["gemini_api_key"]["status"] == "healthy"

    # Model is NOT claimed to be verified/reachable
    assert subsystems["gemini_model"]["configured"] is True
    assert subsystems["gemini_model"]["reachable"] is False
    assert subsystems["gemini_model"]["status"] == "degraded"
    assert "probe pending" in subsystems["gemini_model"]["detail"].lower()


@pytest.mark.asyncio
async def test_healthz_local_ollama_mode(async_client: AsyncClient, monkeypatch):
    """
    Verify health behavior when Local Ollama mode is selected:
    - Active provider is Local Ollama
    - Ollama subsystem is marked configured
    - Gemini key is marked unconfigured (not applicable)
    """
    monkeypatch.setattr(settings, "llm_provider", "Local Ollama")
    monkeypatch.setattr(settings, "gemini_api_key", None)

    response = await async_client.get("/healthz")
    assert response.status_code == 200
    data = response.json()

    assert data["active_llm_provider"] == "Local Ollama"
    subsystems = data["subsystems"]

    assert subsystems["ollama"]["configured"] is True
    assert subsystems["gemini_api_key"]["configured"] is False
