"""
O-Finance Audit API Endpoints (/api/v1/audit)
Provides cryptographic audit trail retrieval and chain verification.
"""

import json
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.audit import AuditLogModel
from app.schemas.audit import AuditLogDto, AuditVerifyResponseDto
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get(
    "/logs",
    response_model=list[AuditLogDto],
    summary="Get Audit Logs",
    description="Returns the append-only SHA-256 cryptographic audit trail from the database.",
)
async def get_audit_logs(
    session: AsyncSession = Depends(get_db_session),
) -> list[AuditLogDto]:
    stmt = select(AuditLogModel).order_by(
        AuditLogModel.created_at.asc(), AuditLogModel.id.asc()
    )
    res = await session.execute(stmt)
    entries = res.scalars().all()

    result = []
    for entry in entries:
        details_dict = None
        if entry.details_json:
            try:
                details_dict = json.loads(entry.details_json)
            except Exception:
                details_dict = None

        result.append(
            AuditLogDto(
                id=entry.id,
                created_at=entry.created_at,
                category=entry.category,
                actor=entry.actor,
                action=entry.action,
                target=entry.target,
                prev_hash=entry.prev_hash,
                verification_hash=entry.verification_hash,
                severity=entry.severity,
                details=details_dict,
            )
        )

    return result


@router.get(
    "/verify",
    response_model=AuditVerifyResponseDto,
    summary="Verify Audit Chain",
    description="Returns chain verification status and total record count from AuditService.verify_database_chain().",
)
async def verify_audit_chain(
    session: AsyncSession = Depends(get_db_session),
) -> AuditVerifyResponseDto:
    chain_verified, verification_message = await AuditService.verify_database_chain(session)

    total_records = 0
    if chain_verified:
        stmt = select(AuditLogModel)
        res = await session.execute(stmt)
        total_records = len(list(res.scalars().all()))

    return AuditVerifyResponseDto(
        chain_verified=chain_verified,
        total_records=total_records,
        verification_message=verification_message,
    )