"""
O-Finance Beancount Ledger Bridge Scaffold
Prepares the integration interface for plain-text double-entry general ledger.
Authoritative accounting truth lives in Beancount files (.beancount).
"""

from typing import List, Tuple
from pydantic import BaseModel


class BeancountPostingItem(BaseModel):
    account: str
    amount: float
    currency: str


class BeancountBridgeScaffold:
    """Interface scaffold for future Beancount Python library integration."""

    VALID_ROOTS = {"Assets", "Liabilities", "Equity", "Income", "Expenses"}

    @classmethod
    def validate_account_name(cls, account_name: str) -> bool:
        """Verifies that an account belongs to the standard 5-root Beancount chart."""
        parts = account_name.strip().split(":")
        if not parts or parts[0] not in cls.VALID_ROOTS:
            return False
        return len(parts) >= 2

    @classmethod
    def format_journal_entry(
        cls,
        date: str,
        flag: str,
        payee: str,
        narration: str,
        postings: List[BeancountPostingItem],
    ) -> str:
        """Formats an entry according to standard Beancount syntax."""
        lines = [f'{date} {flag} "{payee}" "{narration}"']
        for p in postings:
            sign = "+" if p.amount >= 0 else "-"
            lines.append(f"  {p.account:<40} {p.amount:>12.2f} {p.currency}")
        return "\n".join(lines)
