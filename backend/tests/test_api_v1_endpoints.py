from __future__ import annotations
"""
O-Finance API v1 Endpoint Integration Tests

Tests for the newly exposed FastAPI routes under /api/v1:
- Audit endpoints: GET /api/v1/audit/logs, GET /api/v1/audit/verify
- Approvals endpoints: GET /api/v1/approvals, POST /api/v1/approvals/{task_id}/approve, POST /api/v1/approvals/{task_id}/reject
- Ledger endpoints: GET /api/v1/ledger/status, POST /api/v1/ledger/post-approved
"""

import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db_session
from app.models.approval import ApprovalTaskModel
from app.models.audit import AuditLogModel
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService

pytestmark = pytest.mark.asyncio


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


async def test_get_audit_logs_empty(async_client):
    """GET /api/v1/audit/logs returns empty list when no audit records exist."""
    response = await async_client.get("/api/v1/audit/logs")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


async def test_get_audit_verify_empty(async_client):
    """GET /api/v1/audit/verify returns chain_verified=True and total_records=0 when no records exist."""
    response = await async_client.get("/api/v1/audit/verify")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["chain_verified"] is True
    assert data["total_records"] == 0
    assert data["verification_message"] is None


async def test_get_approvals_empty(async_client):
    """GET /api/v1/approvals returns empty list when no approval tasks exist."""
    response = await async_client.get("/api/v1/approvals")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


async def test_post_approval_approve_and_reject_flow(async_client, setup_test_db):
    """Test approval task creation, approval endpoint, and rejection endpoint."""
    session_factory = setup_test_db
    async with session_factory() as session:
        # Create pending approval task
        task1 = await ApprovalService.create_approval_task(
            session=session,
            task_mode="accounting",
            action="post_journal",
            target="Assets:Bank",
            title="Post Bank Transaction",
            proposed_action="Post 100 CNY to Assets:Bank",
            payload={"postings": [{"account": "Assets:Bank", "amount": "100.00", "currency": "CNY"}]},
        )
        task2 = await ApprovalService.create_approval_task(
            session=session,
            task_mode="risk_analysis",
            action="override_limit",
            target="Account:123",
            title="Override Limit",
            proposed_action="Override risk limit",
            payload={"limit": 5000},
        )
        await session.commit()
        task1_id = task1.id
        task2_id = task2.id

    # Test GET /api/v1/approvals
    res_list = await async_client.get("/api/v1/approvals")
    assert res_list.status_code == status.HTTP_200_OK
    assert len(res_list.json()) == 2

    # Test POST /api/v1/approvals/{task_id}/approve
    res_appr = await async_client.post(
        f"/api/v1/approvals/{task1_id}/approve",
        json={"actor": "Chief Risk Officer", "decision_reason": "Approved after review"},
    )
    assert res_appr.status_code == status.HTTP_200_OK
    data_appr = res_appr.json()
    assert data_appr["status"] == "Approved"
    assert data_appr["actor"] == "Chief Risk Officer"

    # Test POST /api/v1/approvals/{task_id}/reject
    res_rej = await async_client.post(
        f"/api/v1/approvals/{task2_id}/reject",
        json={"actor": "Chief Risk Officer", "decision_reason": "Risk threshold exceeded"},
    )
    assert res_rej.status_code == status.HTTP_200_OK
    data_rej = res_rej.json()
    assert data_rej["status"] == "Rejected"

    # Test audit log entry appended for decisions
    res_audit = await async_client.get("/api/v1/audit/logs")
    assert res_audit.status_code == status.HTTP_200_OK
    logs = res_audit.json()
    assert len(logs) == 2
    categories = [l["category"] for l in logs]
    assert all(c == "Approval Decision" for c in categories)


async def test_get_ledger_status(async_client):
    """GET /api/v1/ledger/status returns LedgerStatusDto with bean_check and fava_status."""
    response = await async_client.get("/api/v1/ledger/status")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "beancount_file_path" in data
    assert "bean_check" in data
    assert "fava_status" in data


async def test_post_ledger_post_approved_execution(async_client, setup_test_db, tmp_path):
    """Test POST /api/v1/ledger/post-approved with valid approved task."""
    ledger_file = tmp_path / "test.beancount"
    ledger_file.write_text("2026-01-01 open Assets:Bank\n2026-01-01 open Expenses:Food\n", encoding="utf-8")

    session_factory = setup_test_db
    payload = {
        "postings": [
            {"account": "Assets:Bank", "amount": "-100.00", "currency": "CNY"},
            {"account": "Expenses:Food", "amount": "100.00", "currency": "CNY"},
        ],
        "payee": "Supermarket",
        "narration": "Groceries",
    }

    async with session_factory() as session:
        task = await ApprovalService.create_approval_task(
            session=session,
            task_mode="accounting",
            action="post_journal_entry",
            target=str(ledger_file),
            title="Post Groceries",
            proposed_action="Post groceries transaction",
            payload=payload,
        )
        await ApprovalService.approve_task(session=session, task_id=task.id)
        await session.commit()
        task_id = task.id

    request_payload = {
        "approval_task_id": task_id,
        "expected_task_mode": "accounting",
        "expected_action": "post_journal_entry",
        "expected_target": str(ledger_file),
        "expected_payload": payload,
        "date_str": "2026-11-05",
        "flag": "*",
        "beancount_file_path": str(ledger_file),
    }

    response = await async_client.post("/api/v1/ledger/post-approved", json=request_payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert "audit_id" in data
    assert "verification_hash" in data
    assert "formatted_entry" in data

    content = ledger_file.read_text(encoding="utf-8")
    assert "Supermarket" in content
    assert "Groceries" in content
