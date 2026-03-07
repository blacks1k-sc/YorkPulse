"""add founder badge to users

Revision ID: add_founder_badge
Revises: merge_heads
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa

revision = "add_founder_badge"
down_revision = "f7g8h9i0j1k2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_founder", sa.Boolean(), nullable=False, server_default="false"),
    )
    # Grant the badge to the founding user only
    op.execute("UPDATE users SET is_founder = true WHERE email = 'nrup1618@my.yorku.ca'")


def downgrade() -> None:
    op.drop_column("users", "is_founder")
