"""
Tests for Beancount Bridge & Cross-Storage Atomic Ledger Orchestration (Phase 2.2)
Covers:
1. Invalid account name interception.
2. Floating-point mantissa conversion to Decimal with 0.01 quantization.
3. Double-entry imbalance interception.
4. Double quote and newline escaping.
5. Invariant #7 audit_hash metadata injection.
6. OS-level concurrent atomic file append.
7. Database transaction rollback on write or validation failure.
8. Canonical ledger file validation.
"""

from decimal import Decimal
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db_session
from app.ledger.beancount_bridge import (
    BeancountBridge,
    BeancountPostingItem,
    BeancountValidationError,
)
from app.models.approval import ApprovalTaskModel
from app.models.audit import AuditLogModel
from app.services.approval_service import ApprovalService, compute_payload_hash
from app.services.audit_service import AuditService


@pytest_asyncio.fixture
async def setup_test_db():
    """Setup in-memory SQLite database and override get_db_session dependency."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db_session():
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db_session] = override_get_db_session
    yield session_factory
    app.dependency_overrides.clear()
    await engine.dispose()


def test_validate_account_name():
    """Verify account name validation according to standard 5-root Beancount chart."""
    # Valid
    assert BeancountBridge.validate_account_name("Assets:Cash") is True
    assert BeancountBridge.validate_account_name("Assets:US:Bank:Checking") is True
    assert BeancountBridge.validate_account_name("Liabilities:CreditCard:Visa") is True
    assert BeancountBridge.validate_account_name("Expenses:Food:Restaurants-01") is True

    # Invalid root
    assert BeancountBridge.validate_account_name("InvalidRoot:Sub") is False
    assert BeancountBridge.validate_account_name("assets:Cash") is False

    # Fewer than 2 segments
    assert BeancountBridge.validate_account_name("Assets") is False

    # Empty sub-segments
    assert BeancountBridge.validate_account_name("Assets::Cash") is False
    assert BeancountBridge.validate_account_name("Assets:Cash:") is False

    # Underscores or illegal characters
    assert BeancountBridge.validate_account_name("Assets:Cash_Box") is False
    assert BeancountBridge.validate_account_name("Assets:Cash@Home") is False


def test_beancount_posting_item_decimal_conversion():
    """Verify float/int/str/Decimal inputs are converted and quantized to 2 decimal places."""
    p_float = BeancountPostingItem(account="Assets:Cash", amount=100.556, currency="CNY")
    assert isinstance(p_float.amount, Decimal)
    assert p_float.amount == Decimal("100.56")

    p_int = BeancountPostingItem(account="Assets:Cash", amount=100, currency="CNY")
    assert p_int.amount == Decimal("100.00")

    p_str = BeancountPostingItem(account="Assets:Cash", amount="250.75", currency="CNY")
    assert p_str.amount == Decimal("250.75")

    p_dec = BeancountPostingItem(account="Assets:Cash", amount=Decimal("-100.551"), currency="CNY")
    assert p_dec.amount == Decimal("-100.55")


def test_verify_double_entry_balance_imbalance_interception():
    """Verify double-entry imbalance raises BeancountValidationError."""
    # Fewer than 2 postings
    with pytest.raises(BeancountValidationError, match="at least 2 postings"):
        BeancountBridge.verify_double_entry_balance([
            BeancountPostingItem(account="Assets:Cash", amount=100, currency="CNY")
        ])

    # Unbalanced sum
    unbalanced = [
        BeancountPostingItem(account="Assets:Cash", amount=100, currency="CNY"),
        BeancountPostingItem(account="Expenses:Food", amount=-90, currency="CNY"),
    ]
    with pytest.raises(BeancountValidationError, match="balance error"):
        BeancountBridge.verify_double_entry_balance(unbalanced)

    # Multi-currency unbalanced
    multi_unbalanced = [
        BeancountPostingItem(account="Assets:Cash", amount=100, currency="CNY"),
        BeancountPostingItem(account="Expenses:Food", amount=-100, currency="USD"),
    ]
    with pytest.raises(BeancountValidationError, match="balance error"):
        BeancountBridge.verify_double_entry_balance(multi_unbalanced)

    # Balanced
    balanced = [
        BeancountPostingItem(account="Assets:Cash", amount=-100, currency="CNY"),
        BeancountPostingItem(account="Expenses:Food", amount=100, currency="CNY"),
    ]
    # Should not raise exception
    BeancountBridge.verify_double_entry_balance(balanced)


def test_format_journal_entry_escaping_and_metadata():
    """Verify double quotes and newlines escaping, and metadata line formatting."""
    postings = [
        BeancountPostingItem(account="Assets:Bank:Checking", amount=-500, currency="CNY"),
        BeancountPostingItem(account="Expenses:Office:Supplies", amount=500, currency="CNY"),
    ]

    formatted = BeancountBridge.format_journal_entry(
        date="2026-11-05",
        flag="*",
        payee='Supplier "Acme" Corp\nLine2',
        narration='Office "Laptops" & Chairs',
        postings=postings,
        tx_id="appr-tx-12345",
        confidence=0.95,
        audit_hash="a1b2c3d4e5f67890" * 4,
    )

    lines = formatted.split("\n")
    # Line 1: Header with escaped payee/narration
    assert lines[0] == '2026-11-05 * "Supplier \\"Acme\\" Corp Line2" "Office \\"Laptops\\" & Chairs"'
    # Metadata lines
    assert '  tx_id: "appr-tx-12345"' in lines
    assert '  confidence: 0.95' in lines
    assert f'  audit_hash: "{"a1b2c3d4e5f67890" * 4}"' in lines
    # Postings lines
    assert any("Assets:Bank:Checking" in l and "-500.00 CNY" in l for l in lines)
    assert any("Expenses:Office:Supplies" in l and "500.00 CNY" in l for l in lines)


def test_append_entry_atomic(tmp_path):
    """Verify atomic OS file append using companion lock file."""
    target_file = tmp_path / "ledger" / "main.beancount"
    entry1 = '2026-11-05 * "Payee A" "Narration A"\n  Assets:Cash -100.00 CNY\n  Expenses:Food 100.00 CNY'
    entry2 = '2026-11-05 * "Payee B" "Narration B"\n  Assets:Cash -200.00 CNY\n  Expenses:Rent 200.00 CNY'

    BeancountBridge.append_entry_atomic(target_file, entry1)
    assert target_file.exists()

    BeancountBridge.append_entry_atomic(target_file, entry2)

    content = target_file.read_text(encoding="utf-8")
    assert "Payee A" in content
    assert "Payee B" in content
    # Lock file should exist
    lock_file = tmp_path / "ledger" / "main.beancount.lock"
    assert lock_file.exists()


@pytest.mark.asyncio
async def test_execute_approved_journal_entry_success(tmp_path):
    """Verify successful execution of cross-storage atomic journal entry orchestration."""
    target_file = tmp_path / "journal.beancount"

    payload = {
        "payee": "Tech Store",
        "narration": "Buy Monitor",
        "postings": [
            {"account": "Assets:Checking", "amount": -1500.00, "currency": "CNY"},
            {"account": "Expenses:Equipment", "amount": 1500.00, "currency": "CNY"},
        ],
        "confidence": 0.98,
    }

    mock_session = AsyncMock()

    # Mock approval verification
    mock_approval_res = MagicMock()
    mock_approval_res.is_valid = True
    mock_approval_res.status = "APPROVED"

    # Mock audit entry
    mock_audit_entry = MagicMock(spec=AuditLogModel)
    mock_audit_entry.verification_hash = "f" * 64

    with patch.object(
        ApprovalService, "verify_and_consume_approval", new_callable=AsyncMock
    ) as mock_verify, patch.object(
        AuditService, "append_entry", new_callable=AsyncMock
    ) as mock_audit:
        mock_verify.return_value = mock_approval_res
        mock_audit.return_value = mock_audit_entry

        audit_rec, text_out = await BeancountBridge.execute_approved_journal_entry(
            session=mock_session,
            approval_task_id="appr-test-001",
            expected_task_mode="accounting",
            expected_action="draft_journal_entry",
            expected_target="journal_entry_001",
            expected_payload=payload,
            beancount_file_path=target_file,
            date_str="2026-11-05",
        )

        assert mock_session.commit.called is True
        assert target_file.exists()
        file_content = target_file.read_text(encoding="utf-8")
        assert "Tech Store" in file_content
        assert f'audit_hash: "{"f" * 64}"' in file_content


@pytest.mark.asyncio
async def test_execute_approved_journal_entry_rollback_on_write_failure(tmp_path):
    """Verify DB session rolls back when atomic file write or balance validation fails."""
    unbalanced_payload = {
        "payee": "Bad Store",
        "narration": "Unbalanced Entry",
        "postings": [
            {"account": "Assets:Checking", "amount": -1000.00, "currency": "CNY"},
            {"account": "Expenses:Equipment", "amount": 500.00, "currency": "CNY"},
        ],
    }

    mock_session = AsyncMock()

    mock_approval_res = MagicMock()
    mock_approval_res.is_valid = True

    mock_audit_entry = MagicMock(spec=AuditLogModel)
    mock_audit_entry.verification_hash = "e" * 64

    with patch.object(
        ApprovalService, "verify_and_consume_approval", new_callable=AsyncMock
    ) as mock_verify, patch.object(
        AuditService, "append_entry", new_callable=AsyncMock
    ) as mock_audit:
        mock_verify.return_value = mock_approval_res
        mock_audit.return_value = mock_audit_entry

        target_file = tmp_path / "should_not_exist.beancount"

        with pytest.raises(BeancountValidationError):
            await BeancountBridge.execute_approved_journal_entry(
                session=mock_session,
                approval_task_id="appr-bad-001",
                expected_task_mode="accounting",
                expected_action="draft_journal_entry",
                expected_target="journal_entry_002",
                expected_payload=unbalanced_payload,
                beancount_file_path=target_file,
                date_str="2026-11-05",
            )

        # Assert rollback was executed
        assert mock_session.rollback.called is True
        assert mock_session.commit.called is False


@pytest.mark.asyncio
async def test_canonical_main_beancount_validity():
    """Verify ledger/main.beancount exists and passes run_bean_check cleanly."""
    ledger_path = Path(__file__).parent.parent.parent / "ledger" / "main.beancount"
    assert ledger_path.exists(), f"Canonical ledger file does not exist at {ledger_path}"

    res = BeancountBridge.run_bean_check(ledger_path)
    assert res["valid"] is True, f"run_bean_check failed with errors: {res.get('errors')}"
    assert res["exit_code"] == 0, f"Expected exit code 0, got {res.get('exit_code')}"


@pytest.mark.asyncio
async def test_csv_import_routing_high_vs_low_confidence(async_client, setup_test_db):
    """
    Verify POST /api/v1/ledger/import-csv routing:
    - High confidence (>=0.85) is posted directly to ledger.
    - Low confidence (<0.85) is queued to Approval Inbox.
    """
    payload = {
        "rows": [
            {
                "date": "2026-11-06",
                "payee": "Apple Store",
                "narration": "Hardware purchase",
                "amount": 999.00,
                "currency": "USD",
                "source_account": "Assets:Bank:Checking",
                "target_account": "Expenses:Equipment",
                "confidence": 0.95,
            },
            {
                "date": "2026-11-06",
                "payee": "Unknown Merchant",
                "narration": "Subscription fee",
                "amount": 15.00,
                "currency": "USD",
                "source_account": "Assets:Bank:Checking",
                "target_account": "Expenses:Subscriptions",
                "confidence": 0.60,
            },
        ]
    }

    resp = await async_client.post("/api/v1/ledger/import-csv", json=payload)
    assert resp.status_code == 200, f"Import CSV failed: {resp.text}"

    data = resp.json()
    assert data["total_rows"] == 2
    assert data["posted_count"] == 1
    assert data["queued_for_approval_count"] == 1
    assert len(data["details"]) == 2
    assert data["details"][0]["status"] == "posted"
    assert data["details"][1]["status"] == "queued_for_approval"
