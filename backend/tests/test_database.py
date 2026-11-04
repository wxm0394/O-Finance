"""
Tests for Database Layer (SQLAlchemy 2.x + psycopg 3)
Verifies honest probe behavior when database is not configured.
"""

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
    assert "PostgreSQL is not configured" in str(exc_info.value)


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
    assert "connection error" in detail.lower() or "failed" in detail.lower()
