"""
Transaction Record Database Model (PostgreSQL)
Normalizes bank and brokerage feeds before Beancount journal generation.
"""

from typing import Optional
from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin


class TransactionRecordModel(Base, TimestampMixin):
    __tablename__ = "transaction_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    date: Mapped[str] = mapped_column(String(16), index=True, nullable=False)  # YYYY-MM-DD
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # Buy, Sell, Dividend, Transfer, Deposit
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    payee: Mapped[str] = mapped_column(String(256), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)  # USD, GBP, EUR, CNY
    ledger_status: Mapped[str] = mapped_column(String(64), default="Draft", nullable=False)
    transfer_pair_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    raw_payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
