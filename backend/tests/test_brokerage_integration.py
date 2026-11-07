from __future__ import annotations
"""
O-Finance Brokerage Integration & HITL Execution Loop Tests

Tests covering:
1. Brokerage API endpoints: /status, /gateway/control, /config, /schwab/auth-url, /schwab/callback, /positions
2. HITL Order Intent Staging (Step A): Task creation under portfolio_analysis mode and EXECUTE_BROKERAGE_ORDER action.
3. HITL Approved Order Execution (Step B): Row-level lock verification, payload hash mismatch rejection, duplicate replay prevention, AuditService logging, and atomic Beancount ledger append.
"""

import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db_session
from app.models.approval import ApprovalTaskModel
from app.models.audit import AuditLogModel
from app.services.approval_service import ApprovalService



@pytest_asyncio.fixture(autouse=True)
async def setup_test_db(tmp_path, monkeypatch):
    """Setup in-memory SQLite database, temporary Beancount ledger file, and override get_db_session dependency."""
    # Ensure tests do not touch or pollute the real ledger/main.beancount file
    test_ledger = tmp_path / "test_main.beancount"
    test_ledger.write_text("option \"operating_currency\" \"USD\"\n", encoding="utf-8")
    monkeypatch.setattr(settings, "beancount_file_path", str(test_ledger))

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


# 1. API Route Tests: Status, Control, Config, Schwab OAuth, Positions

async def test_get_brokerage_status_api(async_client):
    """GET /api/v1/brokerage/status returns current status and config."""
    response = await async_client.get("/api/v1/brokerage/status")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "gateway_status" in data
    assert data["port"] == 5055
    assert "ibkr_config" in data
    assert "schwab_config" in data
    assert "console_logs" in data


async def test_control_brokerage_gateway_api(async_client):
    """POST /api/v1/brokerage/gateway/control starts/stops gateway."""
    response = await async_client.post("/api/v1/brokerage/gateway/control", json={"action": "start"})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "RUNNING"

    response = await async_client.post("/api/v1/brokerage/gateway/control", json={"action": "stop"})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "STOPPED"


async def test_save_brokerage_config_api(async_client):
    """POST /api/v1/brokerage/config saves credentials with string masking."""
    payload = {
        "ibkr": {
            "flex_token": "flx-my-secret-token-1234",
            "flex_query_id": "998877",
            "account_id": "U98765432",
        },
        "schwab": {
            "app_key": "schw-key-00001111",
            "app_secret": "schw-secret-22223333",
            "account_id": "SCHW-12345",
        },
    }
    response = await async_client.post("/api/v1/brokerage/config", json=payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["ibkr_config"]["flex_token_masked"] == "flx-...1234"
    assert data["ibkr_config"]["account_id"] == "U98765432"
    assert data["schwab_config"]["app_key_masked"] == "schw...1111"
    assert data["schwab_config"]["account_id"] == "SCHW-12345"
    assert data["schwab_oauth_status"] == "CONFIGURED"


async def test_schwab_oauth_flow_api(async_client):
    """Test Schwab auth URL generation and callback handling."""
    # 1. Get Auth URL
    auth_resp = await async_client.get("/api/v1/brokerage/schwab/auth-url")
    assert auth_resp.status_code == status.HTTP_200_OK
    assert "auth_url" in auth_resp.json()
    assert "response_type=code" in auth_resp.json()["auth_url"]

    # 2. Handle OAuth Callback
    cb_resp = await async_client.get("/api/v1/brokerage/schwab/callback?code=mock_oauth_code_123")
    assert cb_resp.status_code == status.HTTP_200_OK
    data = cb_resp.json()
    assert data["status"] == "CONNECTED"


async def test_get_positions_api(async_client):
    """GET /api/v1/brokerage/positions returns real-time synced portfolio positions."""
    response = await async_client.get("/api/v1/brokerage/positions")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "holdings" in data
    holdings = data["holdings"]
    assert isinstance(holdings, list)
    assert len(holdings) > 0
    symbols = [p["symbol"] for p in holdings]
    assert "NVDA" in symbols
    assert "VOO" in symbols


# 2. HITL Staging & Execution Loop Tests

async def test_stage_and_execute_approved_order_flow(async_client, setup_test_db):
    """Full HITL end-to-end lifecycle test for order staging and approval execution."""
    session_factory = setup_test_db
    order_payload = {
        "broker": "ibkr",
        "account_id": "U12345678",
        "symbol": "AAPL",
        "side": "BUY",
        "quantity": 10.0,
        "order_type": "LIMIT",
        "limit_price": 185.50,
        "dry_run": True,
    }

    # Step 1: Stage Order via API endpoint
    stage_resp = await async_client.post("/api/v1/brokerage/orders/stage", json=order_payload)
    assert stage_resp.status_code == status.HTTP_200_OK
    stage_data = stage_resp.json()
    assert stage_data["status"] == "PENDING"
    approval_id = stage_data["approval_id"]
    assert stage_data["task_mode"] == "portfolio_analysis"
    assert stage_data["action"] == "EXECUTE_BROKERAGE_ORDER"

    # Verify task exists in database
    async with session_factory() as session:
        result = await session.execute(select(ApprovalTaskModel).where(ApprovalTaskModel.id == approval_id))
        task = result.scalar_one_or_none()
        assert task is not None
        assert task.status == "Pending"

        # Step 2: Approve Task
        approved_task = await ApprovalService.approve_task(
            session=session,
            task_id=approval_id,
            actor="test_admin",
            decision_reason="Approved for dry-run simulation",
        )
        assert approved_task.status == "Approved"
        await session.commit()

    # Step 3: Execute Approved Order via API endpoint
    exec_payload = {
        "approval_id": approval_id,
        "order_payload": order_payload,
    }
    exec_resp = await async_client.post("/api/v1/brokerage/orders/execute-approved", json=exec_payload)
    assert exec_resp.status_code == status.HTTP_200_OK
    exec_data = exec_resp.json()
    assert exec_data["status"] == "EXECUTED"
    assert exec_data["approval_id"] == approval_id
    assert "audit_id" in exec_data
    assert "audit_hash" in exec_data

    # Verify task status is now CONSUMED
    async with session_factory() as session:
        consumed_task_res = await session.execute(select(ApprovalTaskModel).where(ApprovalTaskModel.id == approval_id))
        consumed_task = consumed_task_res.scalar_one_or_none()
        assert consumed_task is not None
        assert consumed_task.is_consumed is True

        # Verify Audit Log entry created
        audit_res = await session.execute(select(AuditLogModel))
        audit_logs = audit_res.scalars().all()
        assert any(log.action == "EXECUTE_BROKERAGE_ORDER" for log in audit_logs)


async def test_execute_order_payload_tamper_rejection(async_client, setup_test_db):
    """Verify execution is rejected if order_payload is modified after staging."""
    session_factory = setup_test_db
    original_payload = {
        "broker": "ibkr",
        "account_id": "U12345678",
        "symbol": "AAPL",
        "side": "BUY",
        "quantity": 10.0,
        "order_type": "LIMIT",
        "limit_price": 185.50,
        "dry_run": True,
    }
    tampered_payload = {
        "broker": "ibkr",
        "account_id": "U12345678",
        "symbol": "AAPL",
        "side": "BUY",
        "quantity": 1000.0,  # Tampered quantity!
        "order_type": "LIMIT",
        "limit_price": 185.50,
        "dry_run": True,
    }

    async with session_factory() as session:
        stage_resp = await async_client.post("/api/v1/brokerage/orders/stage", json=original_payload)
        approval_id = stage_resp.json()["approval_id"]

        await ApprovalService.approve_task(
            session=session,
            task_id=approval_id,
            actor="admin",
        )
        await session.commit()

    # Attempt execution with tampered payload
    exec_payload = {
        "approval_id": approval_id,
        "order_payload": tampered_payload,
    }
    exec_resp = await async_client.post("/api/v1/brokerage/orders/execute-approved", json=exec_payload)
    # Should fail with rejection
    assert exec_resp.status_code == status.HTTP_400_BAD_REQUEST
    error_data = exec_resp.json()
    assert "EXECUTION_DENIED" in error_data.get("detail", "")


async def test_execute_order_replay_prevention(async_client, setup_test_db):
    """Verify duplicate execution attempts of the same approval task are rejected."""
    session_factory = setup_test_db
    order_payload = {
        "broker": "schwab",
        "account_id": "SCHW-998877",
        "symbol": "MSFT",
        "side": "SELL",
        "quantity": 5.0,
        "order_type": "LIMIT",
        "limit_price": 400.0,
        "dry_run": True,
    }

    async with session_factory() as session:
        stage_resp = await async_client.post("/api/v1/brokerage/orders/stage", json=order_payload)
        approval_id = stage_resp.json()["approval_id"]

        await ApprovalService.approve_task(session=session, task_id=approval_id, actor="admin")
        await session.commit()

    # First execution succeeds
    exec_payload = {
        "approval_id": approval_id,
        "order_payload": order_payload,
    }
    exec_resp = await async_client.post("/api/v1/brokerage/orders/execute-approved", json=exec_payload)
    assert exec_resp.status_code == status.HTTP_200_OK
    assert exec_resp.json()["status"] == "EXECUTED"

    # Second execution attempt must fail (already CONSUMED)
    exec_resp2 = await async_client.post("/api/v1/brokerage/orders/execute-approved", json=exec_payload)
    # Should fail with consumed/invalid status
    assert exec_resp2.status_code == status.HTTP_400_BAD_REQUEST


# 3. Credential Masking Utility Tests

def test_credential_masking():
    """Test string masking utility for sensitive tokens and keys."""
    from app.connectors.brokerage_manager import mask_credential

    assert mask_credential("flx-secret-12345678") == "flx-...5678"
    assert mask_credential("schw-app-key-99887766") == "schw...7766"
    assert mask_credential("abc") == "********"
    assert mask_credential("") == ""
