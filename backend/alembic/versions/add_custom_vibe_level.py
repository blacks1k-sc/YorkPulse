"""Add custom_vibe_level to buddy_requests

Revision ID: d5e6f7g8h9i0
Revises: c41ee45bbf40
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d5e6f7g8h9i0"
down_revision = "c41ee45bbf40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'custom' value to vibelevel enum
    op.execute("ALTER TYPE vibelevel ADD VALUE IF NOT EXISTS 'custom'")

    # Add custom_vibe_level column to buddy_requests
    op.add_column(
        "buddy_requests",
        sa.Column("custom_vibe_level", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("buddy_requests", "custom_vibe_level")
    # Note: PostgreSQL doesn't support removing enum values easily
    # The 'custom' enum value will remain in the type
