"""
Tests for Security Guard (Default-Deny, Mode Isolation, Approval Gating)
and Audit Log Hash Chain Immutability
"""

import pytest
from app.core.security import SecurityGuard, OperationPermission
from app.models.audit import AuditLogModel, compute_audit_hash


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
    # Allowed in quantitative_research
    quant_perm = SecurityGuard.check_task_mode_permission(
        task_mode="quantitative_research",
        tool_name="run_strategy_backtest",
    )
    assert quant_perm.is_permitted is True

    # Blocked in accounting
    acct_perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="run_strategy_backtest",
    )
    assert acct_perm.is_permitted is False
    assert "DEFAULT_DENY" in acct_perm.reason


def test_security_guard_permanently_blocked_actions():
    """
    Verify outbound fund movements, live order placements, and credential modifications
    are permanently prohibited regardless of task mode or connector.
    """
    blocked_actions = [
        "initiate_transfer",
        "place_order",
        "execute_live_trade",
        "withdraw_funds",
        "modify_account_credentials",
        "delete_audit_log",
    ]

    for action in blocked_actions:
        # Check on connector
        conn_perm = SecurityGuard.check_connector_action(action, "broker_ibkr")
        assert conn_perm.is_permitted is False
        assert conn_perm.is_permanently_blocked is True

        # Check in task mode
        mode_perm = SecurityGuard.check_task_mode_permission("accounting", action)
        assert mode_perm.is_permitted is False
        assert mode_perm.is_permanently_blocked is True


def test_security_guard_stateful_approval_gating():
    """
    Verify operations requiring approval enter PENDING and cannot execute
    until an explicit APPROVED record is verified.
    """
    # 1. PENDING: Execution is blocked
    pending_perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="draft_journal_entry",
        approval_status="PENDING",
    )
    assert pending_perm.requires_approval is True
    assert pending_perm.approval_status == "PENDING"
    assert pending_perm.is_permitted is False
    assert "EXECUTION_BLOCKED" in pending_perm.reason

    # 2. APPROVED: Execution is permitted
    approved_perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="draft_journal_entry",
        approval_status="APPROVED",
    )
    assert approved_perm.requires_approval is True
    assert approved_perm.approval_status == "APPROVED"
    assert approved_perm.is_permitted is True

    # 3. REJECTED: Execution is blocked
    rejected_perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="draft_journal_entry",
        approval_status="REJECTED",
    )
    assert rejected_perm.approval_status == "REJECTED"
    assert rejected_perm.is_permitted is False


def test_security_guard_low_confidence_blocks_without_approval():
    """
    Verify low confidence (< 0.85) triggers mandatory human approval gating.
    """
    perm = SecurityGuard.check_task_mode_permission(
        task_mode="accounting",
        tool_name="query_accounts",
        confidence=0.75,  # < 0.85
    )
    assert perm.requires_approval is True
    assert perm.approval_status == "PENDING"
    assert perm.is_permitted is False


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
        prev_hash="GENESIS",
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
