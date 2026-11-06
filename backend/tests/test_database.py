"""
Tests for Database Layer (SQLAlchemy 2.x + psycopg 3)
Verifies:
- Unconfigured behavior (DATABASE_URL is None)
- Unreachable host failure
- Successful SELECT 1 connection (mocked)
- Strict timeout enforcement via asyncio.wait_for (hanging query simulation)
- Unexpected response handling
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from app.core.config import settings
from app.core.database import (
    get_engine,
    get_session_factory,
    get_db_session,
    check_database_connection,
)


@pytest.mark.asyncio
async def test_database_unconfigured_behavior(monkeypatch):
    """
    Verify database layer behaves honestly when DATABASE_URL is not set:
    - check_database_connection returns (False, detail)
    - get_engine returns None
    - get_db_session raises ConnectionError
    - NEVER fabricates connection success.
    """
    monkeypatch.setattr(settings, "database_url", None)

    is_connected, detail = await check_database_connection()
    assert is_connected is False
    assert "not configured" in detail.lower() or "empty" in detail.lower()

    engine = get_engine()
    assert engine is None

    factory = get_session_factory()
    assert factory is None

    with pytest.raises(ConnectionError) as exc_info:
        async for _ in get_db_session():
            pass
    assert "not configured" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_database_unreachable_host_behavior(monkeypatch):
    """
    Verify database probe returns False when DATABASE_URL points to an unreachable host.
    Must never crash the API or report healthy.
    """
    # Use dummy non-routable port on localhost
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql+psycopg://dummy:dummy@127.0.0.1:54329/nonexistent_db",
    )

    is_connected, detail = await check_database_connection(timeout_seconds=0.5)
    assert is_connected is False
    assert "connection error" in detail.lower() or "failed" in detail.lower() or "timeout" in detail.lower()


@pytest.mark.asyncio
async def test_database_successful_connection_mocked(monkeypatch):
    """
    Verify that when the engine executes SELECT 1 successfully,
    check_database_connection returns True with success detail.
    """
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql+psycopg://user:pass@127.0.0.1:5432/mock_ofinance",
    )

    mock_result = MagicMock()
    mock_result.scalar.return_value = 1

    mock_conn = AsyncMock()
    mock_conn.execute.return_value = mock_result

    # Async context manager for engine.connect()
    mock_connect_ctx = AsyncMock()
    mock_connect_ctx.__aenter__.return_value = mock_conn
    mock_connect_ctx.__aexit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connect_ctx

    with patch("app.core.database.get_engine", return_value=mock_engine):
        is_connected, detail = await check_database_connection(timeout_seconds=1.0)
        assert is_connected is True
        assert "reachable" in detail.lower()
        mock_conn.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_database_timeout_enforcement_on_hanging_query(monkeypatch):
    """
    Verify asyncio.wait_for strictly halts hanging/slow database queries
    within timeout_seconds and returns an honest timeout message.
    """
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql+psycopg://user:pass@127.0.0.1:5432/mock_ofinance",
    )

    # Simulate query that hangs for 2.0 seconds
    async def hanging_execute(*args, **kwargs):
        await asyncio.sleep(2.0)
        mock_res = MagicMock()
        mock_res.scalar.return_value = 1
        return mock_res

    mock_conn = AsyncMock()
    mock_conn.execute = hanging_execute

    mock_connect_ctx = AsyncMock()
    mock_connect_ctx.__aenter__.return_value = mock_conn
    mock_connect_ctx.__aexit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connect_ctx

    with patch("app.core.database.get_engine", return_value=mock_engine):
        # Timeout set to 0.1s; query hangs for 2.0s
        start_time = asyncio.get_event_loop().time()
        is_connected, detail = await check_database_connection(timeout_seconds=0.1)
        duration = asyncio.get_event_loop().time() - start_time

        assert is_connected is False
        assert "timed out" in detail.lower()
        # Verify it aborted promptly around 0.1s, not waiting 2.0s
        assert duration < 1.0
        # Verify context manager exited (resource release)
        mock_connect_ctx.__aexit__.assert_awaited_once()


@pytest.mark.asyncio
async def test_database_unexpected_query_scalar(monkeypatch):
    """
    Verify that if SELECT 1 returns an unexpected value,
    check_database_connection returns False.
    """
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql+psycopg://user:pass@127.0.0.1:5432/mock_ofinance",
    )

    mock_result = MagicMock()
    mock_result.scalar.return_value = 0  # Unexpected!

    mock_conn = AsyncMock()
    mock_conn.execute.return_value = mock_result

    mock_connect_ctx = AsyncMock()
    mock_connect_ctx.__aenter__.return_value = mock_conn
    mock_connect_ctx.__aexit__.return_value = None

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_connect_ctx

    with patch("app.core.database.get_engine", return_value=mock_engine):
        is_connected, detail = await check_database_connection(timeout_seconds=1.0)
        assert is_connected is False
        assert "unexpected query response" in detail.lower()
