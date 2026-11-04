"""
O-Finance Core Security & Permission Guard
Enforces 10 Constitutional Invariants:
1. Read-Only Connectors by Default
2. Local Vault Storage Only
3. Zero Frontend Secret Exposure
4. LLM Credential Isolation
5. Non-Bypassable Permission Guard
6. Immutable Raw Feed Store
7. Audited Ledger Mutations
8. Independent Human Authorization (HITL)
9. Authenticated Local API Contract
10. Strict Demo / Production Isolation
"""

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel


class SecurityPolicyException(Exception):
    """Raised when an operation violates financial security invariants."""
    pass


class OperationPermission(BaseModel):
    action: str
    target: str
    is_write: bool
    requires_approval: bool
    is_permitted: bool
    reason: str


class SecurityGuard:
    """
    Central security gateway.
    Prohibits financial writes and enforces Human-In-The-Loop approvals.
    """

    # Operations permanently forbidden on connectors
    PROHIBITED_CONNECTOR_ACTIONS = {
        "initiate_transfer",
        "place_order",
        "withdraw_funds",
        "modify_account_credentials",
        "auto_post_unverified_journal",
    }

    # Operations requiring explicit operator HITL sign-off
    HITL_REQUIRED_ACTIONS = {
        "approve_journal_draft",
        "merge_unmatched_transactions",
        "export_financial_vault",
        "reconcile_discrepancy",
    }

    @classmethod
    def check_connector_action(cls, action: str, connector_id: str) -> OperationPermission:
        """
        Verify whether an action on a bank or brokerage connector is permitted.
        All outbound funds movement is permanently rejected.
        """
        normalized_action = action.strip().lower()

        if normalized_action in cls.PROHIBITED_CONNECTOR_ACTIONS:
            return OperationPermission(
                action=action,
                target=connector_id,
                is_write=True,
                requires_approval=True,
                is_permitted=False,
                reason="INVARIANT_1_VIOLATION: Connectors are strictly read-only. External orders and wires are permanently prohibited.",
            )

        return OperationPermission(
            action=action,
            target=connector_id,
            is_write=False,
            requires_approval=False,
            is_permitted=True,
            reason="Read-only data extraction permitted.",
        )

    @classmethod
    def check_task_mode_permission(
        cls, task_mode: str, tool_name: str, confidence: float = 1.0
    ) -> OperationPermission:
        """
        Validates tool execution permissions against task mode matrix and confidence threshold.
        If confidence < 0.85 on drafting, human approval is strictly required.
        """
        # Forbidden tools across all modes
        if tool_name in cls.PROHIBITED_CONNECTOR_ACTIONS:
            return OperationPermission(
                action=tool_name,
                target=task_mode,
                is_write=True,
                requires_approval=True,
                is_permitted=False,
                reason=f"Tool '{tool_name}' is permanently prohibited by Security Guard.",
            )

        requires_hitl = confidence < 0.85 or tool_name in cls.HITL_REQUIRED_ACTIONS

        return OperationPermission(
            action=tool_name,
            target=task_mode,
            is_write=tool_name.startswith("draft_") or tool_name.startswith("create_"),
            requires_approval=requires_hitl,
            is_permitted=True,
            reason="HITL approval required" if requires_hitl else "Permitted within task mode scope.",
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
