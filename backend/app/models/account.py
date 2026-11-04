"""
Financial Account Database Model (PostgreSQL)
Stores institution metadata, balances, and connector states.
"""

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin


class FinancialAccountModel(Base, TimestampMixin):
    __tablename__ = "financial_accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    institution: Mapped[str] = mapped_column(String(128), nullable=False)
    account_name: Mapped[str] = mapped_column(String(256), nullable=False)
    account_number_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    account_type: Mapped[str] = mapped_column(String(64), nullable=False)  # Checking, Savings, Brokerage
    currency: Mapped[str] = mapped_column(String(8), nullable=False)  # USD, GBP, EUR, CNY
    current_balance: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    available_cash: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    investment_value: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    liability_amount: Mapped[float] = mapped_column(Numeric(18, 4), default=0.0, nullable=False)
    connection_status: Mapped[str] = mapped_column(String(64), default="Not Connected", nullable=False)
    data_freshness: Mapped[str] = mapped_column(String(64), default="Never Synced", nullable=False)
    region: Mapped[str] = mapped_column(String(32), default="US", nullable=False)
    connector_id: Mapped[str] = mapped_column(String(64), nullable=False)
