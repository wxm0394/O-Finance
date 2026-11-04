"""
Append-Only Audit Log Database Model (PostgreSQL)
Tracks all assistant runs, connector syncs, ledger postings, and approvals
with SHA-256 verification hash chains.
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin


class AuditLogModel(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False)  # Ledger Mutation, Assistant Execution, Connector Sync
    actor: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(256), nullable=False)
    target: Mapped[str] = mapped_column(String(256), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default="INFO", nullable=False)  # INFO, WARN, CRITICAL
    verification_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    details_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
