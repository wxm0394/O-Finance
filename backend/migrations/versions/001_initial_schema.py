"""initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-11-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. financial_accounts
    op.create_table(
        'financial_accounts',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('institution', sa.String(length=128), nullable=False),
        sa.Column('account_name', sa.String(length=256), nullable=False),
        sa.Column('account_number_masked', sa.String(length=64), nullable=False),
        sa.Column('account_type', sa.String(length=64), nullable=False),
        sa.Column('currency', sa.String(length=8), nullable=False),
        sa.Column('current_balance', sa.Numeric(precision=18, scale=4), nullable=False, server_default='0.0'),
        sa.Column('available_cash', sa.Numeric(precision=18, scale=4), nullable=False, server_default='0.0'),
        sa.Column('investment_value', sa.Numeric(precision=18, scale=4), nullable=False, server_default='0.0'),
        sa.Column('liability_amount', sa.Numeric(precision=18, scale=4), nullable=False, server_default='0.0'),
        sa.Column('connection_status', sa.String(length=64), nullable=False, server_default='Not Connected'),
        sa.Column('data_freshness', sa.String(length=64), nullable=False, server_default='Never Synced'),
        sa.Column('region', sa.String(length=32), nullable=False, server_default='US'),
        sa.Column('connector_id', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. transaction_records
    op.create_table(
        'transaction_records',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('account_id', sa.String(length=64), nullable=False),
        sa.Column('date', sa.String(length=16), nullable=False),
        sa.Column('type', sa.String(length=32), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('description', sa.String(length=512), nullable=False),
        sa.Column('payee', sa.String(length=256), nullable=False),
        sa.Column('amount', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('currency', sa.String(length=8), nullable=False),
        sa.Column('ledger_status', sa.String(length=64), nullable=False, server_default='Draft'),
        sa.Column('transfer_pair_id', sa.String(length=64), nullable=True),
        sa.Column('raw_payload_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_transaction_records_account_id', 'transaction_records', ['account_id'])
    op.create_index('ix_transaction_records_date', 'transaction_records', ['date'])

    # 3. approval_tasks
    op.create_table(
        'approval_tasks',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('task_mode', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=256), nullable=False),
        sa.Column('proposed_action', sa.Text(), nullable=False),
        sa.Column('risk_level', sa.String(length=16), nullable=False),
        sa.Column('confidence', sa.Numeric(precision=5, scale=4), nullable=False, server_default='0.80'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='Pending'),
        sa.Column('decision_reason', sa.Text(), nullable=True),
        sa.Column('actor', sa.String(length=64), nullable=False, server_default='Local Operator'),
        sa.Column('payload_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('actor', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=256), nullable=False),
        sa.Column('target', sa.String(length=256), nullable=False),
        sa.Column('severity', sa.String(length=16), nullable=False, server_default='INFO'),
        sa.Column('verification_hash', sa.String(length=64), nullable=False),
        sa.Column('prev_hash', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('details_json', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('approval_tasks')
    op.drop_index('ix_transaction_records_date', table_name='transaction_records')
    op.drop_index('ix_transaction_records_account_id', table_name='transaction_records')
    op.drop_table('transaction_records')
    op.drop_table('financial_accounts')
