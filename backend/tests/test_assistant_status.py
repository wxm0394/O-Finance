from __future__ import annotations
"""
Tests for Assistant Status Endpoint (GET /api/v1/assistant/status)
"""

import pytest
from httpx import AsyncClient

EXPECTED_TASK_MODES = [
    "accounting",
    "portfolio_analysis",
    "research",
    "quantitative_research",
    "audit",
    "risk_analysis",
]


@pytest.mark.asyncio
async def test_assistant_status_dto_contract(async_client: AsyncClient):
    """
    Verify /api/v1/assistant/status conforms strictly to the snake_case DTO
    and exposes the unified OFinanceAssistant with 6 supported modes.
    """
    response = await async_client.get("/api/v1/assistant/status")
    assert response.status_code == 200
    data = response.json()

    # Core identity
    assert data["assistant_name"] == "OFinanceAssistant"
    assert data["runtime_mode"] == "LOCAL_FASTAPI"
    assert "runtime_status" in data

    # Supported modes: must include all 6 modes
    supported_modes = data["supported_modes"]
    assert set(supported_modes) == set(EXPECTED_TASK_MODES)

    # Honesty invariant: model_verified must NOT be true when unverified
    assert data["model_verified"] is False

    # Budget & usage metrics are present
    assert "daily_budget_usd" in data
    assert "real_budget_used_today_usd" in data
    assert "real_tokens_used_today" in data
    assert "simulated_tasks_executed_today" in data
