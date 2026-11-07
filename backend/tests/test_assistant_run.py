from __future__ import annotations
"""
Tests for Assistant Run Contract & Validation (POST /api/v1/assistant/run)
"""

import pytest
from httpx import AsyncClient

VALID_MODES = [
    "accounting",
    "portfolio_analysis",
    "research",
    "quantitative_research",
    "audit",
    "risk_analysis",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("task_mode", VALID_MODES)
async def test_assistant_run_valid_task_modes_return_scaffold_contract(
    async_client: AsyncClient, task_mode: str
):
    """
    Verify POST /api/v1/assistant/run accepts all 6 valid task modes,
    and returns explicit 'scaffold_not_implemented' status without faking execution.
    """
    payload = {
        "task_mode": task_mode,
        "prompt": f"Verify system behavior under mode: {task_mode}",
        "base_currency": "USD",
        "confidence_threshold": 0.85,
        "max_tool_steps": 8,
    }
    response = await async_client.post("/api/v1/assistant/run", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["task_mode"] == task_mode
    assert data["status"] == "scaffold_not_implemented"
    assert data["is_implemented"] is False
    assert data["execution_origin"] == "LOCAL_FASTAPI_GEMINI"
    assert data["tool_steps"] == []
    assert data["tokens_used"] is None
    assert data["estimated_cost_usd"] is None
    assert "task_id" in data
    assert "P2.1 Backend Foundation Contract Verified" in data["message"]


@pytest.mark.asyncio
async def test_assistant_run_rejects_invalid_task_mode(async_client: AsyncClient):
    """
    Verify POST /api/v1/assistant/run strictly rejects unknown or disallowed task modes.
    e.g., automated execution modes like 'direct_trade_execution' must fail validation.
    """
    payload = {
        "task_mode": "direct_trade_execution",
        "prompt": "Attempt unauthorized execution",
        "base_currency": "USD",
    }
    response = await async_client.post("/api/v1/assistant/run", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_assistant_run_rejects_empty_prompt(async_client: AsyncClient):
    """Verify empty prompt string is rejected with HTTP 422."""
    payload = {
        "task_mode": "accounting",
        "prompt": "",
    }
    response = await async_client.post("/api/v1/assistant/run", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_assistant_run_rejects_invalid_confidence_threshold(async_client: AsyncClient):
    """Verify confidence threshold must be between 0.0 and 1.0."""
    payload = {
        "task_mode": "audit",
        "prompt": "Audit recent transactions",
        "confidence_threshold": 1.5,  # Invalid: > 1.0
    }
    response = await async_client.post("/api/v1/assistant/run", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_assistant_run_local_ollama_execution_origin(
    async_client: AsyncClient, monkeypatch
):
    """
    Verify POST /api/v1/assistant/run outputs LOCAL_FASTAPI_OLLAMA execution_origin
    when LLM_PROVIDER is set to Local Ollama.
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_provider", "Local Ollama")

    payload = {
        "task_mode": "accounting",
        "prompt": "Verify execution origin under Local Ollama",
    }
    response = await async_client.post("/api/v1/assistant/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["execution_origin"] == "LOCAL_FASTAPI_OLLAMA"
