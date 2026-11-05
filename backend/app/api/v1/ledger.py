"""
O-Finance Ledger API Endpoints (/api/v1/ledger)
Provides Beancount ledger status and atomic posting of approved journal entries.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_session
from app.ledger.beancount_bridge import BeancountBridge
from app.schemas.ledger import LedgerStatusDto, PostApprovedJournalEntryRequestDto, PostApprovedJournalEntryResponseDto


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