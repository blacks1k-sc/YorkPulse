"""Add image_url to course_messages

Revision ID: add_image_url_msg
Revises: c41ee45bbf40
Create Date: 2024-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_image_url_msg"
down_revision: Union[str, None] = "c41ee45bbf40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add image_url column
    op.add_column(
        "course_messages",
        sa.Column("image_url", sa.String(500), nullable=True),
    )

    # Make message nullable (it was NOT NULL before)
    op.alter_column(
        "course_messages",
        "message",
        existing_type=sa.Text(),
        nullable=True,
    )

    # Drop old constraint
    op.drop_constraint("ck_course_messages_length", "course_messages", type_="check")

    # Add new constraints
    op.create_check_constraint(
        "ck_course_messages_has_content",
        "course_messages",
        "message IS NOT NULL OR image_url IS NOT NULL",
    )
    op.create_check_constraint(
        "ck_course_messages_length",
        "course_messages",
        "message IS NULL OR LENGTH(message) <= 500",
    )


def downgrade() -> None:
    # Drop new constraints
    op.drop_constraint("ck_course_messages_has_content", "course_messages", type_="check")
    op.drop_constraint("ck_course_messages_length", "course_messages", type_="check")

    # Delete messages that have no text (image-only messages)
    op.execute("DELETE FROM course_messages WHERE message IS NULL")

    # Make message NOT NULL again
    op.alter_column(
        "course_messages",
        "message",
        existing_type=sa.Text(),
        nullable=False,
    )

    # Restore old constraint
    op.create_check_constraint(
        "ck_course_messages_length",
        "course_messages",
        "LENGTH(message) <= 500",
    )

    # Drop image_url column
    op.drop_column("course_messages", "image_url")
