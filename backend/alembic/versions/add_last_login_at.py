"""Add last_login_at to users

Revision ID: add_last_login_at
Revises: drop_professor_tables
Create Date: 2026-03-08

"""
from alembic import op
import sqlalchemy as sa

revision = "add_last_login_at"
down_revision = "drop_professor_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
