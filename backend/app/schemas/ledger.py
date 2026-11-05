"""
O-Finance Ledger DTO Schemas (snake_case)
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class LedgerStatusDto(BaseModel):
    beancount_file_path: str
    bean_check: Dict[str, Any]
    fava_status: Dict[str, Any]


class PostApprovedJournalEntryRequestDto(BaseModel):
    approval_task_id: str
    expected_task_mode: str
    expected_action: str
    expected_target: str
    expected_payload: Dict[str, Any]
    date_str: str
    flag: str = "*"
    beancount_file_path: Optional[str] = None


class PostApprovedJournalEntryResponseDto(BaseModel):
    success: bool
    audit_id: str
    verification_hash: str
    formatted_entry: str
