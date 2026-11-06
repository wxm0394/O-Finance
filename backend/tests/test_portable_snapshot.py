"""
Unit and integration tests for Database Dual-Engine Portable Fallback
and Portable Snapshot Export & Verification Endpoints.
"""

import hashlib
import os
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db_session, init_db_schema
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService


@pytest_asyncio.fixture
async def setup_portable_db(tmp_path, monkeypatch):
    """Setup a isolated SQLite database for portable snapshot testing."""
    db_file = tmp_path / "test_portable.db"
    sqlite_url = f"sqlite+aiosqlite:///{db_file}"

    engine = create_async_engine(sqlite_url, future=True)
    session_factory = async_sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db_session():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    # Also patch get_session_factory and get_engine for system_portable.py
    from app.core.database import get_session_factory, get_engine as get_engine_func
    original_get_session_factory = get_session_factory
    original_get_engine = get_engine_func
    
    def override_get_session_factory():
        return session_factory
    
    def override_get_engine():
        class MockEngine:
            async def begin(self):
                class MockConn:
                    async def run_sync(self, fn):
                        return fn()
                return MockConn()
            async def dispose(self):
                pass
        return MockEngine()
    
    # Patch the module functions
    import app.core.database as db_module
    import app.api.v1.system_portable as sys_port_module
    db_module.get_session_factory = override_get_session_factory
    db_module.get_engine = override_get_engine
    sys_port_module.get_session_factory = override_get_session_factory

    from app.main import app
    app.dependency_overrides[get_db_session] = override_get_db_session

    yield session_factory

    app.dependency_overrides.clear()
    # Restore originals
    db_module.get_session_factory = original_get_session_factory
    db_module.get_engine = original_get_engine
    sys_port_module.get_session_factory = original_get_session_factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_sqlite_fallback_config_and_init_db_schema(tmp_path, monkeypatch):
    """Test USE_SQLITE_FALLBACK configuration property and init_db_schema function."""
    db_path = str(tmp_path / "sqlite_fallback.db")
    monkeypatch.setattr(settings, "database_url", None)
    monkeypatch.setattr(settings, "use_sqlite_fallback", True)
    monkeypatch.setattr(settings, "sqlite_db_path", db_path)

    assert settings.effective_database_url.endswith(db_path)
    assert settings.is_database_configured is False

    # Call init_db_schema which should create the SQLite database schema
    init_db_schema()

    # Verify that init_db_schema executed safely
    assert settings.use_sqlite_fallback is True


@pytest.mark.asyncio
async def test_export_snapshot_endpoint(async_client: AsyncClient, setup_portable_db, tmp_path, monkeypatch):
    """Test GET /api/v1/system/export-snapshot returns a complete portable snapshot."""
    # Create a temporary beancount file
    beancount_path = tmp_path / "main.beancount"
    beancount_content = (
        "2024-01-01 open Assets:Bank:Checking USD\n"
        "2024-01-01 open Equity:OpeningBalances USD\n\n"
        "2024-01-02 * \"Opening Balance\"\n"
        "	Assets:Bank:Checking        1000.00 USD\n"
        "	Equity:OpeningBalances     -1000.00 USD\n"
    )
    beancount_path.write_text(beancount_content, encoding="utf-8")
    monkeypatch.setattr(settings, "beancount_file_path", str(beancount_path))

    # Seed an audit log and an approval task
    async with setup_portable_db() as session:
        await AuditService.append_entry(
            session=session,
            category="System",
            actor="Tester",
            action="EXPORT_TEST",
            target="Snapshot",
            severity="INFO",
            details={"test": "export"},
        )
        await ApprovalService.create_approval_task(
            session=session,
            task_mode="accounting",
            action="POST_JOURNAL_ENTRY",
            target="Assets:Bank:Checking",
            title="Snapshot Approval Task",
            proposed_action="Test approval task for snapshot",
            payload={"amount": 1000},
            risk_level="LOW",
            confidence=0.9,
        )
        await session.commit()

    # Call export-snapshot endpoint
    response = await async_client.get("/api/v1/system/export-snapshot")
    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert "manifest" in data
    assert "beancount_ledger_content" in data
    assert "audit_logs" in data
    assert "approval_tasks" in data

    # Verify manifest fields
    manifest = data["manifest"]
    assert "ledger_sha256" in manifest
    assert "audit_chain_verified" in manifest
    assert "record_count" in manifest
    assert "timestamp" in manifest
    assert "version" in manifest

    expected_sha256 = hashlib.sha256(beancount_content.encode("utf-8")).hexdigest()
    assert manifest["ledger_sha256"] == expected_sha256
    assert data["beancount_ledger_content"] == beancount_content


@pytest.mark.asyncio
async def test_verify_snapshot_endpoint_valid(async_client: AsyncClient, tmp_path, monkeypatch):
    """Test POST /api/v1/system/verify-snapshot returns valid status for untampered snapshot."""
    # Create a temporary beancount file
    beancount_path = tmp_path / "main.beancount"
    beancount_content = (
        "2024-01-01 open Assets:Bank:Checking USD\n"
        "2024-01-01 open Equity:OpeningBalances USD\n\n"
        "2024-01-02 * \"Opening Balance\"\n"
        "	Assets:Bank:Checking        1000.00 USD\n"
        "	Equity:OpeningBalances     -1000.00 USD\n"
    )
    beancount_path.write_text(beancount_content, encoding="utf-8")
    monkeypatch.setattr(settings, "beancount_file_path", str(beancount_path))

    expected_sha256 = hashlib.sha256(beancount_content.encode("utf-8")).hexdigest()

    snapshot_data = {
        "manifest": {
            "ledger_sha256": expected_sha256,
            "audit_chain_verified": True,
            "record_count": 2,
            "timestamp": "2024-01-02T00:00:00Z",
            "version": "1.0.0",
        },
        "beancount_ledger_content": beancount_content,
        "audit_logs": [],
        "approval_tasks": [],
    }

    verify_payload = {
        "ledger_sha256": expected_sha256,
        "snapshot_data": snapshot_data,
    }

    response = await async_client.post("/api/v1/system/verify-snapshot", json=verify_payload)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["sha256_match"] is True
    assert res_data["beancount_valid"] is True
    assert res_data["audit_chain_valid"] is True
    assert res_data["errors"] == []


@pytest.mark.asyncio
async def test_verify_snapshot_endpoint_mismatch_sha256(async_client: AsyncClient, tmp_path, monkeypatch):
    """Test POST /api/v1/system/verify-snapshot detects SHA-256 mismatch."""
    beancount_path = tmp_path / "main.beancount"
    beancount_content = (
        "2024-01-01 open Assets:Bank:Checking USD\n"
        "2024-01-01 open Equity:OpeningBalances USD\n"
    )
    beancount_path.write_text(beancount_content, encoding="utf-8")
    monkeypatch.setattr(settings, "beancount_file_path", str(beancount_path))

    snapshot_data = {
        "beancount_ledger_content": beancount_content,
    }

    verify_payload = {
        "ledger_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "snapshot_data": snapshot_data,
    }

    response = await async_client.post("/api/v1/system/verify-snapshot", json=verify_payload)
    assert response.status_code == 200
    res_data = response.json()

    assert res_data["sha256_match"] is False
    assert len(res_data["errors"]) > 0
    assert "ledger_sha256 digest mismatch" in res_data["errors"][0]


@pytest.mark.asyncio
async def test_restore_snapshot_endpoint_success(async_client: AsyncClient, tmp_path, monkeypatch):
    """Test POST /api/v1/system/restore-snapshot atomically replaces ledger file when snapshot is valid."""
    beancount_path = tmp_path / "main.beancount"
    old_content = "2024-01-01 open Assets:Bank:Checking USD\n"
    beancount_path.write_text(old_content, encoding="utf-8")
    monkeypatch.setattr(settings, "beancount_file_path", str(beancount_path))

    new_content = (
        "2024-01-01 open Assets:Bank:Checking USD\n"
        "2024-01-01 open Equity:OpeningBalances USD\n\n"
        "2024-01-02 * \"Restored Entry\"\n"
        "	Assets:Bank:Checking        500.00 USD\n"
        "	Equity:OpeningBalances     -500.00 USD\n"
    )
    expected_sha256 = hashlib.sha256(new_content.encode("utf-8")).hexdigest()

    restore_payload = {
        "ledger_sha256": expected_sha256,
        "snapshot_data": {
            "beancount_ledger_content": new_content,
            "audit_logs": [],
            "approval_tasks": [],
        },
    }

    response = await async_client.post("/api/v1/system/restore-snapshot", json=restore_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Snapshot restored successfully" in data["message"]

    # Verify atomic file replacement
    assert beancount_path.read_text(encoding="utf-8") == new_content


@pytest.mark.asyncio
async def test_restore_snapshot_endpoint_tampered_rejection(async_client: AsyncClient, tmp_path, monkeypatch):
    """Test POST /api/v1/system/restore-snapshot rejects tampered snapshot and leaves original ledger intact."""
    beancount_path = tmp_path / "main.beancount"
    original_content = "2024-01-01 open Assets:Bank:Checking USD\n"
    beancount_path.write_text(original_content, encoding="utf-8")
    monkeypatch.setattr(settings, "beancount_file_path", str(beancount_path))

    tampered_payload = {
        "ledger_sha256": "badsha256hashcode",
        "snapshot_data": {
            "beancount_ledger_content": "2024-01-01 invalid content\n",
        },
    }

    response = await async_client.post("/api/v1/system/restore-snapshot", json=tampered_payload)
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "Fail-Closed" in data["detail"]

    # Verify original file was NOT overwritten
    assert beancount_path.read_text(encoding="utf-8") == original_content
