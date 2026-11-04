"""
Human-in-the-Loop (HITL) Approval Task Database Model (PostgreSQL)
Guarantees sensitive ledger mutations require explicit operator sign-off.
"""

from typing import Optional
from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin


class ApprovalTaskModel(Base, TimestampMixin):
    __tablename__ = "approval_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_mode: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    proposed_action: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)  # Low, Medium, High, Critical
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), default=0.80, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="Pending", nullable=False)  # Pending, Approved, Rejected
    decision_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actor: Mapped[str] = mapped_column(String(64), default="Local Operator", nullable=False)
    payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
