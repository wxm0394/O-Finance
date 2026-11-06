"""
Test Live Read-Only Subsystem Endpoints (/api/v1/*)
Verifies that all read endpoints return 200 OK and match expected data structures.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_accounts_endpoint(async_client: AsyncClient):
    res = await async_client.get("/api/v1/accounts")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["institution"] == "JPMorgan Chase"


@pytest.mark.asyncio
async def test_get_connectors_endpoint(async_client: AsyncClient):
    res = await async_client.get("/api/v1/connectors")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_transactions_endpoint(async_client: AsyncClient):
    res = await async_client.get("/api/v1/transactions")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_portfolio_endpoints(async_client: AsyncClient):
    res_holdings = await async_client.get("/api/v1/portfolio/holdings")
    assert res_holdings.status_code == 200
    assert isinstance(res_holdings.json(), list)

    res_history = await async_client.get("/api/v1/portfolio/history")
    assert res_history.status_code == 200
    assert isinstance(res_history.json(), list)

    res_cashflow = await async_client.get("/api/v1/portfolio/cashflow")
    assert res_cashflow.status_code == 200
    assert isinstance(res_cashflow.json(), list)


@pytest.mark.asyncio
async def test_get_market_endpoints(async_client: AsyncClient):
    res_watchlist = await async_client.get("/api/v1/market/watchlist")
    assert res_watchlist.status_code == 200
    assert isinstance(res_watchlist.json(), list)

    res_calendar = await async_client.get("/api/v1/market/calendar")
    assert res_calendar.status_code == 200
    assert isinstance(res_calendar.json(), list)


@pytest.mark.asyncio
async def test_get_ledger_entries_and_quant_backtests(async_client: AsyncClient):
    res_entries = await async_client.get("/api/v1/ledger/entries")
    assert res_entries.status_code == 200
    assert isinstance(res_entries.json(), list)

    res_backtests = await async_client.get("/api/v1/quant/backtests")
    assert res_backtests.status_code == 200
    assert isinstance(res_backtests.json(), list)


@pytest.mark.asyncio
async def test_post_sync_trigger(async_client: AsyncClient):
    res = await async_client.post("/api/v1/sync/trigger", json={"targetInstitution": "Chase"})
    assert res.status_code == 200
    data = res.json()
    assert data["target"] == "Chase"
    assert "Simulated Sync Completed" in data["status"]


@pytest.mark.asyncio
async def test_get_assistant_usage_and_tools_endpoints(async_client: AsyncClient):
    res_usage = await async_client.get("/api/v1/assistant/usage")
    assert res_usage.status_code == 200
    data_usage = res_usage.json()
    assert "daily_budget_usd" in data_usage
    assert "spend_usd_today" in data_usage
    assert data_usage["daily_budget_usd"] == 25.0

    res_tools = await async_client.get("/api/v1/assistant/tools")
    assert res_tools.status_code == 200
    data_tools = res_tools.json()
    assert "available_tools" in data_tools
    assert data_tools["total_tools"] == len(data_tools["available_tools"])
    assert data_tools["total_tools"] >= 4
