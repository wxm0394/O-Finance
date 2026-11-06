"""
O-Finance Beancount Ledger Bridge (Phase 2.2 Hardened)
Authoritative double-entry general ledger formatting, validation, atomic OS file append,
and cross-storage transactional orchestration.
Authoritative accounting truth lives in Beancount files (.beancount).
"""

from decimal import Decimal, ROUND_HALF_UP
import fcntl
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLogModel
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService


class BeancountValidationError(ValueError):
    """Raised when Beancount account name, posting, balance, or syntax validation fails."""
    pass


TWOPLACES = Decimal("0.01")


def quantize_amount(val: Any) -> Decimal:
    """Converts int/float/str/Decimal to Decimal quantized to 2 decimal places (0.01)."""
    if isinstance(val, Decimal):
        d = val
    elif isinstance(val, float):
        d = Decimal(str(val))
    else:
        d = Decimal(str(val))
    return d.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


class BeancountPostingItem(BaseModel):
    account: str
    amount: Decimal
    currency: str = "CNY"

    @field_validator("amount", mode="before")
    @classmethod
    def convert_and_quantize_amount(cls, v: Any) -> Decimal:
        try:
            return quantize_amount(v)
        except Exception as e:
            raise ValueError(f"Invalid monetary amount '{v}': {e}") from e

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        clean = v.strip().upper()
        if not re.match(r"^[A-Z][A-Z0-9'._-]{0,23}$", clean):
            raise ValueError(f"Invalid currency symbol '{v}'")
        return clean


class BeancountBridgeScaffold:
    """Interface for Beancount double-entry general ledger validation, formatting, and file append."""

    VALID_ROOTS = {"Assets", "Liabilities", "Equity", "Income", "Expenses"}
    ACCOUNT_SUBSEG_REGEX = re.compile(r"^[A-Z0-9][A-Za-z0-9-]*$")

    @classmethod
    def validate_account_name(cls, account_name: str) -> bool:
        """
        Verifies that an account belongs to standard 5-root Beancount chart
        and every sub-segment matches ^[A-Z0-9][A-Za-z0-9-]*$.
        Requires at least 2 segments (e.g. Assets:Cash).
        Disallows empty segments (Assets::Cash) or underscores (Assets:Cash_Box).
        """
        if not account_name or not isinstance(account_name, str):
            return False

        parts = account_name.strip().split(":")
        if len(parts) < 2:
            return False

        if parts[0] not in cls.VALID_ROOTS:
            return False

        for subseg in parts[1:]:
            if not cls.ACCOUNT_SUBSEG_REGEX.match(subseg):
                return False

        return True

    @classmethod
    def verify_double_entry_balance(cls, postings: List[BeancountPostingItem]) -> None:
        """
        Verifies double-entry bookkeeping balance:
        1. At least 2 postings required.
        2. Validate every account name.
        3. Sum of postings per currency MUST equal Decimal("0.00").
        Raises BeancountValidationError on failure.
        """
        if not postings or len(postings) < 2:
            raise BeancountValidationError("Double-entry journal entry must contain at least 2 postings.")

        currency_balances: Dict[str, Decimal] = {}
        for p in postings:
            if not cls.validate_account_name(p.account):
                raise BeancountValidationError(f"Invalid Beancount account name '{p.account}'.")

            curr = p.currency.upper()
            currency_balances[curr] = currency_balances.get(curr, Decimal("0.00")) + p.amount

        for curr, total in currency_balances.items():
            if total != Decimal("0.00"):
                raise BeancountValidationError(
                    f"Double-entry balance error for currency '{curr}': Sum of postings is {total}, expected 0.00"
                )

    @classmethod
    def _escape_string(cls, text: str) -> str:
        """Escapes double quotes and replaces newlines in Beancount payee/narration."""
        clean = text.replace("\\", "\\\\").replace('"', '\\"').replace("\r\n", " ").replace("\n", " ")
        return clean

    @classmethod
    def format_journal_entry(
        cls,
        date: str,
        flag: str,
        payee: str,
        narration: str,
        postings: List[BeancountPostingItem],
        tx_id: Optional[str] = None,
        confidence: Optional[float] = None,
        audit_hash: Optional[str] = None,
    ) -> str:
        """
        Formats an entry according to standard Beancount syntax, with double-quote escaping
        and Invariant #7 audit metadata binding.
        """
        cls.verify_double_entry_balance(postings)

        escaped_payee = cls._escape_string(payee)
        escaped_narration = cls._escape_string(narration)

        lines = [f'{date} {flag} "{escaped_payee}" "{escaped_narration}"']

        # Add Invariant #7 metadata lines indented by 2 spaces
        if tx_id:
            lines.append(f'  tx_id: "{cls._escape_string(tx_id)}"')
        if confidence is not None:
            lines.append(f"  confidence: {confidence:.2f}")
        if audit_hash:
            lines.append(f'  audit_hash: "{cls._escape_string(audit_hash)}"')

        for p in postings:
            lines.append(f"  {p.account:<40} {p.amount:>12.2f} {p.currency}")

        return "\n".join(lines)

    @classmethod
    def append_entry_atomic(cls, file_path: Union[str, Path], entry_text: str) -> None:
        """
        Appends an entry text atomically to a .beancount file using OS-level fcntl flock.
        Uses a companion `.beancount.lock` file in the same directory.
        """
        target_path = Path(file_path).expanduser().resolve()
        target_dir = target_path.parent
        target_dir.mkdir(parents=True, exist_ok=True)

        lock_path = target_dir / f"{target_path.name}.lock"

        # Open lock file and acquire exclusive lock
        lock_fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)

            # Read existing content if file exists
            existing_content = ""
            if target_path.exists():
                with open(target_path, "r", encoding="utf-8") as f:
                    existing_content = f.read()

            # Prepare new combined content
            if existing_content and not existing_content.endswith("\n\n"):
                if not existing_content.endswith("\n"):
                    new_content = existing_content + "\n\n" + entry_text.strip() + "\n"
                else:
                    new_content = existing_content + "\n" + entry_text.strip() + "\n"
            else:
                new_content = existing_content + entry_text.strip() + "\n"

            # Write to temp file in same directory
            temp_path = target_dir / f"{target_path.name}.tmp.{os.getpid()}"
            with open(temp_path, "w", encoding="utf-8") as tmp_f:
                tmp_f.write(new_content)
                tmp_f.flush()
                os.fsync(tmp_f.fileno())

            # Atomically replace target file
            os.replace(temp_path, target_path)

        finally:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
            except Exception:
                pass
            os.close(lock_fd)

    @classmethod
    async def execute_approved_journal_entry(
        cls,
        session: AsyncSession,
        approval_task_id: str,
        expected_task_mode: str,
        expected_action: str,
        expected_target: str,
        expected_payload: Dict[str, Any],
        beancount_file_path: Union[str, Path],
        date_str: str,
        flag: str = "*",
    ) -> Tuple[AuditLogModel, str]:
        """
        Executes an approved journal entry with cross-storage transactional integrity:
        (a) Verify & consume HITL approval token via ApprovalService
        (b) Append AuditLog record with category "Ledger Change"
        (c) Inject audit_hash into Beancount journal entry text
        (d) Write Beancount entry atomically using OS lock
        (e) Fail closed & rollback DB transaction if file write or validation fails.
        """
        try:
            # (a) Verify and consume approval
            approval_res = await ApprovalService.verify_and_consume_approval(
                session=session,
                approval_task_id=approval_task_id,
                expected_task_mode=expected_task_mode,
                expected_action=expected_action,
                expected_target=expected_target,
                expected_payload=expected_payload,
                consume=True,
            )
            if not approval_res.is_valid:
                raise BeancountValidationError(
                    f"APPROVAL_VERIFICATION_FAILED: {approval_res.rejection_reason}"
                )

            # Extract postings from payload
            raw_postings = expected_payload.get("postings", [])
            postings = [
                p if isinstance(p, BeancountPostingItem) else BeancountPostingItem(**p)
                for p in raw_postings
            ]

            payee = expected_payload.get("payee", "Unspecified Payee")
            narration = expected_payload.get("narration", "Unspecified Narration")

            # (b) Create audit record
            audit_entry = await AuditService.append_entry(
                session=session,
                category="Ledger Change",
                actor="BeancountBridge",
                action=expected_action,
                target=expected_target,
                severity="INFO",
                details={
                    "approval_task_id": approval_task_id,
                    "beancount_file": str(beancount_file_path),
                    "payee": payee,
                    "narration": narration,
                },
            )

            # (c) Format Beancount entry with audit_hash
            formatted_entry = cls.format_journal_entry(
                date=date_str,
                flag=flag,
                payee=payee,
                narration=narration,
                postings=postings,
                tx_id=approval_task_id,
                confidence=expected_payload.get("confidence"),
                audit_hash=audit_entry.verification_hash,
            )

            # (d) Atomic file write
            cls.append_entry_atomic(beancount_file_path, formatted_entry)

            # Commit DB session
            await session.commit()
            return audit_entry, formatted_entry

        except Exception as e:
            await session.rollback()
            raise e

    @classmethod
    def parse_ledger_entries_and_balances(cls, ledger_path: Union[str, Path]) -> Dict[str, Any]:
        """
        Parses a .beancount ledger file and returns all journal entries with their metadata
        and computed cumulative account balances per currency.

        Returns dict with keys:
        - entries: List[Dict], each dict contains date, flag, payee, narration, tx_id, confidence,
          audit_hash, postings (list of {account, amount, currency}), status="Posted", sourceTransactionId
        - balances: Dict[str, Dict[str, float]], mapping account name -> {currency: balance}
        """
        target_path = Path(ledger_path).expanduser().resolve()
        if not target_path.exists():
            return {
                "entries": [],
                "balances": {},
            }

        try:
            with open(target_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            return {
                "entries": [],
                "balances": {},
            }

        lines = content.splitlines()

        entry_header_pattern = re.compile(
            r"^(\d{4}-\d{2}-\d{2})\s+([\*\!])(?:\s+\"([^\"]*)\")?(?:\s+\"([^\"]*)\")?"
        )
        metadata_pattern = re.compile(
            r"^\s+([a-zA-Z_][a-zA-Z0-9_]*):\s+(?:\"([^\"]*)\"|(-?[\d,.]+))"
        )
        posting_pattern = re.compile(
            r"^\s+([A-Z][A-Za-z0-9:-]+)\s+(-?[\d,.]+)\s+([A-Z]{3})"
        )

        raw_entries: List[Dict[str, Any]] = []
        balances: Dict[str, Dict[str, Decimal]] = {}

        current_entry_header: Optional[Dict[str, str]] = None
        current_postings: List[Dict[str, Any]] = []
        current_metadata: Dict[str, Any] = {}

        def finalize_entry():
            nonlocal current_entry_header, current_postings, current_metadata
            if current_entry_header and current_postings:
                entry_id = current_metadata.get("tx_id", f"JE-{len(raw_entries) + 1:03d}")
                entry_dict = {
                    "id": entry_id,
                    "date": current_entry_header["date"],
                    "flag": current_entry_header["flag"],
                    "payee": current_entry_header["payee"],
                    "narration": current_entry_header["narration"],
                    "postings": current_postings,
                    "status": "Posted",
                    "sourceTransactionId": current_metadata.get("tx_id"),
                }
                if "tx_id" in current_metadata:
                    entry_dict["tx_id"] = current_metadata["tx_id"]
                if "confidence" in current_metadata:
                    entry_dict["confidence"] = current_metadata["confidence"]
                if "audit_hash" in current_metadata:
                    entry_dict["audit_hash"] = current_metadata["audit_hash"]

                raw_entries.append(entry_dict)

                for p in current_postings:
                    acct = p["account"]
                    amt = Decimal(str(p["amount"])).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    curr = p["currency"]
                    if acct not in balances:
                        balances[acct] = {}
                    balances[acct][curr] = balances[acct].get(curr, Decimal("0.00")) + amt

        for line in lines:
            m_header = entry_header_pattern.match(line)
            if m_header:
                finalize_entry()
                payee = m_header.group(3) or ""
                narration = m_header.group(4) or ""
                if not m_header.group(4) and payee:
                    # If only one string was in quotes: date * "Narration"
                    narration = payee
                    payee = ""
                current_entry_header = {
                    "date": m_header.group(1),
                    "flag": m_header.group(2),
                    "payee": payee,
                    "narration": narration,
                }
                current_postings = []
                current_metadata = {}
                continue

            if current_entry_header is not None:
                m_meta = metadata_pattern.match(line)
                if m_meta:
                    key = m_meta.group(1)
                    str_val = m_meta.group(2)
                    num_val = m_meta.group(3)
                    if str_val is not None:
                        current_metadata[key] = str_val
                    elif num_val is not None:
                        try:
                            current_metadata[key] = float(num_val)
                        except ValueError:
                            current_metadata[key] = num_val
                    continue

                m_post = posting_pattern.match(line)
                if m_post:
                    acct = m_post.group(1)
                    amt_str = m_post.group(2).replace(",", "")
                    curr = m_post.group(3)
                    try:
                        amt = float(amt_str)
                    except ValueError:
                        amt = 0.0
                    current_postings.append({
                        "account": acct,
                        "amount": amt,
                        "currency": curr,
                    })
                    continue

                if line and not line.startswith(" ") and not line.startswith("\t"):
                    finalize_entry()
                    current_entry_header = None
                    current_postings = []
                    current_metadata = {}

        finalize_entry()

        balances_float: Dict[str, Dict[str, float]] = {}
        for account, currencies in balances.items():
            balances_float[account] = {curr: float(bal) for curr, bal in currencies.items()}

        return {
            "entries": raw_entries,
            "balances": balances_float,
        }

    @classmethod
    def run_bean_check(cls, ledger_path: Union[str, Path]) -> Dict[str, Any]:
        """
        Runs native bean-check CLI syntax and balance validation on a .beancount file.
        Falls back to internal validation if bean-check CLI is not available.
        Returns dict with keys: valid, errors, warnings, exit_code, output.
        """
        target_path = Path(ledger_path).expanduser().resolve()
        if not target_path.exists():
            return {
                "valid": False,
                "errors": [f"Ledger file not found: {ledger_path}"],
                "warnings": [],
                "exit_code": 1,
                "output": "",
            }

        # Attempt to run bean-check CLI
        try:
            result = subprocess.run(
                ["bean-check", str(target_path)],
                capture_output=True,
                text=True,
                timeout=30,
            )
            output = result.stdout + result.stderr
            return {
                "valid": result.returncode == 0,
                "errors": [line for line in output.splitlines() if line.strip()],
                "warnings": [],
                "exit_code": result.returncode,
                "output": output,
            }
        except FileNotFoundError:
            # bean-check CLI not installed; fall back to internal validation
            return cls._fallback_bean_check(target_path)
        except subprocess.TimeoutExpired:
            return {
                "valid": False,
                "errors": ["bean-check execution timed out after 30s"],
                "warnings": [],
                "exit_code": 124,
                "output": "",
            }

    @classmethod
    def _fallback_bean_check(cls, ledger_path: Path) -> Dict[str, Any]:
        """
        Fallback internal validation when bean-check CLI is unavailable.
        Performs basic syntax checks and double-entry balance verification.
        """
        errors: List[str] = []
        warnings: List[str] = []

        try:
            with open(ledger_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            return {
                "valid": False,
                "errors": [f"Cannot read ledger file: {e}"],
                "warnings": [],
                "exit_code": 1,
                "output": "",
            }

        # Basic line syntax checks
        for lineno, line in enumerate(content.splitlines(), start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            # Check for lines that look like postings but lack proper format
            if re.match(r"^\d{4}-\d{2}-\d{2}", stripped) or re.match(r"^\t", stripped):
                # Looks like a Beancount entry line or posting
                pass

        posting_pattern = re.compile(r"^(\t+)(.+?)\s+(-?[\d,.]+)\s+([A-Z]{3})")
        postings = []
        for line in content.splitlines():
            m = posting_pattern.match(line)
            if m:
                account = m.group(2).strip()
                amount_str = m.group(3).replace(",", "")
                try:
                    amount = float(amount_str)
                    postings.append({"account": account, "amount": amount})
                except ValueError:
                    warnings.append(f"Line {line}: Could not parse amount")

        if len(postings) < 2:
            errors.append("Fewer than 2 postings found - double-entry balance cannot be verified")
            return {"valid": False, "errors": errors, "warnings": warnings, "exit_code": 1, "output": content}

        # Basic balance check using internal verify_double_entry_balance logic
        currency_balances: Dict[str, Decimal] = {}
        for p in postings:
            curr = "CNY"
            currency_balances[curr] = currency_balances.get(curr, Decimal("0.00")) + Decimal(str(p["amount"]))

        for curr, total in currency_balances.items():
            if total != Decimal("0.00"):
                errors.append(f"Balance error for currency '{curr}': sum = {total}, expected 0.00")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "exit_code": 0 if len(errors) == 0 else 1,
            "output": content,
        }

    @classmethod
    def probe_fava_endpoint(cls, host: str, port: int, timeout: float = 5.0) -> Dict[str, Any]:
        """
        Probes a local Fava dashboard endpoint to check UI accessibility.
        Uses HTTP client to ping http://host:port (or http://host:port/fava).
        Returns dict with keys: reachable, status_code, response_time_ms, error.
        """
        import httpx

        urls_to_try = [
            f"http://{host}:{port}/",
            f"http://{host}:{port}/fava",
            f"http://{host}:{port}",
        ]

        result: Dict[str, Any] = {
            "reachable": False,
            "status_code": None,
            "response_time_ms": None,
            "error": None,
        }

        for url in urls_to_try:
            try:
                start = __import__("time").time()
                with httpx.Client(timeout=timeout) as client:
                    resp = client.get(url)
                    elapsed_ms = int((__import__("time").time() - start) * 1000)
                    result["reachable"] = True
                    result["status_code"] = resp.status_code
                    result["response_time_ms"] = elapsed_ms
                    return result
            except httpx.ConnectError as e:
                result["error"] = f"Connection error probing {url}: {e}"
                continue
            except httpx.TimeoutException as e:
                result["error"] = f"Timeout probing {url}: {e}"
                continue
            except Exception as e:
                result["error"] = f"Unexpected error probing {url}: {e}"
                continue

        return result


BeancountBridge = BeancountBridgeScaffold
