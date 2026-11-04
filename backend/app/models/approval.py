"""
Human-in-the-Loop (HITL) Approval Task Database Model (PostgreSQL)
Guarantees sensitive ledger mutations and write operations require explicit operator sign-off.
P2.1.2: Enforces binding to task_mode, action, target, payload_hash, and one-time consumption.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin


class ApprovalTaskModel(Base, TimestampMixin):
    __tablename__ = "approval_tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_mode: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    target: Mapped[str] = mapped_column(String(256), default="", nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    proposed_action: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)  # Low, Medium, High, Critical
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), default=0.80, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="Pending", nullable=False)  # Pending, Approved, Rejected
    decision_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actor: Mapped[str] = mapped_column(String(64), default="Local Operator", nullable=False)
    payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
