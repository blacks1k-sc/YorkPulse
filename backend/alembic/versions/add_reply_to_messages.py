"""Add reply_to_id to message tables and create quest_messages table

Revision ID: e6f7g8h9i0j1
Revises: d5e6f7g8h9i0
Create Date: 2026-02-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "e6f7g8h9i0j1"
down_revision = "d5e6f7g8h9i0"
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    conn = op.get_bind()
    inspector = inspect(conn)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    # Add reply_to_id to course_messages (if table exists)
    if table_exists("course_messages"):
        op.add_column(
            "course_messages",
            sa.Column("reply_to_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_index(
            "ix_course_messages_reply_to_id",
            "course_messages",
            ["reply_to_id"],
        )
        op.create_foreign_key(
            "fk_course_messages_reply_to_id",
            "course_messages",
            "course_messages",
            ["reply_to_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # Create quest_messages table if it doesn't exist
    if not table_exists("quest_messages"):
        op.create_table(
            "quest_messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("quest_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("buddy_requests.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("reply_to_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
            sa.Column("is_deleted", sa.Boolean(), default=False, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        )
        # Add self-referencing FK for reply_to_id
        op.create_foreign_key(
            "fk_quest_messages_reply_to_id",
            "quest_messages",
            "quest_messages",
            ["reply_to_id"],
            ["id"],
            ondelete="SET NULL",
        )
    else:
        # Table exists, just add the reply_to_id column
        op.add_column(
            "quest_messages",
            sa.Column("reply_to_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_index(
            "ix_quest_messages_reply_to_id",
            "quest_messages",
            ["reply_to_id"],
        )
        op.create_foreign_key(
            "fk_quest_messages_reply_to_id",
            "quest_messages",
            "quest_messages",
            ["reply_to_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # Add reply_to_id to messages (DM)
    if table_exists("messages"):
        op.add_column(
            "messages",
            sa.Column("reply_to_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_index(
            "ix_messages_reply_to_id",
            "messages",
            ["reply_to_id"],
        )
        op.create_foreign_key(
            "fk_messages_reply_to_id",
            "messages",
            "messages",
            ["reply_to_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    # Remove from messages (DM)
    if table_exists("messages"):
        op.drop_constraint("fk_messages_reply_to_id", "messages", type_="foreignkey")
        op.drop_index("ix_messages_reply_to_id", table_name="messages")
        op.drop_column("messages", "reply_to_id")

    # Drop quest_messages table (we created it in this migration)
    if table_exists("quest_messages"):
        op.drop_table("quest_messages")

    # Remove from course_messages
    if table_exists("course_messages"):
        op.drop_constraint("fk_course_messages_reply_to_id", "course_messages", type_="foreignkey")
        op.drop_index("ix_course_messages_reply_to_id", table_name="course_messages")
        op.drop_column("course_messages", "reply_to_id")
