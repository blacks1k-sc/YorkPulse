"""Add image_url to messages (DM)

Revision ID: add_image_url_dm
Revises: add_image_url_msg
Create Date: 2024-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_image_url_dm"
down_revision: Union[str, None] = "add_image_url_msg"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add image_url column to messages table
    op.add_column(
        "messages",
        sa.Column("image_url", sa.String(500), nullable=True),
    )

    # Make content nullable
    op.alter_column(
        "messages",
        "content",
        existing_type=sa.Text(),
        nullable=True,
    )

    # Add constraint: at least one of content or image_url must be present
    op.create_check_constraint(
        "ck_messages_has_content",
        "messages",
        "content IS NOT NULL OR image_url IS NOT NULL",
    )


def downgrade() -> None:
    # Drop constraint
    op.drop_constraint("ck_messages_has_content", "messages", type_="check")

    # Delete messages that have no text
    op.execute("DELETE FROM messages WHERE content IS NULL")

    # Make content NOT NULL again
    op.alter_column(
        "messages",
        "content",
        existing_type=sa.Text(),
        nullable=False,
    )

    # Drop image_url column
    op.drop_column("messages", "image_url")
