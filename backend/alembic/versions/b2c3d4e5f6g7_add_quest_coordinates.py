"""add_quest_coordinates

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-01 14:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add latitude and longitude fields for map coordinates."""

    # Add latitude column
    op.add_column(
        "buddy_requests",
        sa.Column("latitude", sa.Float(), nullable=True),
    )

    # Add longitude column
    op.add_column(
        "buddy_requests",
        sa.Column("longitude", sa.Float(), nullable=True),
    )

    # Add index for geospatial queries
    op.create_index(
        "ix_buddy_requests_latitude",
        "buddy_requests",
        ["latitude"],
        unique=False,
    )
    op.create_index(
        "ix_buddy_requests_longitude",
        "buddy_requests",
        ["longitude"],
        unique=False,
    )


def downgrade() -> None:
    """Remove latitude and longitude fields."""

    # Drop indexes
    op.drop_index("ix_buddy_requests_longitude", table_name="buddy_requests")
    op.drop_index("ix_buddy_requests_latitude", table_name="buddy_requests")

    # Drop columns
    op.drop_column("buddy_requests", "longitude")
    op.drop_column("buddy_requests", "latitude")
