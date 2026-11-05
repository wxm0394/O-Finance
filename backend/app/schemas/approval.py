"""
O-Finance Approval Task DTO Schemas (snake_case)
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class ApprovalTaskDto(BaseModel):
    id: str
    task_mode: str
    action: str
    target: str
    title: str
    proposed_action: str
    risk_level: str
    confidence: float
    status: str
    actor: str
    payload_json: Optional[str] = None
    payload_hash: Optional[str] = None
    is_consumed: bool
    consumed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    decision_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApprovalDecisionRequestDto(BaseModel):
    actor: str = "Local Operator"
    decision_reason: Optional[str] = None