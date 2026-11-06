"""
O-Finance Ledger API Endpoints (/api/v1/ledger)
Provides Beancount ledger status and atomic posting of approved journal entries.
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_session
from app.ledger.beancount_bridge import BeancountBridge, BeancountPostingItem, BeancountValidationError
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService
from app.schemas.ledger import (
    CsvImportRequestDto,
    CsvImportResponseDto,
    LedgerStatusDto,
    PostApprovedJournalEntryRequestDto,
    PostApprovedJournalEntryResponseDto,
)


router = APIRouter(prefix="/ledger", tags=["Ledger"])


@router.get(
    "/status",
    response_model=LedgerStatusDto,
    summary="Get Ledger Status",
    description="Returns ledger path, bean-check validation result, and Fava daemon health.",
)
async def get_ledger_status(
    session: AsyncSession = Depends(get_db_session),
) -> LedgerStatusDto:
    beancount_file_path = settings.beancount_file_path

    # Run bean-check
    bean_check = BeancountBridge.run_bean_check(ledger_path=beancount_file_path)

    # Probe Fava endpoint
    # Parse host and port from fava_server_url (e.g. "http://127.0.0.1:5000")
    fava_url = settings.fava_server_url
    fava_host = "127.0.0.1"
    fava_port = 5000
    if "://" in fava_url:
        host_part = fava_url.split("://")[1]
    else:
        host_part = fava_url
    if ":" in host_part:
        fava_host, port_str = host_part.rsplit(":", 1)
        fava_port = int(port_str)
    else:
        fava_host = host_part

    fava_status = BeancountBridge.probe_fava_endpoint(
        host=fava_host, port=fava_port
    )

    return LedgerStatusDto(
        beancount_file_path=beancount_file_path,
        bean_check=bean_check,
        fava_status=fava_status,
    )


@router.post(
    "/post-approved",
    response_model=PostApprovedJournalEntryResponseDto,
    summary="Post Approved Journal Entry",
    description="Executes an approved journal entry with cross-storage transactional integrity.",
)
async def post_approved_journal_entry(
    payload: PostApprovedJournalEntryRequestDto,
    session: AsyncSession = Depends(get_db_session),
) -> PostApprovedJournalEntryResponseDto:
    # Use provided beancount_file_path or fall back to settings
    beancount_file_path = payload.beancount_file_path or settings.beancount_file_path

    try:
        audit_entry, formatted_entry = await BeancountBridge.execute_approved_journal_entry(
            session=session,
            approval_task_id=payload.approval_task_id,
            expected_task_mode=payload.expected_task_mode,
            expected_action=payload.expected_action,
            expected_target=payload.expected_target,
            expected_payload=payload.expected_payload,
            beancount_file_path=beancount_file_path,
            date_str=payload.date_str,
            flag=payload.flag,
        )

        return PostApprovedJournalEntryResponseDto(
            success=True,
            audit_id=audit_entry.id,
            verification_hash=audit_entry.verification_hash,
            formatted_entry=formatted_entry,
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to post approved journal entry: {str(e)}",
        ) from e


@router.post(
    "/import-csv",
    response_model=CsvImportResponseDto,
    summary="Batch Import Standardized CSV Statement Entries",
    description="Imports CSV statement rows. High confidence (>=0.85) entries are appended directly to Beancount, low confidence entries are queued in Approval Inbox.",
)
async def import_csv_statement(
    payload: CsvImportRequestDto,
    session: AsyncSession = Depends(get_db_session),
) -> CsvImportResponseDto:
    beancount_file_path = settings.beancount_file_path
    posted_count = 0
    queued_count = 0
    details: List[Dict[str, Any]] = []

    for idx, row in enumerate(payload.rows):
        try:
            # Build postings for source and target accounts
            # Direct debit / credit model
            amt = abs(row.amount)
            postings = [
                BeancountPostingItem(
                    account=row.source_account,
                    amount=-amt if row.amount > 0 else amt,
                    currency=row.currency,
                ),
                BeancountPostingItem(
                    account=row.target_account,
                    amount=amt if row.amount > 0 else -amt,
                    currency=row.currency,
                ),
            ]

            # Validate double-entry balance and account naming
            BeancountBridge.verify_double_entry_balance(postings)

            if row.confidence >= 0.85:
                # High confidence -> direct audit log & Beancount append
                audit_entry = await AuditService.append_entry(
                    session=session,
                    category="Ledger Change",
                    actor="CsvImportService",
                    action="POST_JOURNAL_ENTRY",
                    target=row.target_account,
                    severity="INFO",
                    details={
                        "payee": row.payee,
                        "narration": row.narration,
                        "confidence": row.confidence,
                        "source_account": row.source_account,
                        "target_account": row.target_account,
                    },
                )

                formatted_entry = BeancountBridge.format_journal_entry(
                    date=row.date,
                    flag="*",
                    payee=row.payee,
                    narration=row.narration,
                    postings=postings,
                    confidence=row.confidence,
                    audit_hash=audit_entry.verification_hash,
                )

                BeancountBridge.append_entry_atomic(beancount_file_path, formatted_entry)
                posted_count += 1
                details.append({
                    "row_index": idx,
                    "status": "posted",
                    "audit_hash": audit_entry.verification_hash,
                })
            else:
                # Low confidence -> Queue into Approval Inbox
                approval_task = await ApprovalService.create_approval_task(
                    session=session,
                    task_mode="accounting",
                    action="POST_JOURNAL_ENTRY",
                    target=row.target_account,
                    title=f"CSV Import Statement: {row.payee}",
                    payload={
                        "date_str": row.date,
                        "payee": row.payee,
                        "narration": row.narration,
                        "confidence": row.confidence,
                        "postings": [p.model_dump(mode="json") for p in postings],
                    },
                    proposed_action=f"Post CSV statement entry for {row.payee} ({row.amount} {row.currency})",
                    risk_level="MEDIUM",
                    confidence=row.confidence,
                )
                queued_count += 1
                details.append({
                    "row_index": idx,
                    "status": "queued_for_approval",
                    "approval_task_id": approval_task.id,
                })

        except Exception as e:
            details.append({
                "row_index": idx,
                "status": "failed",
                "error": str(e),
            })

    await session.commit()

    return CsvImportResponseDto(
        total_rows=len(payload.rows),
        posted_count=posted_count,
        queued_for_approval_count=queued_count,
        details=details,
    )