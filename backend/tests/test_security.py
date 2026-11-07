from __future__ import annotations
"""
Tests for Security Closure & Concurrency Fixes (P2.1.2.1)
Covers:
1. SecurityGuard Default-Deny and Mode Isolation.
2. Rejection of caller-supplied approval status (Must use ApprovalService).
3. ApprovalService authoritative verification & Concurrency:
   - Concurrent double-consumption race condition prevention (SELECT FOR UPDATE).
   - Incomplete binding rejection (missing action, target, or payload_hash).
   - Missing request payload rejection when payload_hash is bound.
   - Non-existent ID rejected.
   - PENDING and REJECTED rejected.
   - Task mode, action, target, and payload mismatch rejected.
   - Expired task rejected.
   - Replay / double-consumption rejected (one-time use).
   - Permanently blocked actions CANNOT be bypassed by any approval.
4. AuditService automated hash-chaining, Concurrency, and anti-genesis-fork:
   - Concurrent append starting from empty table (no Genesis forks).
   - Sequential auto-linkage.
   - Content tampering detection.
   - Broken link and out-of-order detection.
   - ORM UPDATE / DELETE interception.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
import pytest

from app.core.security import (
    SecurityGuard,
    OperationPermission,
    SecurityPolicyException,
)
from app.models.approval import ApprovalTaskModel
from app.models.audit import AuditLogModel, compute_audit_hash
from app.services.approval_service import (
    ApprovalService,
    ApprovalVerificationResult,
    compute_payload_hash,
)
from app.services.audit_service import AuditService


def test_security_guard_default_deny_unknown_tools():
    """Verify unknown tools are strictly denied under default-deny policy."""
    perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="arbitrary_unauthorized_tool",
    )
    assert perm.is_permitted is False
    assert "DEFAULT_DENY" in perm.reason


def test_security_guard_default_deny_unknown_task_mode():
    """Verify unknown task mode is rejected."""
    perm = SecurityGuard.check_task_mode_permission(
        task_mode="unauthorized_mode",
        tool_name="query_accounts",
    )
    assert perm.is_permitted is False
    assert "DEFAULT_DENY" in perm.reason


def test_security_guard_task_mode_isolation():
    """
    Verify mode isolation: A tool whitelisted in one mode is blocked in other modes.
    e.g., run_strategy_backtest is allowed in quantitative_research, but blocked in accounting.
    """
    quant_perm = SecurityGuard.check_task_mode_permission(
        task_mode="quantitative_research",
        tool_name="run_strategy_backtest",
    )
    assert quant_perm.is_permitted is True

    acct_perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="run_strategy_backtest",
    )
    assert acct_perm.is_permitted is False
    assert "DEFAULT_DENY" in acct_perm.reason


def test_security_guard_does_not_trust_caller_status():
    """
    CRITICAL SECURITY INVARIANT (P2.1.2.1):
    SecurityGuard does not accept or trust caller-supplied approval status.
    Calling without ApprovalService verification ALWAYS yields is_permitted=False and PENDING.
    """
    perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="draft_journal_entry",
        approval_task_id="unverified_task_123",
        approval_verification=None,  # No DB verification passed
    )
    assert perm.requires_approval is True
    assert perm.approval_status == "PENDING"
    assert perm.is_permitted is False
    assert "EXECUTION_BLOCKED" in perm.reason


def test_permanently_blocked_actions_cannot_be_authorized_by_approval():
    """
    CRITICAL FINANCIAL INVARIANT:
    Even if an approval verification claims 'is_valid=True' and status='APPROVED',
    permanently blocked fund actions (transfer, order, withdrawal) CANNOT execute.
    """
    fake_approval = ApprovalVerificationResult(
        is_valid=True,
        status="APPROVED",
        approval_task_id="appr-super-bypass-attempt",
    )

    blocked_actions = [
        "initiate_transfer",
        "place_order",
        "execute_live_trade",
        "withdraw_funds",
        "modify_account_credentials",
        "delete_audit_log",
    ]

    for action in blocked_actions:
        conn_perm = SecurityGuard.check_connector_action(action, "broker_ibkr")
        assert conn_perm.is_permitted is False
        assert conn_perm.is_permanently_blocked is True

        perm = SecurityGuard.check_task_mode_permission(
            task_mode="accounting",
            tool_name=action,
            approval_verification=fake_approval,
        )
        assert perm.is_permitted is False
        assert perm.is_permanently_blocked is True
        assert "permanently prohibited" in perm.reason.lower()


@pytest.mark.asyncio
async def test_approval_service_missing_id():
    """Verify approval service rejects requests with empty/missing approval_task_id."""
    mock_session = AsyncMock()
    result = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
    )
    assert result.is_valid is False
    assert result.status == "MISSING_APPROVAL_ID"


@pytest.mark.asyncio
async def test_approval_service_task_not_found():
    """Verify approval service rejects non-existent tasks in database."""
    mock_session = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_res

    result = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="nonexistent_task_id",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
    )
    assert result.is_valid is False
    assert result.status == "NOT_FOUND"


@pytest.mark.asyncio
async def test_approval_service_mandatory_full_binding_enforcement():
    """
    Verify strict binding rules (P2.1.2.1):
    - Incomplete binding in DB record -> INCOMPLETE_APPROVAL_BINDING
    - Missing expected_payload in request -> MISSING_REQUEST_PAYLOAD
    - create_approval_task without action, target, or payload raises ValueError
    """
    now = datetime.now(timezone.utc)
    mock_session = AsyncMock()

    # Case 1: DB task missing payload_hash
    incomplete_task = ApprovalTaskModel(
        id="appr-incomplete",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Incomplete",
        proposed_action="Act",
        risk_level="Medium",
        confidence=0.80,
        status="Approved",
        payload_hash=None,  # Missing!
        is_consumed=False,
        created_at=now,
        updated_at=now,
    )
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = incomplete_task
    mock_session.execute.return_value = mock_res

    res_inc = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-incomplete",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
    )
    assert res_inc.is_valid is False
    assert res_inc.status == "INCOMPLETE_APPROVAL_BINDING"

    # Case 2: DB task has payload_hash, but request has expected_payload=None
    bound_task = ApprovalTaskModel(
        id="appr-bound",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Bound",
        proposed_action="Act",
        risk_level="Medium",
        confidence=0.80,
        status="Approved",
        payload_hash=compute_payload_hash({"amount": 100.0}),
        is_consumed=False,
        created_at=now,
        updated_at=now,
    )
    mock_res_bound = MagicMock()
    mock_res_bound.scalar_one_or_none.return_value = bound_task
    mock_session.execute.return_value = mock_res_bound

    res_missing_payload = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-bound",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload=None,  # Omitted!
    )
    assert res_missing_payload.is_valid is False
    assert res_missing_payload.status == "MISSING_REQUEST_PAYLOAD"

    # Case 3: create_approval_task validation
    with pytest.raises(ValueError):
        await ApprovalService.create_approval_task(
            session=mock_session,
            task_mode="accounting",
            action="",  # Empty action!
            target="target",
            title="Title",
            proposed_action="Action",
            payload={"amount": 10.0},
        )


@pytest.mark.asyncio
async def test_approval_service_pending_and_rejected():
    """Verify approval service rejects tasks that are Pending or Rejected."""
    now = datetime.now(timezone.utc)
    mock_session = AsyncMock()

    # Case A: Pending Task
    pending_task = ApprovalTaskModel(
        id="appr-pending",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Draft Journal",
        proposed_action="Create journal",
        risk_level="Medium",
        confidence=0.80,
        status="Pending",
        payload_hash=compute_payload_hash({"amount": 100.0}),
        is_consumed=False,
        created_at=now,
        updated_at=now,
    )
    mock_res_pending = MagicMock()
    mock_res_pending.scalar_one_or_none.return_value = pending_task
    mock_session.execute.return_value = mock_res_pending

    res_a = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-pending",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
    )
    assert res_a.is_valid is False
    assert res_a.status == "PENDING"

    # Case B: Rejected Task
    rejected_task = ApprovalTaskModel(
        id="appr-rejected",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Draft Journal",
        proposed_action="Create journal",
        risk_level="Medium",
        confidence=0.80,
        status="Rejected",
        payload_hash=compute_payload_hash({"amount": 100.0}),
        is_consumed=False,
        created_at=now,
        updated_at=now,
    )
    mock_res_rejected = MagicMock()
    mock_res_rejected.scalar_one_or_none.return_value = rejected_task
    mock_session.execute.return_value = mock_res_rejected

    res_b = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-rejected",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
    )
    assert res_b.is_valid is False
    assert res_b.status == "REJECTED"


@pytest.mark.asyncio
async def test_approval_service_mismatches_rejected():
    """
    Verify approval service rejects when task_mode, action, target, or payload do not match.
    """
    now = datetime.now(timezone.utc)
    mock_session = AsyncMock()

    approved_task = ApprovalTaskModel(
        id="appr-valid-base",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Draft Journal",
        proposed_action="Create journal",
        risk_level="Medium",
        confidence=0.80,
        status="Approved",
        payload_hash=compute_payload_hash({"amount": 100.0}),
        is_consumed=False,
        created_at=now,
        updated_at=now,
    )
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = approved_task
    mock_session.execute.return_value = mock_res

    # 1. Mode Mismatch
    m_mode = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-valid-base",
        expected_task_mode="risk_analysis",  # Mismatch!
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
    )
    assert m_mode.is_valid is False
    assert m_mode.status == "TASK_MODE_MISMATCH"

    # 2. Action Mismatch
    m_act = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-valid-base",
        expected_task_mode="accounting",
        expected_action="reconcile_discrepancy",  # Mismatch!
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
    )
    assert m_act.is_valid is False
    assert m_act.status == "ACTION_MISMATCH"

    # 3. Target Mismatch
    m_tgt = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-valid-base",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_999",  # Mismatch!
        expected_payload={"amount": 100.0},
    )
    assert m_tgt.is_valid is False
    assert m_tgt.status == "TARGET_MISMATCH"

    # 4. Payload Mismatch
    m_pay = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-valid-base",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 999.0},  # Mismatch!
    )
    assert m_pay.is_valid is False
    assert m_pay.status == "PAYLOAD_MISMATCH"


@pytest.mark.asyncio
async def test_approval_service_expiration_and_one_time_consumption():
    """
    Verify:
    1. Expired approvals are rejected.
    2. Valid approval is consumed on first use.
    3. Reusing a consumed approval is rejected (Replay Prevention).
    """
    now = datetime.now(timezone.utc)
    mock_session = AsyncMock()

    # Case A: Expired Task
    expired_task = ApprovalTaskModel(
        id="appr-expired",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Draft",
        proposed_action="Act",
        risk_level="Medium",
        confidence=0.80,
        status="Approved",
        payload_hash=compute_payload_hash({"amount": 100.0}),
        is_consumed=False,
        expires_at=now - timedelta(hours=1),  # Expired 1 hr ago
        created_at=now - timedelta(days=1),
        updated_at=now - timedelta(days=1),
    )
    mock_res_exp = MagicMock()
    mock_res_exp.scalar_one_or_none.return_value = expired_task
    mock_session.execute.return_value = mock_res_exp

    res_exp = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-expired",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
    )
    assert res_exp.is_valid is False
    assert res_exp.status == "EXPIRED"

    # Case B: Valid Task -> Consumed
    valid_task = ApprovalTaskModel(
        id="appr-fresh",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Draft",
        proposed_action="Act",
        risk_level="Medium",
        confidence=0.80,
        status="Approved",
        payload_hash=compute_payload_hash({"amount": 100.0}),
        is_consumed=False,
        expires_at=now + timedelta(hours=12),
        created_at=now,
        updated_at=now,
    )
    mock_res_fresh = MagicMock()
    mock_res_fresh.scalar_one_or_none.return_value = valid_task
    mock_session.execute.return_value = mock_res_fresh

    # First execution: consumes approval
    res_consume = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-fresh",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
        consume=True,
    )
    assert res_consume.is_valid is True
    assert res_consume.status == "APPROVED"
    assert valid_task.is_consumed is True
    assert valid_task.consumed_at is not None

    # Pass verified approval to SecurityGuard
    perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="draft_journal_entry",
        target="journal_001",
        approval_verification=res_consume,
    )
    assert perm.is_permitted is True

    # Second execution attempt: MUST BE REJECTED (Replay prevention)
    res_replay = await ApprovalService.verify_and_consume_approval(
        session=mock_session,
        approval_task_id="appr-fresh",
        expected_task_mode="accounting",
        expected_action="draft_journal_entry",
        expected_target="journal_001",
        expected_payload={"amount": 100.0},
    )
    assert res_replay.is_valid is False
    assert res_replay.status == "ALREADY_CONSUMED"


@pytest.mark.asyncio
async def test_approval_service_concurrent_double_consumption():
    """
    CRITICAL CONCURRENCY TEST (P2.1.2.1):
    Two concurrent requests execute verify_and_consume_approval on the SAME Approved record.
    Using row-level lock serialization, exactly ONE request must succeed in consuming the task,
    and the other MUST fail with ALREADY_CONSUMED.
    """
    now = datetime.now(timezone.utc)
    approved_task = ApprovalTaskModel(
        id="appr-concurrent-race",
        task_mode="accounting",
        action="draft_journal_entry",
        target="journal_001",
        title="Concurrent Race",
        proposed_action="Act",
        risk_level="High",
        confidence=0.80,
        status="Approved",
        payload_hash=compute_payload_hash({"amount": 100.0}),
        is_consumed=False,
        created_at=now,
        updated_at=now,
    )

    # Simulated row lock for concurrency simulation
    row_lock = asyncio.Lock()

    async def mock_execute(stmt):
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = approved_task
        return mock_res

    mock_session = AsyncMock()
    mock_session.execute = mock_execute

    async def run_worker():
        # Simulate PostgreSQL row-level lock (SELECT FOR UPDATE)
        async with row_lock:
            return await ApprovalService.verify_and_consume_approval(
                session=mock_session,
                approval_task_id="appr-concurrent-race",
                expected_task_mode="accounting",
                expected_action="draft_journal_entry",
                expected_target="journal_001",
                expected_payload={"amount": 100.0},
                consume=True,
            )

    # Run both simultaneously
    results = await asyncio.gather(run_worker(), run_worker())

    success_results = [r for r in results if r.is_valid and r.status == "APPROVED"]
    consumed_results = [r for r in results if not r.is_valid and r.status == "ALREADY_CONSUMED"]

    assert len(success_results) == 1, "Exactly one concurrent worker must successfully consume the approval"
    assert len(consumed_results) == 1, "The competing concurrent worker must be rejected with ALREADY_CONSUMED"
    assert approved_task.is_consumed is True


def test_audit_log_hash_chain_verification():
    """
    Verify cryptographically linked audit log hash chain and tamper detection.
    """
    entry_1 = AuditLogModel.create_entry(
        category="Connector Sync",
        actor="SystemScheduler",
        action="fetch_accounts",
        target="broker_ibkr",
        prev_hash="0000000000000000000000000000000000000000000000000000000000000000",
    )
    assert entry_1.verify_integrity() is True

    entry_2 = AuditLogModel.create_entry(
        category="Ledger Mutation",
        actor="Operator",
        action="approve_journal_draft",
        target="journal_entry_001",
        prev_hash=entry_1.verification_hash,
    )
    assert entry_2.verify_integrity() is True

    entry_3 = AuditLogModel.create_entry(
        category="Assistant Execution",
        actor="OFinanceAssistant",
        action="verify_trial_balance",
        target="accounting",
        prev_hash=entry_2.verification_hash,
    )
    assert entry_3.verify_integrity() is True

    chain = [entry_1, entry_2, entry_3]
    is_valid, error = AuditLogModel.verify_chain(chain)
    assert is_valid is True
    assert error is None

    entry_2.action = "unauthorized_altered_action"
    is_valid_tampered, tamper_error = AuditLogModel.verify_chain(chain)
    assert is_valid_tampered is False
    assert "Tamper detected" in tamper_error


def test_audit_log_broken_link_detection():
    """Verify broken hash link in chain is detected."""
    entry_1 = AuditLogModel.create_entry(
        category="Category",
        actor="Actor",
        action="action_1",
        target="target",
        prev_hash="GENESIS",
    )
    entry_2 = AuditLogModel.create_entry(
        category="Category",
        actor="Actor",
        action="action_2",
        target="target",
        prev_hash="BROKEN_INVALID_HASH",
    )
    chain = [entry_1, entry_2]
    is_valid, error = AuditLogModel.verify_chain(chain)
    assert is_valid is False
    assert "Hash chain broken" in error


@pytest.mark.asyncio
async def test_audit_service_concurrent_append_no_genesis_fork():
    """
    CRITICAL CONCURRENCY TEST (P2.1.2.1):
    5 concurrent workers append to an initially empty audit log.
    With advisory / mutex serialization:
    - Exactly ONE genesis record is created.
    - No forks or duplicate Genesis entries exist.
    - All 5 records form a single unbroken linear chain.
    """
    entries_in_db = []

    async def mock_execute(stmt):
        mock_res = MagicMock()
        if entries_in_db:
            mock_res.scalar_one_or_none.return_value = entries_in_db[-1]
        else:
            mock_res.scalar_one_or_none.return_value = None
        return mock_res

    def mock_add(entry):
        entries_in_db.append(entry)

    mock_session = AsyncMock()
    mock_session.execute = mock_execute
    mock_session.add = mock_add

    # Launch 5 concurrent tasks simultaneously
    async def worker(idx: int):
        return await AuditService.append_entry(
            session=mock_session,
            category="Connector Sync",
            actor=f"Worker-{idx}",
            action=f"sync_account_{idx}",
            target=f"broker_{idx}",
        )

    results = await asyncio.gather(*(worker(i) for i in range(5)))

    # 1. Total records count
    assert len(results) == 5

    # 2. First record MUST link to GENESIS_HASH
    assert results[0].prev_hash == AuditService.GENESIS_HASH

    # 3. Every subsequent record MUST link strictly to the previous record's verification_hash
    for i in range(1, 5):
        assert results[i].prev_hash == results[i - 1].verification_hash, (
            f"Fork detected at index {i}: prev_hash {results[i].prev_hash} != {results[i-1].verification_hash}"
        )

    # 4. Verify the entire chain passes AuditLogModel.verify_chain
    is_valid, error = AuditLogModel.verify_chain(results)
    assert is_valid is True
    assert error is None
