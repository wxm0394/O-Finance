"""
O-Finance Core Security & Permission Guard (P2.1.2 Hardened)
Enforces 10 Constitutional Financial Invariants:
1. Default-Deny: Only explicitly whitelisted tools and actions may execute.
2. Mode-Level Tool Isolation: Each of the 6 Task Modes has a strict whitelist.
3. Explicit Read-Only Whitelist: Connectors and tools are never implicitly read-only.
4. Non-Bypassable External Fund Block: Outbound wires, withdrawals, live order execution
   are permanently prohibited at the architecture level (cannot be bypassed by ANY approval).
5. Database-Backed Approval Gating: SecurityGuard NEVER trusts caller-supplied approval status.
   Operations requiring HITL approval MUST be authoritatively verified by ApprovalService
   against real PostgreSQL database records.
6. Anti-Replay & Anti-Tampering: Approvals are one-time consumed and strictly bound to
   task_mode, tool, target, and payload hash.
7. Local Vault Storage Only: Credentials reside in local backend vault.
8. Zero Frontend Secret Exposure: Sensitive tokens never sent to client.
9. Sanitized Logs: Zero plaintext secrets in log messages or database payloads.
10. Strict Demo / Production Isolation: Demo state never touches live DB.
"""

from typing import Dict, List, Literal, Optional, Set
from pydantic import BaseModel, Field


class SecurityPolicyException(Exception):
    """Raised when an operation violates financial security invariants."""
    pass


ApprovalStatus = Literal[
    "NOT_REQUIRED",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "ALREADY_CONSUMED",
    "MISMATCH",
]


class OperationPermission(BaseModel):
    action: str
    target: str
    is_write: bool
    requires_approval: bool
    approval_status: str = "NOT_REQUIRED"
    is_permitted: bool
    is_permanently_blocked: bool = False
    approval_task_id: Optional[str] = None
    reason: str


class SecurityGuard:
    """
    Central security gateway.
    Enforces Default-Deny, strict per-mode tool whitelists,
    and database-authoritative Human-In-The-Loop approval gates.
    """

    # 1. PERMANENTLY PROHIBITED ACTIONS (Non-bypassable, even with human approval)
    PERMANENTLY_BLOCKED_ACTIONS: Set[str] = {
        "initiate_transfer",
        "place_order",
        "execute_live_trade",
        "withdraw_funds",
        "modify_account_credentials",
        "auto_post_unverified_journal",
        "delete_audit_log",
        "purge_audit_trail",
        "direct_trade_execution",
    }

    # 2. EXPLICIT READ-ONLY CONNECTOR ACTIONS (Only these actions allowed on bank/broker connectors)
    WHITELISTED_CONNECTOR_ACTIONS: Set[str] = {
        "fetch_accounts",
        "fetch_balances",
        "fetch_transactions",
        "fetch_holdings",
        "fetch_statements",
        "verify_connector_status",
    }

    # 3. TASK MODE TOOL WHITELISTS (Strict Mode Isolation)
    TASK_MODE_TOOL_WHITELIST: Dict[str, Set[str]] = {
        "accounting": {
            "query_accounts",
            "query_transactions",
            "query_journal_entries",
            "compute_cash_flow",
            "verify_trial_balance",
            "reconcile_discrepancy",
            "draft_journal_entry",
        },
        "portfolio_analysis": {
            "query_holdings",
            "query_portfolio_breakdown",
            "calculate_unrealized_pnl",
            "compute_dividend_projections",
            "check_concentration_exposure",
        },
        "research": {
            "query_watchlist",
            "fetch_macro_indicators",
            "fetch_economic_calendar",
            "fetch_daily_stock_analysis",
        },
        "quantitative_research": {
            "run_strategy_backtest",
            "query_ohlcv_history",
            "compute_performance_ratios",
            "export_experiment_metrics",
        },
        "audit": {
            "query_audit_stream",
            "verify_audit_hash_chain",
            "inspect_permission_matrix",
            "audit_unmatched_transactions",
        },
        "risk_analysis": {
            "compute_value_at_risk",
            "stress_test_drawdown",
            "analyze_counterparty_exposure",
            "detect_volatility_anomaly",
        },
    }

    # 4. ACTIONS REQUIRING HUMAN-IN-THE-LOOP APPROVAL
    HITL_REQUIRED_TOOLS: Set[str] = {
        "draft_journal_entry",
        "reconcile_discrepancy",
        "merge_unmatched_transactions",
        "export_financial_vault",
    }

    # 5. EXPLICIT READ-ONLY TOOLS
    READ_ONLY_TOOLS: Set[str] = {
        "query_accounts",
        "query_transactions",
        "query_journal_entries",
        "compute_cash_flow",
        "verify_trial_balance",
        "query_holdings",
        "query_portfolio_breakdown",
        "calculate_unrealized_pnl",
        "compute_dividend_projections",
        "check_concentration_exposure",
        "query_watchlist",
        "fetch_macro_indicators",
        "fetch_economic_calendar",
        "fetch_daily_stock_analysis",
        "run_strategy_backtest",
        "query_ohlcv_history",
        "compute_performance_ratios",
        "export_experiment_metrics",
        "query_audit_stream",
        "verify_audit_hash_chain",
        "inspect_permission_matrix",
        "audit_unmatched_transactions",
        "compute_value_at_risk",
        "stress_test_drawdown",
        "analyze_counterparty_exposure",
        "detect_volatility_anomaly",
    }

    @classmethod
    def check_connector_action(cls, action: str, connector_id: str) -> OperationPermission:
        """
        Validates action on a bank or brokerage connector.
        Default-Deny: Unknown actions are strictly blocked.
        Outbound fund operations are permanently blocked.
        """
        normalized = action.strip().lower()

        # Permanent block
        if normalized in cls.PERMANENTLY_BLOCKED_ACTIONS:
            return OperationPermission(
                action=action,
                target=connector_id,
                is_write=True,
                requires_approval=False,
                approval_status="NOT_REQUIRED",
                is_permitted=False,
                is_permanently_blocked=True,
                reason=(
                    f"INVARIANT_4_VIOLATION: Connector action '{action}' is permanently prohibited. "
                    "External fund movements, orders, and credential modifications cannot execute under any circumstance."
                ),
            )

        # Default Deny: Must be in explicit connector whitelist
        if normalized not in cls.WHITELISTED_CONNECTOR_ACTIONS:
            return OperationPermission(
                action=action,
                target=connector_id,
                is_write=True,
                requires_approval=False,
                approval_status="NOT_REQUIRED",
                is_permitted=False,
                is_permanently_blocked=False,
                reason=(
                    f"DEFAULT_DENY: Connector action '{action}' is not in the explicit read-only whitelist. "
                    "Unrecognized actions are strictly denied."
                ),
            )

        return OperationPermission(
            action=action,
            target=connector_id,
            is_write=False,
            requires_approval=False,
            approval_status="NOT_REQUIRED",
            is_permitted=True,
            is_permanently_blocked=False,
            reason="Permitted read-only connector extraction.",
        )

    @classmethod
    def check_task_mode_permission(
        cls,
        task_mode: str,
        tool_name: str,
        target: str = "",
        confidence: float = 1.0,
        approval_task_id: Optional[str] = None,
        approval_verification: Optional[object] = None,  # Optional ApprovalVerificationResult
    ) -> OperationPermission:
        """
        Validates tool execution permissions against task mode matrix and database approval verification.
        CRITICAL RULES (P2.1.2):
        1. Caller-supplied status strings are NOT accepted.
        2. Permanently blocked tools are rejected unconditionally, even if an approval is passed.
        3. Unrecognized task modes or tools are rejected under Default-Deny.
        4. If tool requires HITL approval or confidence < 0.85:
           - If approval_verification is None -> EXECUTION BLOCKED (PENDING).
           - If approval_verification is present -> must be valid from ApprovalService.
        """
        normalized_tool = tool_name.strip().lower()

        # 1. Permanently blocked tools check (NON-BYPASSABLE)
        if normalized_tool in cls.PERMANENTLY_BLOCKED_ACTIONS:
            return OperationPermission(
                action=tool_name,
                target=target or task_mode,
                is_write=True,
                requires_approval=False,
                approval_status="NOT_REQUIRED",
                is_permitted=False,
                is_permanently_blocked=True,
                approval_task_id=approval_task_id,
                reason=f"SECURITY_VIOLATION: Tool '{tool_name}' is permanently prohibited by Security Guard. It cannot be authorized by any approval.",
            )

        # 2. Check task mode existence (Default Deny)
        allowed_tools = cls.TASK_MODE_TOOL_WHITELIST.get(task_mode)
        if allowed_tools is None:
            return OperationPermission(
                action=tool_name,
                target=target or task_mode,
                is_write=True,
                requires_approval=False,
                approval_status="NOT_REQUIRED",
                is_permitted=False,
                is_permanently_blocked=False,
                approval_task_id=approval_task_id,
                reason=f"DEFAULT_DENY: Unknown task mode '{task_mode}'.",
            )

        # 3. Check tool membership in mode whitelist (Mode Isolation)
        if normalized_tool not in allowed_tools:
            return OperationPermission(
                action=tool_name,
                target=target or task_mode,
                is_write=True,
                requires_approval=False,
                approval_status="NOT_REQUIRED",
                is_permitted=False,
                is_permanently_blocked=False,
                approval_task_id=approval_task_id,
                reason=(
                    f"DEFAULT_DENY: Tool '{tool_name}' is not authorized for task mode '{task_mode}'. "
                    f"Authorized tools: {', '.join(sorted(allowed_tools))}."
                ),
            )

        # 4. Check if action is write vs read-only
        is_read_only = normalized_tool in cls.READ_ONLY_TOOLS
        is_write = not is_read_only

        # 5. Check if HITL approval is required
        needs_approval = (
            confidence < 0.85
            or normalized_tool in cls.HITL_REQUIRED_TOOLS
            or is_write
        )

        if not needs_approval:
            return OperationPermission(
                action=tool_name,
                target=target or task_mode,
                is_write=False,
                requires_approval=False,
                approval_status="NOT_REQUIRED",
                is_permitted=True,
                is_permanently_blocked=False,
                approval_task_id=approval_task_id,
                reason="Permitted read-only operation within task mode scope.",
            )

        # 6. HITL Approval Gate: Must be verified by ApprovalService against database
        if approval_verification is None:
            # Caller did not provide database verification result
            return OperationPermission(
                action=tool_name,
                target=target or task_mode,
                is_write=is_write,
                requires_approval=True,
                approval_status="PENDING",
                is_permitted=False,
                is_permanently_blocked=False,
                approval_task_id=approval_task_id,
                reason=(
                    "EXECUTION_BLOCKED: Operation requires database-verified human approval "
                    f"({'confidence ' + str(confidence) + ' < 0.85' if confidence < 0.85 else 'write/critical operation'}). "
                    "Current status is PENDING. Caller must pass a verified approval from ApprovalService."
                ),
            )

        # Evaluate the database verification result object
        is_valid = getattr(approval_verification, "is_valid", False)
        status = getattr(approval_verification, "status", "UNKNOWN")
        rejection_reason = getattr(approval_verification, "rejection_reason", None)
        verified_id = getattr(approval_verification, "approval_task_id", approval_task_id)

        if is_valid and status == "APPROVED":
            return OperationPermission(
                action=tool_name,
                target=target or task_mode,
                is_write=is_write,
                requires_approval=True,
                approval_status="APPROVED",
                is_permitted=True,
                is_permanently_blocked=False,
                approval_task_id=verified_id,
                reason="Permitted: Database-verified human approval confirmed.",
            )

        return OperationPermission(
            action=tool_name,
            target=target or task_mode,
            is_write=is_write,
            requires_approval=True,
            approval_status=status,
            is_permitted=False,
            is_permanently_blocked=False,
            approval_task_id=verified_id,
            reason=f"APPROVAL_REJECTED: {rejection_reason or 'Database verification failed.'}",
        )

    @classmethod
    def sanitize_log_payload(cls, payload: Dict[str, object]) -> Dict[str, object]:
        """
        Redacts sensitive tokens, credentials, and passwords from payloads
        before writing to log files or database records.
        """
        sensitive_keys = {
            "api_key",
            "gemini_api_key",
            "password",
            "token",
            "secret",
            "authorization",
            "key",
        }
        sanitized: Dict[str, object] = {}

        for k, v in payload.items():
            if any(s in k.lower() for s in sensitive_keys):
                sanitized[k] = "[REDACTED_BY_SECURITY_GUARD]"
            elif isinstance(v, dict):
                sanitized[k] = cls.sanitize_log_payload(v)  # type: ignore
            else:
                sanitized[k] = v

        return sanitized
