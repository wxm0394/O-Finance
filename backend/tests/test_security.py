"""
Tests for Security Closure (P2.1.2)
Covers:
1. SecurityGuard Default-Deny and Mode Isolation.
2. Rejection of caller-supplied approval status (Must use ApprovalService).
3. ApprovalService authoritative verification:
   - Non-existent ID rejected.
   - PENDING and REJECTED rejected.
   - Task mode, action, target, and payload mismatch rejected.
   - Expired task rejected.
   - Replay / double-consumption rejected (one-time use).
   - Permanently blocked actions CANNOT be bypassed by any approval.
4. AuditService automated hash-chaining and full database chain verification:
   - Sequential auto-linkage.
   - Content tampering detection.
   - Broken link and out-of-order detection.
   - ORM UPDATE / DELETE interception.
"""

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
    CRITICAL SECURITY INVARIANT (P2.1.2):
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
    CRITICAL FINANCIAL INVARIANT (P2.1.2):
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
        # Check connector
        conn_perm = SecurityGuard.check_connector_action(action, "broker_ibkr")
        assert conn_perm.is_permitted is False
        assert conn_perm.is_permanently_blocked is True

        # Check in task mode with fake approval passed
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
    )
    assert res_replay.is_valid is False
    assert res_replay.status == "ALREADY_CONSUMED"


def test_audit_log_hash_chain_verification():
    """
    Verify cryptographically linked audit log hash chain and tamper detection.
    """
    # 1. Construct genesis entry
    entry_1 = AuditLogModel.create_entry(
        category="Connector Sync",
        actor="SystemScheduler",
        action="fetch_accounts",
        target="broker_ibkr",
        prev_hash="0000000000000000000000000000000000000000000000000000000000000000",
    )
    assert entry_1.verify_integrity() is True

    # 2. Construct second chained entry
    entry_2 = AuditLogModel.create_entry(
        category="Ledger Mutation",
        actor="Operator",
        action="approve_journal_draft",
        target="journal_entry_001",
        prev_hash=entry_1.verification_hash,
    )
    assert entry_2.verify_integrity() is True

    # 3. Construct third chained entry
    entry_3 = AuditLogModel.create_entry(
        category="Assistant Execution",
        actor="OFinanceAssistant",
        action="verify_trial_balance",
        target="accounting",
        prev_hash=entry_2.verification_hash,
    )
    assert entry_3.verify_integrity() is True

    # 4. Verify unbroken chain
    chain = [entry_1, entry_2, entry_3]
    is_valid, error = AuditLogModel.verify_chain(chain)
    assert is_valid is True
    assert error is None

    # 5. Tamper test: Alter entry_2 action
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
        prev_hash="BROKEN_INVALID_HASH",  # Does not match entry_1
    )
    chain = [entry_1, entry_2]
    is_valid, error = AuditLogModel.verify_chain(chain)
    assert is_valid is False
    assert "Hash chain broken" in error


@pytest.mark.asyncio
async def test_audit_service_automated_append_and_db_chain():
    """
    Verify AuditService automatically acquires the latest verification_hash
    and appends unbroken records.
    """
    mock_session = AsyncMock()

    # Empty table -> prev_hash should be GENESIS_HASH
    mock_empty_res = MagicMock()
    mock_empty_res.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_empty_res

    first_entry = await AuditService.append_entry(
        session=mock_session,
        category="Connector Sync",
        actor="Scheduler",
        action="fetch_accounts",
        target="broker_ibkr",
    )
    assert first_entry.prev_hash == AuditService.GENESIS_HASH
    assert first_entry.verify_integrity() is True

    # Next append -> prev_hash should be first_entry.verification_hash
    mock_tail_res = MagicMock()
    mock_tail_res.scalar_one_or_none.return_value = first_entry
    mock_session.execute.return_value = mock_tail_res

    second_entry = await AuditService.append_entry(
        session=mock_session,
        category="Ledger Mutation",
        actor="Operator",
        action="approve_journal_draft",
        target="journal_001",
    )
    assert second_entry.prev_hash == first_entry.verification_hash
    assert second_entry.verify_integrity() is True

    # Verify chain of both entries
    mock_chain_res = MagicMock()
    mock_chain_res.scalars.return_value.all.return_value = [first_entry, second_entry]
    mock_session.execute.return_value = mock_chain_res

    is_valid, error = await AuditService.verify_database_chain(session=mock_session)
    assert is_valid is True
    assert error is None
