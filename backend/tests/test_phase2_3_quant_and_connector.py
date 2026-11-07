from __future__ import annotations
"""
O-Finance Phase 2.3 Tests: Quantitative Backtest Engine & External Research Read-Only Connector
Verifies DuckDB + Parquet backtest execution across 5 models, friction cost deduction,
SecurityViolationError enforcement on loopback/method rules, API v1 endpoints, and audit logging.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db_session
from app.quant.backtest_engine import (
    run_parameterized_backtest,
    get_available_strategies,
    generate_synthetic_ohlcv,
)
from app.connectors.daily_analysis_connector import (
    ping_connector,
    fetch_reports,
    validate_connector_request,
    SecurityViolationError,
)



@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Setup in-memory SQLite database and override get_db_session dependency."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db_session():
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db_session] = override_get_db_session
    yield session_factory
    app.dependency_overrides.clear()
    await engine.dispose()


def test_get_available_strategies_returns_5_models():
    strategies = get_available_strategies()
    assert len(strategies) == 5
    strategy_ids = [s["id"] for s in strategies]
    assert "ma_crossover" in strategy_ids
    assert "cross_sectional_momentum" in strategy_ids
    assert "bollinger_rsi_mean_reversion" in strategy_ids
    assert "multi_asset_donchian" in strategy_ids
    assert "quality_low_vol_fcf" in strategy_ids


def test_synthetic_ohlcv_generator_deterministic():
    data1 = generate_synthetic_ohlcv(["AAPL", "MSFT"], "2026-01-01", "2026-02-01")
    data2 = generate_synthetic_ohlcv(["AAPL", "MSFT"], "2026-01-01", "2026-02-01")
    assert len(data1["AAPL"]) == len(data2["AAPL"])
    assert data1["AAPL"][0]["close"] == data2["AAPL"][0]["close"]


@pytest.mark.parametrize(
    "strategy_id",
    [
        "ma_crossover",
        "cross_sectional_momentum",
        "bollinger_rsi_mean_reversion",
        "multi_asset_donchian",
        "quality_low_vol_fcf",
    ],
)
def test_run_parameterized_backtest_all_strategies(strategy_id: str):
    res = run_parameterized_backtest(
        strategy_id=strategy_id,
        symbols=["AAPL", "MSFT", "NVDA"],
        start_date="2026-01-01",
        end_date="2026-02-01",
        initial_capital=100000.0,
        commission_bps=5.0,
        slippage_bps=2.0,
    )

    assert res["experiment_id"].startswith("exp_")
    assert res["strategy_id"] == strategy_id
    assert "total_return_pct" in res
    assert "annualized_return_pct" in res
    assert "sharpe_ratio" in res
    assert "sortino_ratio" in res
    assert "max_drawdown_pct" in res
    assert "win_rate_pct" in res
    assert "profit_factor" in res
    assert "execution_time_ms" in res
    assert len(res["equity_curve"]) > 0


def test_backtest_friction_cost_deduction():
    low_friction = run_parameterized_backtest(
        strategy_id="ma_crossover",
        symbols=["AAPL"],
        start_date="2026-01-01",
        end_date="2026-03-01",
        initial_capital=100000.0,
        commission_bps=0.0,
        slippage_bps=0.0,
    )

    high_friction = run_parameterized_backtest(
        strategy_id="ma_crossover",
        symbols=["AAPL"],
        start_date="2026-01-01",
        end_date="2026-03-01",
        initial_capital=100000.0,
        commission_bps=100.0,
        slippage_bps=100.0,
    )

    assert low_friction["final_capital"] >= high_friction["final_capital"]


def test_connector_validation_security_rules():
    # Valid loopback GET requests
    validate_connector_request("http://127.0.0.1:8090/health", method="GET")
    validate_connector_request("http://localhost:8090/api/v1/reports", method="GET")

    # Non-GET method raises SecurityViolationError
    with pytest.raises(SecurityViolationError, match="GET operations only"):
        validate_connector_request("http://127.0.0.1:8090/post", method="POST")

    # Non-loopback host raises SecurityViolationError
    with pytest.raises(SecurityViolationError, match="local loopback"):
        validate_connector_request("http://external-api.com/reports", method="GET")

    # Invalid scheme raises SecurityViolationError
    with pytest.raises(SecurityViolationError, match="Invalid URL scheme"):
        validate_connector_request("ftp://127.0.0.1:8090", method="GET")


async def test_ping_connector_graceful_fallback():
    res = await ping_connector(base_url="http://127.0.0.1:8090", timeout=0.1)
    assert res["status"] in ("connected", "not_connected")
    assert res["connector_id"] == "daily_analysis_connector"


async def test_fetch_reports_graceful_fallback():
    res = await fetch_reports(base_url="http://127.0.0.1:8090", timeout=0.1)
    assert res["status"] in ("connected", "not_connected")
    assert res["connector_id"] == "daily_analysis_connector"
    assert len(res["reports"]) > 0


async def test_api_v1_quant_strategies_endpoint(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/quant/strategies")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] == 5
    assert len(data["strategies"]) == 5


async def test_api_v1_quant_backtest_endpoint_and_audit(async_client: AsyncClient):
    payload = {
        "strategy_id": "ma_crossover",
        "symbols": ["AAPL", "MSFT"],
        "start_date": "2026-01-01",
        "end_date": "2026-02-01",
        "initial_capital": 100000.0,
        "commission_bps": 5.0,
        "slippage_bps": 2.0,
    }

    resp = await async_client.post("/api/v1/quant/backtest", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["strategy_id"] == "ma_crossover"
    assert data["experiment_id"].startswith("exp_")
    assert "total_return_pct" in data

    # Verify audit log entry created via audit endpoint
    audit_resp = await async_client.get("/api/v1/audit/logs")
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) >= 1
    latest = logs[-1]
    assert latest["category"] == "Quantitative Backtest"
    assert latest["action"] == "execute_backtest"
    assert latest["target"] == data["experiment_id"]


async def test_api_v1_market_intelligence_endpoints(async_client: AsyncClient):
    # Connector status probe endpoint
    resp1 = await async_client.get("/api/v1/market-intelligence/connector-status")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] in ("connected", "not_connected")
    assert data1["connector_id"] == "daily_analysis_connector"

    # Reports endpoint
    resp2 = await async_client.get("/api/v1/market-intelligence/reports")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] in ("connected", "not_connected")
    assert len(data2["reports"]) > 0

    # Security violation via non-loopback URL parameter override
    resp3 = await async_client.get(
        "/api/v1/market-intelligence/connector-status?base_url=http://malicious-site.com:8090"
    )
    assert resp3.status_code == 400
    assert "Security Policy Violation" in resp3.json()["detail"]
