"""Add user_feedback table

Revision ID: add_user_feedback
Revises: add_last_read_at
Create Date: 2024-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "add_user_feedback"
down_revision: Union[str, None] = "add_last_read_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create feedback type enum
    feedback_type = postgresql.ENUM(
        "suggestion", "bug", "problem", "other",
        name="feedbacktype",
        create_type=False,
    )
    feedback_type.create(op.get_bind(), checkfirst=True)

    # Create feedback status enum
    feedback_status = postgresql.ENUM(
        "pending", "reviewed", "in_progress", "resolved", "dismissed",
        name="feedbackstatus",
        create_type=False,
    )
    feedback_status.create(op.get_bind(), checkfirst=True)

    # Create user_feedback table
    op.create_table(
        "user_feedback",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.Enum("suggestion", "bug", "problem", "other", name="feedbacktype"), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.Enum("pending", "reviewed", "in_progress", "resolved", "dismissed", name="feedbackstatus"), nullable=False, server_default="pending"),
        sa.Column("admin_response", sa.Text(), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_feedback_user_id", "user_feedback", ["user_id"])
    op.create_index("ix_user_feedback_type", "user_feedback", ["type"])
    op.create_index("ix_user_feedback_status", "user_feedback", ["status"])


def downgrade() -> None:
    op.drop_index("ix_user_feedback_status", table_name="user_feedback")
    op.drop_index("ix_user_feedback_type", table_name="user_feedback")
    op.drop_index("ix_user_feedback_user_id", table_name="user_feedback")
    op.drop_table("user_feedback")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS feedbackstatus")
    op.execute("DROP TYPE IF EXISTS feedbacktype")
