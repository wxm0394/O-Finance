from __future__ import annotations
"""
PostgreSQL Integration Tests for O-Finance Security & Concurrency Verification.
Only executed when OFINANCE_TEST_DATABASE_URL environment variable is set.
"""

import asyncio
import multiprocessing
import os
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.database import Base
from app.models.approval import ApprovalTaskModel
from app.models.audit import AuditLogModel
from app.services.approval_service import ApprovalService, compute_payload_hash
from app.services.audit_service import AuditService

TEST_DB_URL = os.getenv("OFINANCE_TEST_DATABASE_URL")
IS_CI = os.getenv("CI", "").lower() in ("true", "1")

if IS_CI and not TEST_DB_URL:
    pytest.exit("CRITICAL CI ERROR: CI environment requires OFINANCE_TEST_DATABASE_URL to be configured for PostgreSQL integration tests!", returncode=1)

pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="PostgreSQL integration tests require OFINANCE_TEST_DATABASE_URL to be configured."
)


@pytest_asyncio.fixture(scope="module")
async def pg_engine():
    """Create async engine for PostgreSQL integration testing."""
    url = TEST_DB_URL
    if url and url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    engine = create_async_engine(url, echo=False, pool_size=10, max_overflow=20)

    # Verify test database safety check
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT current_database()"))
        db_name = res.scalar()
        if "test" not in db_name.lower():
            raise RuntimeError(
                f"SAFETY VIOLATION: Refusing to run destructive test setup on non-test database '{db_name}'!"
            )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def pg_session(pg_engine):
    """Provide clean AsyncSession and truncate test tables."""
    factory = async_sessionmaker(pg_engine, autoflush=False, expire_on_commit=False)
    async with factory() as session:
        # Clean test tables
        await session.execute(text("TRUNCATE TABLE approval_tasks, audit_logs CASCADE"))
        await session.commit()
        yield session


@pytest.mark.asyncio
async def test_postgres_approval_row_lock_concurrency(pg_engine, pg_session):
    """
    TEST 1: Real PostgreSQL Row Lock (SELECT FOR UPDATE) Concurrency.
    Creates an approved task, then launches 2 independent DB sessions concurrently
    competing to consume the approval.
    MUST result in exactly ONE success and ONE ALREADY_CONSUMED.
    """
    factory = async_sessionmaker(pg_engine, autoflush=False, expire_on_commit=False)
    payload = {"amount": 50000.0, "recipient": "SUPPLIER_99"}
    payload_h = compute_payload_hash(payload)

    # 1. Create task
    task = ApprovalTaskModel(
        id="appr-pg-race-001",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_entry_999",
        title="Approve Large Disbursement",
        proposed_action="Disburse 50,000 CNY",
        risk_level="High",
        confidence=0.90,
        status="Approved",
        actor="Finance Officer",
        payload_json='{"amount": 50000.0, "recipient": "SUPPLIER_99"}',
        payload_hash=payload_h,
        is_consumed=False,
    )
    pg_session.add(task)
    await pg_session.commit()

    # 2. Worker logic using independent sessions
    async def worker():
        async with factory() as session:
            try:
                res = await ApprovalService.verify_and_consume_approval(
                    session=session,
                    approval_task_id="appr-pg-race-001",
                    expected_task_mode="accounting",
                    expected_action="draft_journal_entry",
                    expected_target="journal_entry_999",
                    expected_payload=payload,
                    consume=True,
                )
                await session.commit()
                return res
            except Exception as e:
                await session.rollback()
                raise e

    # 3. Execute concurrent workers
    res1, res2 = await asyncio.gather(worker(), worker())

    results = [res1, res2]
    successes = [r for r in results if r.is_valid and r.status == "APPROVED"]
    consumed = [r for r in results if not r.is_valid and r.status == "ALREADY_CONSUMED"]

    assert len(successes) == 1, "Exactly one concurrent connection must succeed"
    assert len(consumed) == 1, "The competing connection must be rejected with ALREADY_CONSUMED"

    # Verify DB final state
    async with factory() as session:
        res = await session.execute(text("SELECT is_consumed, consumed_at FROM approval_tasks WHERE id='appr-pg-race-001'"))
        row = res.one()
        assert row.is_consumed is True
        assert row.consumed_at is not None


@pytest.mark.asyncio
async def test_postgres_audit_multi_connection_concurrency(pg_engine, pg_session):
    """
    TEST 2: Real PostgreSQL Multi-Connection Audit Logging (Advisory Lock).
    5 independent database connections concurrently append audit log entries starting from EMPTY.
    Verifies:
    - 5 records appended.
    - Exactly ONE Genesis entry linking to 64 zeroes.
    - Perfect linear chain with no forks.
    """
    factory = async_sessionmaker(pg_engine, autoflush=False, expire_on_commit=False)

    async def worker(idx: int):
        async with factory() as session:
            try:
                entry = await AuditService.append_entry(
                    session=session,
                    category="Postgres Test",
                    actor=f"Worker-{idx}",
                    action=f"action_{idx}",
                    target=f"target_{idx}",
                )
                await session.commit()
                return entry
            except Exception:
                await session.rollback()
                raise

    workers = [worker(i) for i in range(5)]
    appended_entries = await asyncio.gather(*workers)

    assert len(appended_entries) == 5

    async with factory() as session:
        is_valid, err = await AuditService.verify_database_chain(session)
        assert is_valid is True, f"PostgreSQL audit chain failed verification: {err}"


def _multiprocess_audit_worker(db_url: str, worker_id: int, return_dict: dict):
    """Standalone worker function executed in separate OS process."""
    async def _async_work():
        url = db_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)

        engine = create_async_engine(url, echo=False)
        factory = async_sessionmaker(engine, autoflush=False, expire_on_commit=False)

        async with factory() as session:
            try:
                entry = await AuditService.append_entry(
                    session=session,
                    category="Multi-Process Test",
                    actor=f"Process-{worker_id}",
                    action=f"process_action_{worker_id}",
                    target=f"process_target_{worker_id}",
                )
                await session.commit()
                return_dict[worker_id] = entry.id
            except Exception as e:
                await session.rollback()
                return_dict[worker_id] = f"ERROR: {str(e)}"
            finally:
                await engine.dispose()

    asyncio.run(_async_work())


@pytest.mark.asyncio
async def test_postgres_audit_multi_process_concurrency(pg_engine, pg_session):
    """
    TEST 3: Real PostgreSQL Multi-Process Concurrency Test.
    Launches 2 independent OS processes, each initializing its own Python asyncio loop,
    SQLAlchemy Engine, and AsyncSession to append audit records concurrently.
    Proves pg_advisory_xact_lock works across OS process boundaries using 'spawn' context.
    """
    ctx = multiprocessing.get_context("spawn")
    manager = ctx.Manager()
    return_dict = manager.dict()

    p1 = ctx.Process(target=_multiprocess_audit_worker, args=(TEST_DB_URL, 1, return_dict))
    p2 = ctx.Process(target=_multiprocess_audit_worker, args=(TEST_DB_URL, 2, return_dict))

    p1.start()
    p2.start()

    p1.join(timeout=15)
    if p1.is_alive():
        p1.terminate()
        p1.join()

    p2.join(timeout=15)
    if p2.is_alive():
        p2.terminate()
        p2.join()

    assert p1.exitcode == 0, f"Process 1 exited with non-zero exit code: {p1.exitcode}"
    assert p2.exitcode == 0, f"Process 2 exited with non-zero exit code: {p2.exitcode}"

    assert len(return_dict) == 2
    for k, v in return_dict.items():
        assert not str(v).startswith("ERROR"), f"Process {k} failed: {v}"

    # Verify linear chain and entry count in database
    factory = async_sessionmaker(pg_engine, autoflush=False, expire_on_commit=False)
    async with factory() as session:
        res = await session.execute(text("SELECT COUNT(*) FROM audit_logs"))
        count = res.scalar()
        assert count == 2, f"Expected 2 audit log entries created across processes, found {count}"

        is_valid, err = await AuditService.verify_database_chain(session)
        assert is_valid is True, f"Multi-process PostgreSQL chain verification failed: {err}"


@pytest.mark.asyncio
async def test_postgres_advisory_lock_failure_fail_closed(pg_engine, pg_session, monkeypatch):
    """
    TEST 4: Advisory Lock Failure Fail-Closed Guarantee.
    Simulates a failure during pg_advisory_xact_lock execution.
    Verifies that AuditService aborts immediately, raises RuntimeError,
    and leaks ZERO audit records into the database.
    """
    async def mock_execute_raise(*args, **kwargs):
        raise RuntimeError("Simulated Database Advisory Lock Failure")

    monkeypatch.setattr(pg_session, "execute", mock_execute_raise)

    with pytest.raises(RuntimeError) as exc_info:
        await AuditService.append_entry(
            session=pg_session,
            category="Fail Closed Test",
            actor="Tester",
            action="should_fail",
            target="target",
        )

    assert "ADVISORY_LOCK_FAILURE" in str(exc_info.value) or "Simulated Database Advisory Lock Failure" in str(exc_info.value)

    # Query DB using clean AsyncSession (independent of mocked pg_session) to verify 0 records leaked
    factory = async_sessionmaker(pg_engine, autoflush=False, expire_on_commit=False)
    async with factory() as clean_session:
        res = await clean_session.execute(text("SELECT COUNT(*) FROM audit_logs"))
        count = res.scalar()
        assert count == 0, f"Security Violation: Failed advisory lock leaked {count} records into DB!"
