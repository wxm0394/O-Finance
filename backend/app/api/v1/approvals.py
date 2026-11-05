"""
O-Finance Approval API Endpoints (/api/v1/approvals)
Provides Human-In-The-Loop approval task management with audit logging of decisions.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Path, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.approval import ApprovalTaskModel
from app.schemas.approval import ApprovalTaskDto, ApprovalDecisionRequestDto
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get(
    "",
    response_model=list[ApprovalTaskDto],
    summary="Get Approval Tasks",
    description="Returns the list of approval tasks from the database.",
)
async def get_approval_tasks(
    session: AsyncSession = Depends(get_db_session),
) -> list[ApprovalTaskDto]:
    stmt = select(ApprovalTaskModel).order_by(
        ApprovalTaskModel.created_at.asc(), ApprovalTaskModel.id.asc()
    )
    res = await session.execute(stmt)
    tasks = res.scalars().all()
    return [
        ApprovalTaskDto(
            id=t.id,
            task_mode=t.task_mode,
            action=t.action,
            target=t.target,
            title=t.title,
            proposed_action=t.proposed_action,
            risk_level=t.risk_level,
            confidence=t.confidence,
            status=t.status,
            actor=t.actor,
            payload_json=t.payload_json,
            payload_hash=t.payload_hash,
            is_consumed=t.is_consumed,
            consumed_at=t.consumed_at,
            expires_at=t.expires_at,
            decision_reason=t.decision_reason,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tasks
    ]


@router.post(
    "/{task_id}/approve",
    response_model=ApprovalTaskDto,
    summary="Approve Approval Task",
    description="Approves a pending approval task and logs the decision via AuditService.",
)
async def approve_approval_task(
    task_id: str = Path(..., description="The approval task ID to approve"),
    decision_request: Optional[ApprovalDecisionRequestDto] = None,
    session: AsyncSession = Depends(get_db_session),
) -> ApprovalTaskDto:
    req = decision_request or ApprovalDecisionRequestDto()
    actor = req.actor or "Local Operator"
    reason = req.decision_reason or "Explicit operator sign-off in Approval Inbox."

    try:
        task = await ApprovalService.approve_task(
            session=session,
            task_id=task_id,
            actor=actor,
            decision_reason=reason,
        )

        await AuditService.append_entry(
            session=session,
            category="Approval Decision",
            actor=actor,
            action="approve",
            target=task_id,
            severity="INFO",
            details={
                "approval_task_id": task_id,
                "task_mode": task.task_mode,
                "action": task.action,
                "target": task.target,
                "decision_reason": task.decision_reason,
            },
        )

        await session.commit()

        return ApprovalTaskDto(
            id=task.id,
            task_mode=task.task_mode,
            action=task.action,
            target=task.target,
            title=task.title,
            proposed_action=task.proposed_action,
            risk_level=task.risk_level,
            confidence=task.confidence,
            status=task.status,
            actor=task.actor,
            payload_json=task.payload_json,
            payload_hash=task.payload_hash,
            is_consumed=task.is_consumed,
            consumed_at=task.consumed_at,
            expires_at=task.expires_at,
            decision_reason=task.decision_reason,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
    except ValueError as e:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.post(
    "/{task_id}/reject",
    response_model=ApprovalTaskDto,
    summary="Reject Approval Task",
    description="Rejects a pending approval task and logs the decision via AuditService.",
)
async def reject_approval_task(
    task_id: str = Path(..., description="The approval task ID to reject"),
    decision_request: Optional[ApprovalDecisionRequestDto] = None,
    session: AsyncSession = Depends(get_db_session),
) -> ApprovalTaskDto:
    req = decision_request or ApprovalDecisionRequestDto()
    actor = req.actor or "Local Operator"
    reason = req.decision_reason or "Rejected by operator."

    try:
        task = await ApprovalService.reject_task(
            session=session,
            task_id=task_id,
            actor=actor,
            decision_reason=reason,
        )

        await AuditService.append_entry(
            session=session,
            category="Approval Decision",
            actor=actor,
            action="reject",
            target=task_id,
            severity="INFO",
            details={
                "approval_task_id": task_id,
                "task_mode": task.task_mode,
                "action": task.action,
                "target": task.target,
                "decision_reason": task.decision_reason,
            },
        )

        await session.commit()

        return ApprovalTaskDto(
            id=task.id,
            task_mode=task.task_mode,
            action=task.action,
            target=task.target,
            title=task.title,
            proposed_action=task.proposed_action,
            risk_level=task.risk_level,
            confidence=task.confidence,
            status=task.status,
            actor=task.actor,
            payload_json=task.payload_json,
            payload_hash=task.payload_hash,
            is_consumed=task.is_consumed,
            consumed_at=task.consumed_at,
            expires_at=task.expires_at,
            decision_reason=task.decision_reason,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
    except ValueError as e:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e