"""grant founder badge to all existing users

Revision ID: grant_founder_all
Revises: add_founder_badge
Create Date: 2026-03-06
"""

from alembic import op

revision = "grant_founder_all"
down_revision = "add_founder_badge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET is_founder = true")


def downgrade() -> None:
    op.execute("UPDATE users SET is_founder = false")
