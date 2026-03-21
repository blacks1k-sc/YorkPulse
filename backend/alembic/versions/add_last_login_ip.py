"""Add last_login_ip to users

Revision ID: add_last_login_ip
Revises: merge_heads
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_last_login_ip'
down_revision = 'merge_heads'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('users', sa.Column('last_login_ip', sa.String(45), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'last_login_ip')
