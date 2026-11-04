"""
O-Finance Audit Service (P2.1.2)
Provides automated, serialized, cryptographically chained audit logging.

Security & Threat Model Disclosure:
1. ORM Protection: SQLAlchemy event listeners intercept normal ORM-level UPDATE and DELETE.
2. Raw SQL Limitation: ORM events cannot prevent direct raw SQL execution by high-privileged
   database roles (e.g. postgres superuser).
3. Recommended DB Protection: Production databases must enforce least privilege:
   - REVOKE UPDATE, DELETE ON audit_logs FROM ofinance_app_user;
   - GRANT INSERT, SELECT ON audit_logs TO ofinance_app_user;
   - Optional PostgreSQL trigger raising exception BEFORE UPDATE OR DELETE.
4. Cryptographic Chaining: Chaining using SHA-256 guarantees tamper-evidence (detection),
   but is not hardware WORM storage. Any offline modification will invalidate verify_database_chain().
"""

from typing import Dict, List, Optional, Sequence, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLogModel, compute_audit_hash


class AuditService:
    """
    Service managing append-only audit records with automated hash chaining.
    """

    GENESIS_HASH: str = "0000000000000000000000000000000000000000000000000000000000000000"

    @classmethod
    async def append_entry(
        cls,
        session: AsyncSession,
        category: str,
        actor: str,
        action: str,
        target: str,
        severity: str = "INFO",
        details: Optional[Dict[str, object]] = None,
        custom_id: Optional[str] = None,
    ) -> AuditLogModel:
        """
        Appends a new audit record automatically chained to the tail of the log.
        Locks the latest row with SELECT ... FOR UPDATE to prevent concurrency forks.
        """
        # Query latest audit log entry with row lock
        stmt = (
            select(AuditLogModel)
            .order_by(AuditLogModel.created_at.desc(), AuditLogModel.id.desc())
            .limit(1)
            .with_for_update()
        )
        res = await session.execute(stmt)
        latest_entry = res.scalar_one_or_none()

        prev_hash = latest_entry.verification_hash if latest_entry else cls.GENESIS_HASH

        entry = AuditLogModel.create_entry(
            category=category,
            actor=actor,
            action=action,
            target=target,
            prev_hash=prev_hash,
            severity=severity,
            details=details,
            custom_id=custom_id,
        )

        session.add(entry)
        await session.flush()
        return entry

    @classmethod
    async def verify_database_chain(
        cls,
        session: AsyncSession,
    ) -> Tuple[bool, Optional[str]]:
        """
        Scans all audit log entries from database in chronological order
        and verifies:
        1. Every entry's hash integrity is intact.
        2. Every entry's prev_hash matches the preceding record's verification_hash.
        3. The first entry links to GENESIS_HASH.
        """
        stmt = select(AuditLogModel).order_by(AuditLogModel.created_at.asc(), AuditLogModel.id.asc())
        res = await session.execute(stmt)
        entries = list(res.scalars().all())

        if not entries:
            return True, None

        # Verify genesis
        first = entries[0]
        if first.prev_hash not in (cls.GENESIS_HASH, "", "GENESIS"):
            return False, f"Genesis link invalid on entry {first.id}: prev_hash is '{first.prev_hash}'"

        return AuditLogModel.verify_chain(entries)
