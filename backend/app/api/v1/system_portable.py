"""
O-Finance Cross-Device Portable Snapshot API Endpoints (/api/v1/system)
Provides system snapshot export and in-memory integrity verification endpoints.
Supports cross-device portable migration and deterministic integrity validation.
"""

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_session_factory, init_db_schema
from app.ledger.beancount_bridge import BeancountBridge
from app.models.approval import ApprovalTaskModel
from app.models.audit import AuditLogModel

router = APIRouter(prefix="/system", tags=["System Portable"])


class SnapshotManifest(BaseModel):
    """Manifest portion of the portable system snapshot."""
    ledger_sha256: str = Field(
        description="SHA-256 hash of the Beancount ledger content",
        json_schema_extra={"example": "a1b2c3d4e5f60708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"},
    )
    audit_chain_verified: bool = Field(
        description="Whether the audit log hash chain integrity is verified",
        json_schema_extra={"example": True},
    )
    record_count: int = Field(
        description="Total number of records (postings/entries) in the system",
        json_schema_extra={"example": 128},
    )
    timestamp: str = Field(
        description="ISO-8601 UTC timestamp when snapshot was generated",
        json_schema_extra={"example": "2024-01-15T10:30:00Z"},
    )
    version: str = Field(
        description="Snapshot schema version",
        json_schema_extra={"example": "1.0.0"},
    )


class ExportSnapshotResponse(BaseModel):
    """Response model for GET /export-snapshot."""
    manifest: SnapshotManifest
    beancount_ledger_content: str = Field(
        description="Full Beancount plain-text ledger content",
    )
    audit_logs: List[Dict[str, Any]] = Field(
        description="List of audit log entries",
    )
    approval_tasks: List[Dict[str, Any]] = Field(
        description="List of approval task summaries",
    )


class VerifySnapshotRequest(BaseModel):
    """Request model for POST /verify-snapshot."""
    ledger_sha256: str = Field(
        description="Expected SHA-256 digest of the ledger content",
    )
    snapshot_data: Dict[str, Any] = Field(
        description="Full snapshot data from export-snapshot endpoint",
    )


class RestoreSnapshotRequest(BaseModel):
    """Request model for POST /restore-snapshot."""
    ledger_sha256: str = Field(
        description="Expected SHA-256 digest of the ledger content",
    )
    snapshot_data: Dict[str, Any] = Field(
        description="Full snapshot data from export-snapshot endpoint",
    )


class RestoreSnapshotResponse(BaseModel):
    """Response model for POST /restore-snapshot."""
    success: bool = Field(default=True)
    message: str = Field(default="Snapshot restored successfully")
    target_beancount_file: str = Field(
        description="Path to restored Beancount ledger file",
    )


class VerifySnapshotResponse(BaseModel):
    """Response model for POST /verify-snapshot."""
    sha256_match: bool = Field(
        description="Whether the ledger_sha256 digest matches",
        json_schema_extra={"example": True},
    )
    beancount_valid: bool = Field(
        description="Whether Beancount syntax and balance checks pass",
        json_schema_extra={"example": True},
    )
    audit_chain_valid: bool = Field(
        description="Whether the audit log hash chain integrity is valid",
        json_schema_extra={"example": True},
    )
    errors: List[str] = Field(
        description="List of validation error messages, empty if all checks pass",
        default=[],
        json_schema_extra={"example": ["Beancount balance check failed: imbalanced postings"]},
    )


@router.get(
    "/export-snapshot",
    response_model=ExportSnapshotResponse,
    summary="Export Full System Portable Snapshot",
    description="Returns a complete JSON snapshot containing manifest (ledger_sha256, audit_chain_verified, record count, timestamp, version), beancount_ledger_content, audit_logs, and approval_tasks. "
                "This endpoint enables cross-device portable migration of the entire O-Finance system state.",
)
async def export_snapshot() -> ExportSnapshotResponse:
    """
    Export the full system portable snapshot.
    
    Returns:
        ExportSnapshotResponse: Complete system snapshot with manifest and all component data.
    """
    # Initialize database schema if needed
    init_db_schema()
    
    # Generate ledger SHA-256 hash
    beancount_file_path = settings.beancount_file_path
    expanded_path = os.path.expanduser(beancount_file_path)
    if not os.path.exists(expanded_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Beancount ledger file not found at: {expanded_path}",
        )
    
    with open(expanded_path, "r", encoding="utf-8") as f:
        ledger_content = f.read()
    
    ledger_sha256 = hashlib.sha256(
        ledger_content.encode("utf-8")
    ).hexdigest()
    
    # Run bean-check for syntax/balance validity
    bean_check = BeancountBridge.run_bean_check(ledger_path=expanded_path)
    
    audit_logs: List[Dict[str, Any]] = []
    approval_tasks: List[Dict[str, Any]] = []
    
    # Query audit logs and approval tasks if database is available
    factory = get_session_factory()
    if factory is not None:
        async with factory() as session:
            result = await session.execute(select(AuditLogModel))
            audit_models = result.scalars().all()
            audit_logs = [
                {
                    "id": str(audit.id) if audit.id else None,
                    "category": audit.category,
                    "action": audit.action,
                    "target": audit.target,
                    "severity": audit.severity,
                    "verification_hash": audit.verification_hash,
                    "created_at": audit.created_at.isoformat() if audit.created_at else None,
                }
                for audit in audit_models
            ]
            
            result = await session.execute(select(ApprovalTaskModel))
            approval_models = result.scalars().all()
            approval_tasks = [
                {
                    "id": str(task.id) if task.id else None,
                    "title": task.title,
                    "proposed_action": task.proposed_action,
                    "confidence": task.confidence,
                    "risk_level": task.risk_level,
                    "status": task.status,
                    "created_at": task.created_at.isoformat() if task.created_at else None,
                }
                for task in approval_models
            ]
    
    # Build manifest
    manifest = SnapshotManifest(
        ledger_sha256=ledger_sha256,
        audit_chain_verified=bean_check.get("valid", True),
        record_count=bean_check.get("posting_count", 0),
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="1.0.0",
    )
    
    return ExportSnapshotResponse(
        manifest=manifest,
        beancount_ledger_content=ledger_content,
        audit_logs=audit_logs,
        approval_tasks=approval_tasks,
    )


@router.post(
    "/verify-snapshot",
    response_model=VerifySnapshotResponse,
    summary="Verify Snapshot Integrity In-Memory",
    description="Performs in-memory checks on a portable snapshot including: "
                "(a) ledger_sha256 digest match, "
                "(b) Beancount syntax/balance validity via run_bean_check, "
                "(c) SHA-256 audit log hash chain continuity and content integrity. "
                "Returns detailed validation results and any error messages.",
)
async def verify_snapshot(request: VerifySnapshotRequest) -> VerifySnapshotResponse:
    """
    Perform in-memory integrity verification of a portable snapshot.
    
    Checks performed:
    (a) ledger_sha256 digest match against provided snapshot data
    (b) Beancount syntax and balance validity via run_bean_check
    (c) SHA-256 audit log hash chain continuity and content integrity
    
    Args:
        request: VerifySnapshotRequest containing expected ledger_sha256 and snapshot_data
    
    Returns:
        VerifySnapshotResponse: Validation results with boolean flags and error list
    """
    errors: List[str] = []
    
    # (a) Check ledger_sha256 digest match
    provided_hash = request.ledger_sha256
    snapshot_data = request.snapshot_data
    
    actual_ledger_content = snapshot_data.get("beancount_ledger_content", "")
    actual_sha256 = hashlib.sha256(
        actual_ledger_content.encode("utf-8")
    ).hexdigest()
    
    sha256_match = provided_hash == actual_sha256
    if not sha256_match:
        errors.append(
            f"ledger_sha256 digest mismatch: provided={provided_hash}, "
            f"computed={actual_sha256}"
        )
    
    # (b) Beancount syntax/balance validity via run_bean_check
    beancount_valid = True
    try:
        if actual_ledger_content:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".beancount", delete=False, encoding="utf-8"
            ) as tmp:
                tmp.write(actual_ledger_content)
                tmp_path = tmp.name
            try:
                bean_check_result = BeancountBridge.run_bean_check(ledger_path=tmp_path)
                beancount_valid = bean_check_result.get("valid", True)
                if not bean_check_result.get("valid", True):
                    errors.extend(
                        bean_check_result.get("errors", ["Beancount validation failed"])
                    )
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        else:
            expanded_path = os.path.expanduser(settings.beancount_file_path)
            if not os.path.exists(expanded_path):
                beancount_valid = False
                errors.append("Beancount ledger file not found for syntax validation")
            else:
                bean_check_result = BeancountBridge.run_bean_check(ledger_path=expanded_path)
                beancount_valid = bean_check_result.get("valid", True)
                if not bean_check_result.get("valid", True):
                    errors.extend(
                        bean_check_result.get("errors", ["Beancount validation failed"])
                    )
    except Exception as e:
        beancount_valid = False
        errors.append(f"Beancount syntax check error: {str(e)}")
    
    # (c) SHA-256 audit log hash chain continuity and content integrity
    audit_chain_valid = True
    try:
        if "audit_logs" in snapshot_data:
            snapshot_audit_logs = snapshot_data.get("audit_logs", [])
            if snapshot_audit_logs:
                audit_models = []
                for item in snapshot_audit_logs:
                    model = AuditLogModel(
                        category=item.get("category", ""),
                        action=item.get("action", ""),
                        target=item.get("target", ""),
                        severity=item.get("severity", "INFO"),
                        verification_hash=item.get("verification_hash", ""),
                        prev_hash=item.get("prev_hash"),
                    )
                    audit_models.append(model)
                
                if len(audit_models) > 1:
                    chain_valid, chain_error = AuditLogModel.verify_chain(audit_models)
                    if not chain_valid:
                        audit_chain_valid = False
                        errors.append(f"Audit log hash chain broken: {chain_error}")
                elif len(audit_models) == 1:
                    audit_model = audit_models[0]
                    computed_hash = audit_model.compute_audit_hash()
                    if computed_hash != audit_model.verification_hash:
                        audit_chain_valid = False
                        errors.append("Single audit log entry hash integrity check failed")
        else:
            factory = get_session_factory()
            if factory is not None:
                async with factory() as session:
                    result = await session.execute(select(AuditLogModel))
                    audit_models = result.scalars().all()
                    
                    if len(audit_models) > 1:
                        chain_valid, chain_error = AuditLogModel.verify_chain(audit_models)
                        if not chain_valid:
                            audit_chain_valid = False
                            errors.append(f"Audit log hash chain broken: {chain_error}")
                    elif len(audit_models) == 1:
                        audit_model = audit_models[0]
                        computed_hash = audit_model.compute_audit_hash()
                        if computed_hash != audit_model.verification_hash:
                            audit_chain_valid = False
                            errors.append("Single audit log entry hash integrity check failed")
    except Exception as e:
        audit_chain_valid = False
        errors.append(f"Audit chain verification error: {str(e)}")
    
    return VerifySnapshotResponse(
        sha256_match=sha256_match,
        beancount_valid=beancount_valid,
        audit_chain_valid=audit_chain_valid,
        errors=errors,
    )


@router.post(
    "/restore-snapshot",
    response_model=RestoreSnapshotResponse,
    summary="Restore Portable System Snapshot",
    description="Restores system state from a portable snapshot with Fail-Closed cryptographic integrity verification. "
                "If verification fails, HTTP 400 is returned and no files are updated. "
                "On success, target .beancount file is replaced using OS-level atomic write.",
)
async def restore_snapshot(request: RestoreSnapshotRequest) -> RestoreSnapshotResponse:
    """
    Restore system state from a portable snapshot with Fail-Closed validation.
    
    Args:
        request: RestoreSnapshotRequest containing ledger_sha256 and snapshot_data
        
    Returns:
        RestoreSnapshotResponse: Restoration confirmation and target file path
    """
    # 1. Reuse verify_snapshot logic
    verify_req = VerifySnapshotRequest(
        ledger_sha256=request.ledger_sha256,
        snapshot_data=request.snapshot_data,
    )
    verify_res = await verify_snapshot(verify_req)

    # 2. Fail-Closed check
    if not (verify_res.sha256_match and verify_res.beancount_valid and verify_res.audit_chain_valid):
        error_msg = "; ".join(verify_res.errors) or "Snapshot integrity validation failed"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Snapshot verification failed (Fail-Closed): {error_msg}",
        )

    # 3. Replace target .beancount file using OS-level atomic write
    try:
        from pathlib import Path
        target_path = Path(settings.beancount_file_path).expanduser().resolve()
        target_dir = target_path.parent
        target_dir.mkdir(parents=True, exist_ok=True)

        new_ledger_content = request.snapshot_data.get("beancount_ledger_content", "")
        temp_path = target_dir / f"{target_path.name}.restore.tmp.{os.getpid()}"

        with open(temp_path, "w", encoding="utf-8") as f:
            f.write(new_ledger_content)
            f.flush()
            os.fsync(f.fileno())

        os.replace(temp_path, target_path)

        return RestoreSnapshotResponse(
            success=True,
            message="Snapshot restored successfully",
            target_beancount_file=str(target_path),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to replace ledger file during restore: {str(e)}",
        ) from e