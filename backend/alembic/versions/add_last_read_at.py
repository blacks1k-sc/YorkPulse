"""Add last_read_at to channel_members

Revision ID: add_last_read_at
Revises: add_image_url_dm
Create Date: 2024-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_last_read_at"
down_revision: Union[str, None] = "add_image_url_dm"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "channel_members",
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("channel_members", "last_read_at")
