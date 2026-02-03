"""add_side_quest_fields

Revision ID: a1b2c3d4e5f6
Revises: 63be51c7618d
Create Date: 2026-02-01 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "63be51c7618d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new fields for Side Quests feature."""

    # Create VibeLevel enum type
    op.execute(
        "CREATE TYPE vibelevel AS ENUM ('chill', 'intermediate', 'high_energy', 'intense')"
    )

    # Rename scheduled_at to start_time
    op.alter_column(
        "buddy_requests",
        "scheduled_at",
        new_column_name="start_time",
    )

    # Add end_time column
    op.add_column(
        "buddy_requests",
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
    )

    # Add vibe_level column
    op.add_column(
        "buddy_requests",
        sa.Column(
            "vibe_level",
            sa.Enum("chill", "intermediate", "high_energy", "intense", name="vibelevel"),
            nullable=False,
            server_default="chill",
        ),
    )

    # Update buddyrequeststatus enum to include 'in_progress'
    # First, create a new enum type with the new value
    op.execute("ALTER TYPE buddyrequeststatus RENAME TO buddyrequeststatus_old")
    op.execute(
        "CREATE TYPE buddyrequeststatus AS ENUM ('open', 'in_progress', 'full', 'completed', 'cancelled')"
    )
    op.execute(
        """
        ALTER TABLE buddy_requests
        ALTER COLUMN status TYPE buddyrequeststatus
        USING status::text::buddyrequeststatus
        """
    )
    op.execute("DROP TYPE buddyrequeststatus_old")


def downgrade() -> None:
    """Revert Side Quests schema changes."""

    # Revert buddyrequeststatus enum
    op.execute("ALTER TYPE buddyrequeststatus RENAME TO buddyrequeststatus_old")
    op.execute(
        "CREATE TYPE buddyrequeststatus AS ENUM ('open', 'full', 'completed', 'cancelled')"
    )
    op.execute(
        """
        UPDATE buddy_requests SET status = 'open' WHERE status = 'in_progress'
        """
    )
    op.execute(
        """
        ALTER TABLE buddy_requests
        ALTER COLUMN status TYPE buddyrequeststatus
        USING status::text::buddyrequeststatus
        """
    )
    op.execute("DROP TYPE buddyrequeststatus_old")

    # Drop vibe_level column
    op.drop_column("buddy_requests", "vibe_level")
    op.execute("DROP TYPE vibelevel")

    # Drop end_time column
    op.drop_column("buddy_requests", "end_time")

    # Rename start_time back to scheduled_at
    op.alter_column(
        "buddy_requests",
        "start_time",
        new_column_name="scheduled_at",
    )
