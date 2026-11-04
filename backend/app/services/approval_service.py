"""
O-Finance Human-In-The-Loop Approval Service (P2.1.2.1 Hardened)
Authoritative database-backed verification and one-time consumption service.

Key Rules:
1. Row-level Lock (SELECT FOR UPDATE): Precludes concurrent double-consumption of the same approval.
2. Mandatory Full Binding: Every approval task must bind task_mode, action, target, and payload_hash.
   If DB record lacks binding fields, or if execution request lacks expected_payload, execution is rejected.
3. Expiration & Single-Use: Replay is strictly impossible.
4. Fail-Closed: Any DB error or unexpected state results in rejection, never permissive bypass.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval import ApprovalTaskModel

logger = logging.getLogger("ofinance.approval")


def compute_payload_hash(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    """Computes a deterministic SHA-256 hash over canonical payload JSON."""
    if payload is None:
        return None
    canonical_repr = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(canonical_repr.encode("utf-8")).hexdigest()


class ApprovalVerificationResult(BaseModel):
    is_valid: bool
    status: str
    rejection_reason: Optional[str] = None
    approval_task_id: Optional[str] = None
    task_mode: Optional[str] = None
    action: Optional[str] = None
    target: Optional[str] = None


class ApprovalService:
    """
    Authoritative service for managing and verifying HITL approval tasks.
    Enforces that execution gates query the database with row-level locks,
    re-check status, and enforce mandatory content binding.
    """

    @classmethod
    async def create_approval_task(
        cls,
        session: AsyncSession,
        task_mode: str,
        action: str,
        target: str,
        title: str,
        proposed_action: str,
        payload: Dict[str, Any],
        risk_level: str = "Medium",
        confidence: float = 0.80,
        actor: str = "Local Operator",
        expires_in_seconds: Optional[int] = 86400,  # 24 hours default
        custom_id: Optional[str] = None,
    ) -> ApprovalTaskModel:
        """
        Creates a pending approval task in the database with MANDATORY content binding:
        task_mode, action, target, and payload MUST all be provided.
        """
        clean_action = action.strip().lower()
        clean_target = target.strip()
        clean_task_mode = task_mode.strip().lower()

        if not clean_action:
            raise ValueError("Approval tasks must specify a non-empty 'action'.")
        if not clean_target:
            raise ValueError("Approval tasks must specify a non-empty 'target'.")
        if not clean_task_mode:
            raise ValueError("Approval tasks must specify a non-empty 'task_mode'.")
        if payload is None:
            raise ValueError("Approval tasks must provide a 'payload' dict to bind the proposal.")

        now = datetime.now(timezone.utc)
        task_id = custom_id or f"appr-{uuid.uuid4().hex[:12]}"
        payload_hash = compute_payload_hash(payload)
        expires_at = now + timedelta(seconds=expires_in_seconds) if expires_in_seconds else None

        task = ApprovalTaskModel(
            id=task_id,
            task_mode=clean_task_mode,
            action=clean_action,
            target=clean_target,
            title=title,
            proposed_action=proposed_action,
            risk_level=risk_level,
            confidence=confidence,
            status="Pending",
            actor=actor,
            payload_json=json.dumps(payload),
            payload_hash=payload_hash,
            is_consumed=False,
            consumed_at=None,
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )
        session.add(task)
        await session.flush()
        return task

    @classmethod
    async def approve_task(
        cls,
        session: AsyncSession,
        task_id: str,
        actor: str = "Local Operator",
        decision_reason: str = "Explicit operator sign-off in Approval Inbox.",
    ) -> ApprovalTaskModel:
        """Approves a pending task in the database with row-level locking."""
        stmt = (
            select(ApprovalTaskModel)
            .where(ApprovalTaskModel.id == task_id)
            .with_for_update()
        )
        res = await session.execute(stmt)
        task = res.scalar_one_or_none()
        if not task:
            raise ValueError(f"Approval task '{task_id}' not found.")

        if task.status.upper() == "APPROVED":
            return task

        task.status = "Approved"
        task.actor = actor
        task.decision_reason = decision_reason
        task.updated_at = datetime.now(timezone.utc)
        await session.flush()
        return task

    @classmethod
    async def reject_task(
        cls,
        session: AsyncSession,
        task_id: str,
        actor: str = "Local Operator",
        decision_reason: str = "Rejected by operator.",
    ) -> ApprovalTaskModel:
        """Rejects a pending task in the database with row-level locking."""
        stmt = (
            select(ApprovalTaskModel)
            .where(ApprovalTaskModel.id == task_id)
            .with_for_update()
        )
        res = await session.execute(stmt)
        task = res.scalar_one_or_none()
        if not task:
            raise ValueError(f"Approval task '{task_id}' not found.")

        task.status = "Rejected"
        task.actor = actor
        task.decision_reason = decision_reason
        task.updated_at = datetime.now(timezone.utc)
        await session.flush()
        return task

    @classmethod
    async def verify_and_consume_approval(
        cls,
        session: AsyncSession,
        approval_task_id: Optional[str],
        expected_task_mode: str,
        expected_action: str,
        expected_target: str,
        expected_payload: Optional[Dict[str, Any]] = None,
        consume: bool = True,
    ) -> ApprovalVerificationResult:
        """
        Authoritatively verifies whether an operation has a valid, non-consumed,
        non-expired database approval, with strict concurrency and full binding checks.

        Concurrency & Integrity Guarantees:
        - Locks the row with SELECT FOR UPDATE.
        - Verifies required binding fields are non-empty.
        - Verifies expected_payload is provided and matches payload_hash.
        - If valid and consume=True, marks is_consumed=True atomically in the same transaction.
        - On database error or concurrency contention, fails closed.
        """
        # 1. Require task ID
        if not approval_task_id or not approval_task_id.strip():
            return ApprovalVerificationResult(
                is_valid=False,
                status="MISSING_APPROVAL_ID",
                rejection_reason="APPROVAL_MISSING: Operation requires human approval, but no approval_task_id was provided.",
            )

        clean_id = approval_task_id.strip()

        try:
            # 2. Query DB directly with row-level lock (FOR UPDATE)
            stmt = (
                select(ApprovalTaskModel)
                .where(ApprovalTaskModel.id == clean_id)
                .with_for_update()
            )
            res = await session.execute(stmt)
            task = res.scalar_one_or_none()

            if task is None:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="NOT_FOUND",
                    approval_task_id=clean_id,
                    rejection_reason=f"APPROVAL_NOT_FOUND: Approval task '{clean_id}' does not exist in database.",
                )

            # 3. Check Mandatory Binding Integrity in Database Record
            if not task.action or not task.target or not task.payload_hash:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="INCOMPLETE_APPROVAL_BINDING",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"APPROVAL_INCOMPLETE: Approval task '{clean_id}' lacks mandatory binding fields "
                        "(action, target, or payload_hash). Unbound approvals are strictly invalid."
                    ),
                )

            # 4. Check Status (must be Approved)
            if task.status.upper() != "APPROVED":
                return ApprovalVerificationResult(
                    is_valid=False,
                    status=task.status.upper(),
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"APPROVAL_NOT_GRANTED: Approval task '{clean_id}' is in status '{task.status}', "
                        "expected 'Approved'."
                    ),
                )

            # 5. Check Consumption (Replay Prevention / Concurrency Gate)
            if task.is_consumed:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="ALREADY_CONSUMED",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"APPROVAL_ALREADY_CONSUMED: Approval task '{clean_id}' was already executed/consumed at "
                        f"{task.consumed_at} and cannot be reused."
                    ),
                )

            # 6. Check Expiration
            now = datetime.now(timezone.utc)
            if task.expires_at:
                exp = task.expires_at
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if now > exp:
                    return ApprovalVerificationResult(
                        is_valid=False,
                        status="EXPIRED",
                        approval_task_id=clean_id,
                        rejection_reason=f"APPROVAL_EXPIRED: Approval task '{clean_id}' expired at {task.expires_at}.",
                    )

            # 7. Check Task Mode Match
            if task.task_mode != expected_task_mode:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="TASK_MODE_MISMATCH",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"TASK_MODE_MISMATCH: Approval task '{clean_id}' was authorized for mode '{task.task_mode}', "
                        f"but requested execution under '{expected_task_mode}'."
                    ),
                )

            # 8. Check Action Match
            normalized_action = expected_action.strip().lower()
            if task.action.strip().lower() != normalized_action:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="ACTION_MISMATCH",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"ACTION_MISMATCH: Approval task '{clean_id}' was authorized for action '{task.action}', "
                        f"but requested action was '{expected_action}'."
                    ),
                )

            # 9. Check Target Match
            normalized_target = expected_target.strip()
            if task.target.strip() != normalized_target:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="TARGET_MISMATCH",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"TARGET_MISMATCH: Approval task '{clean_id}' was authorized for target '{task.target}', "
                        f"but requested target was '{expected_target}'."
                    ),
                )

            # 10. Check Request Payload Presence and Hash Match
            if expected_payload is None:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="MISSING_REQUEST_PAYLOAD",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"PAYLOAD_MISSING: Approval task '{clean_id}' binds a required payload, "
                        "but the execution request did not provide expected_payload."
                    ),
                )

            computed_hash = compute_payload_hash(expected_payload)
            if task.payload_hash != computed_hash:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="PAYLOAD_MISMATCH",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"PAYLOAD_MISMATCH: Request payload content does not match the approved proposal hash."
                    ),
                )

            # 11. All Checks Pass -> Atomically Consume
            if consume:
                task.is_consumed = True
                task.consumed_at = now
                task.updated_at = now
                await session.flush()

            return ApprovalVerificationResult(
                is_valid=True,
                status="APPROVED",
                approval_task_id=clean_id,
                task_mode=task.task_mode,
                action=task.action,
                target=task.target,
            )

        except Exception as e:
            logger.error("Database error during verify_and_consume_approval: %s", str(e), exc_info=True)
            return ApprovalVerificationResult(
                is_valid=False,
                status="DATABASE_ERROR",
                approval_task_id=clean_id,
                rejection_reason=f"DATABASE_ERROR: Failure occurred during approval verification: {type(e).__name__}",
            )
