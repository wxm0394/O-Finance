"""
Append-Only Audit Log Database Model (PostgreSQL)
Tracks all assistant runs, connector syncs, ledger postings, and approvals
with cryptographically verified SHA-256 hash chains.

Immutability Guarantees:
1. Hash Chaining: Each record cryptographically binds the previous record's hash.
2. Verification: Deterministic sha256 computation verifies no field was tampered with.
3. ORM-Level Immutability: SQLAlchemy event listeners block all UPDATE and DELETE operations.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple
from sqlalchemy import String, Text, event
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.core.security import SecurityPolicyException
from app.models.base import TimestampMixin


def compute_audit_hash(
    prev_hash: str,
    created_at_iso: str,
    category: str,
    actor: str,
    action: str,
    target: str,
    severity: str,
    details_json: str,
) -> str:
    """
    Computes deterministic SHA-256 hash over canonical audit fields.
    """
    canonical_repr = "|".join([
        prev_hash.strip(),
        created_at_iso.strip(),
        category.strip().upper(),
        actor.strip(),
        action.strip(),
        target.strip(),
        severity.strip().upper(),
        details_json.strip(),
    ])
    return hashlib.sha256(canonical_repr.encode("utf-8")).hexdigest()


class AuditLogModel(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False)  # Ledger Mutation, Assistant Execution, Connector Sync, Approval
    actor: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(256), nullable=False)
    target: Mapped[str] = mapped_column(String(256), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default="INFO", nullable=False)  # INFO, WARN, CRITICAL
    verification_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    details_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    @classmethod
    def create_entry(
        cls,
        category: str,
        actor: str,
        action: str,
        target: str,
        prev_hash: str = "",
        severity: str = "INFO",
        details: Optional[Dict[str, object]] = None,
        custom_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> "AuditLogModel":
        """
        Factory method to construct an audit log entry with an automated SHA-256 hash chain.
        """
        entry_id = custom_id or f"audit-{uuid.uuid4().hex[:16]}"
        now = timestamp or datetime.now(timezone.utc)
        now_iso = now.isoformat()
        serialized_details = json.dumps(details or {}, sort_keys=True)

        calculated_hash = compute_audit_hash(
            prev_hash=prev_hash,
            created_at_iso=now_iso,
            category=category,
            actor=actor,
            action=action,
            target=target,
            severity=severity,
            details_json=serialized_details,
        )

        entry = cls(
            id=entry_id,
            category=category,
            actor=actor,
            action=action,
            target=target,
            severity=severity,
            prev_hash=prev_hash,
            verification_hash=calculated_hash,
            details_json=serialized_details,
            created_at=now,
            updated_at=now,
        )
        return entry

    def verify_integrity(self) -> bool:
        """
        Verifies that this entry's verification_hash matches its content.
        """
        now_iso = self.created_at.isoformat() if self.created_at else ""
        expected = compute_audit_hash(
            prev_hash=self.prev_hash,
            created_at_iso=now_iso,
            category=self.category,
            actor=self.actor,
            action=self.action,
            target=self.target,
            severity=self.severity,
            details_json=self.details_json,
        )
        return self.verification_hash == expected

    @classmethod
    def verify_chain(cls, entries: Sequence["AuditLogModel"]) -> Tuple[bool, Optional[str]]:
        """
        Verifies an entire sequence of audit log entries:
        1. Checks that each entry's hash integrity is valid.
        2. Checks that each entry's prev_hash matches the previous entry's verification_hash.
        Returns (is_valid, error_message).
        """
        if not entries:
            return True, None

        for idx, entry in enumerate(entries):
            # 1. Content integrity check
            if not entry.verify_integrity():
                return False, f"Tamper detected at index {idx} (ID: {entry.id}): Content hash mismatch."

            # 2. Chain linkage check
            if idx > 0:
                prev_entry = entries[idx - 1]
                if entry.prev_hash != prev_entry.verification_hash:
                    return False, (
                        f"Hash chain broken at index {idx} (ID: {entry.id}): "
                        f"prev_hash '{entry.prev_hash}' does not match entry {idx-1} hash '{prev_entry.verification_hash}'."
                    )

        return True, None


# IMMUTABILITY ENFORCEMENT: Disallow UPDATE and DELETE on audit_logs table
@event.listens_for(AuditLogModel, "before_update")
def receive_before_update(mapper, connection, target):
    raise SecurityPolicyException(
        f"INVARIANT_8_VIOLATION: Audit logs are append-only. UPDATE on AuditLogModel(id='{target.id}') is prohibited."
    )


@event.listens_for(AuditLogModel, "before_delete")
def receive_before_delete(mapper, connection, target):
    raise SecurityPolicyException(
        f"INVARIANT_8_VIOLATION: Audit logs are immutable. DELETE on AuditLogModel(id='{target.id}') is prohibited."
    )
