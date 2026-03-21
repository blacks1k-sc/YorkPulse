"""Add signup_attempts table for forensic IP tracking

Revision ID: add_signup_attempts
Revises: merge_login_ip_and_push
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'add_signup_attempts'
down_revision = 'merge_login_ip_and_push'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'signup_attempts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('attempted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('was_blocked', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('ix_signup_attempts_email', 'signup_attempts', ['email'])
    op.create_index('ix_signup_attempts_ip_address', 'signup_attempts', ['ip_address'])
    op.create_index('ix_signup_attempts_attempted_at', 'signup_attempts', ['attempted_at'])


def downgrade() -> None:
    op.drop_table('signup_attempts')
