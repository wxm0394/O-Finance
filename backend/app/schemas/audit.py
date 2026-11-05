"""
O-Finance Audit Log DTO Schemas (snake_case)
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class AuditLogDto(BaseModel):
    id: str
    created_at: datetime
    category: str
    actor: str
    action: str
    target: str
    prev_hash: str
    verification_hash: str
    severity: str
    details: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class AuditVerifyResponseDto(BaseModel):
    chain_verified: bool
    total_records: int
    verification_message: Optional[str] = None
