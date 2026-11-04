"""
O-Finance Human-In-The-Loop Approval Service (P2.1.2)
Verifies and consumes approvals against actual database records.
Strict Rules:
1. Never trusts caller-supplied status strings or boolean flags.
2. Reads ApprovalTaskModel directly from PostgreSQL session.
3. Verifies status == "APPROVED".
4. Verifies exact binding: task_mode, action, target, payload hash.
5. Prevents replay: One-time consumption (is_consumed = True).
6. Prevents expired approval execution.
7. Rejects non-existent, pending, rejected, mismatched, or expired tasks.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval import ApprovalTaskModel


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
    Enforces that execution gates query the database, not user request bodies.
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
        risk_level: str = "Medium",
        confidence: float = 0.80,
        actor: str = "Local Operator",
        payload: Optional[Dict[str, Any]] = None,
        expires_in_seconds: Optional[int] = 86400,  # 24 hours default
        custom_id: Optional[str] = None,
    ) -> ApprovalTaskModel:
        """Creates a pending approval task in the database."""
        now = datetime.now(timezone.utc)
        task_id = custom_id or f"appr-{uuid.uuid4().hex[:12]}"
        payload_hash = compute_payload_hash(payload)
        expires_at = now + timedelta(seconds=expires_in_seconds) if expires_in_seconds else None

        task = ApprovalTaskModel(
            id=task_id,
            task_mode=task_mode,
            action=action.strip().lower(),
            target=target.strip(),
            title=title,
            proposed_action=proposed_action,
            risk_level=risk_level,
            confidence=confidence,
            status="Pending",
            actor=actor,
            payload_json=json.dumps(payload) if payload else None,
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
        """Approves a pending task in the database."""
        stmt = select(ApprovalTaskModel).where(ApprovalTaskModel.id == task_id)
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
        """Rejects a pending task in the database."""
        stmt = select(ApprovalTaskModel).where(ApprovalTaskModel.id == task_id)
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
        non-expired database approval.
        If valid and consume=True, marks the approval as consumed to prevent replay.
        """
        # 1. Require task ID
        if not approval_task_id or not approval_task_id.strip():
            return ApprovalVerificationResult(
                is_valid=False,
                status="MISSING_APPROVAL_ID",
                rejection_reason="APPROVAL_MISSING: Operation requires human approval, but no approval_task_id was provided.",
            )

        clean_id = approval_task_id.strip()

        # 2. Query DB directly
        stmt = select(ApprovalTaskModel).where(ApprovalTaskModel.id == clean_id)
        res = await session.execute(stmt)
        task = res.scalar_one_or_none()

        if task is None:
            return ApprovalVerificationResult(
                is_valid=False,
                status="NOT_FOUND",
                approval_task_id=clean_id,
                rejection_reason=f"APPROVAL_NOT_FOUND: Approval task '{clean_id}' does not exist in database.",
            )

        # 3. Check Status
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

        # 4. Check Consumption (Replay Prevention)
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

        # 5. Check Expiration
        now = datetime.now(timezone.utc)
        if task.expires_at:
            # Normalize timezone comparison if needed
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

        # 6. Check Task Mode Match
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

        # 7. Check Action Match
        normalized_action = expected_action.strip().lower()
        if task.action and task.action.strip().lower() != normalized_action:
            return ApprovalVerificationResult(
                is_valid=False,
                status="ACTION_MISMATCH",
                approval_task_id=clean_id,
                rejection_reason=(
                    f"ACTION_MISMATCH: Approval task '{clean_id}' was authorized for action '{task.action}', "
                    f"but requested action was '{expected_action}'."
                ),
            )

        # 8. Check Target Match
        normalized_target = expected_target.strip()
        if task.target and task.target.strip() != normalized_target:
            return ApprovalVerificationResult(
                is_valid=False,
                status="TARGET_MISMATCH",
                approval_task_id=clean_id,
                rejection_reason=(
                    f"TARGET_MISMATCH: Approval task '{clean_id}' was authorized for target '{task.target}', "
                    f"but requested target was '{expected_target}'."
                ),
            )

        # 9. Check Payload Hash Match (if task binds a payload_hash)
        if task.payload_hash and expected_payload is not None:
            computed = compute_payload_hash(expected_payload)
            if task.payload_hash != computed:
                return ApprovalVerificationResult(
                    is_valid=False,
                    status="PAYLOAD_MISMATCH",
                    approval_task_id=clean_id,
                    rejection_reason=(
                        f"PAYLOAD_MISMATCH: Request payload content does not match the approved proposal."
                    ),
                )

        # 10. Valid! Consume if requested
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
