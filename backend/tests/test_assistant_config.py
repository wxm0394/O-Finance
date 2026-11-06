"""
Tests for Assistant Config Security & Key Isolation (GET /api/v1/assistant/config)
"""

import json
import pytest
from httpx import AsyncClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_assistant_config_does_not_leak_api_key_when_unconfigured(async_client: AsyncClient):
    """Verify endpoint never exposes key when unconfigured."""
    response = await async_client.get("/api/v1/assistant/config")
    assert response.status_code == 200
    data = response.json()

    assert data["api_key_configured"] is False
    assert "api_key" not in data
    assert "gemini_api_key" not in data


@pytest.mark.asyncio
async def test_assistant_config_isolates_key_when_configured(async_client: AsyncClient, monkeypatch):
    """
    CRITICAL SECURITY TEST:
    Even when GEMINI_API_KEY is populated in backend settings, the config endpoint
    must ONLY return a boolean `api_key_configured: true` and status description.
    Under NO circumstances should the raw secret string appear anywhere in the payload.
    """
    fake_secret = "AIzaSyMockedSecretKeyForSecurityTesting998877"
    monkeypatch.setattr(settings, "gemini_api_key", fake_secret)

    response = await async_client.get("/api/v1/assistant/config")
    assert response.status_code == 200
    data = response.json()

    # Confirms key is configured
    assert data["api_key_configured"] is True
    assert data["api_key_status"] == "Backend Key Configured (Unverified)"

    # Verify the secret string is absent from every field and the raw json text
    raw_text = response.text
    assert fake_secret not in raw_text

    # Verify structural schema
    assert "provider" in data
    assert "model" in data
    assert "base_url" in data
    assert "daily_budget_usd" in data
    assert "max_steps_per_run" in data


@pytest.mark.asyncio
async def test_update_assistant_config_endpoint(async_client: AsyncClient):
    """Verify POST /api/v1/assistant/config updates settings and masks secret keys."""
    payload = {
        "provider": "openai_compatible",
        "base_url": "https://api.siliconflow.cn/v1",
        "model_name": "deepseek-ai/DeepSeek-V3",
        "api_key": "sk-secret12345678",
    }

    response = await async_client.post("/api/v1/assistant/config", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["provider"] == "openai_compatible"
    assert data["base_url"] == "https://api.siliconflow.cn/v1"
    assert data["model"] == "deepseek-ai/DeepSeek-V3"
    assert data["api_key_configured"] is True
    assert data["api_key_masked"] == "sk-...5678"
    assert "sk-secret12345678" not in response.text


@pytest.mark.asyncio
async def test_probe_assistant_connection_endpoint(async_client: AsyncClient):
    """Verify POST /api/v1/assistant/probe performs reachability check and returns latency."""
    payload = {
        "provider": "openai_compatible",
        "base_url": "https://api.openai.com/v1",
        "model_name": "gpt-4o",
        "api_key": "sk-testkey",
    }

    response = await async_client.post("/api/v1/assistant/probe", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "reachable" in data
    assert "latency_ms" in data
    assert "provider" in data
    assert "base_url" in data
    assert "model" in data
    assert "message" in data
