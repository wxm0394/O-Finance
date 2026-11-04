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
