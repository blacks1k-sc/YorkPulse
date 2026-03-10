"""add_residence_chat_tables

Revision ID: add_residence_chat
Revises: grant_founder_all
Create Date: 2026-03-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_residence_chat"
down_revision: Union[str, Sequence[str], None] = "grant_founder_all"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create residence chat tables."""

    # residences
    op.create_table(
        "residences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("campus", sa.String(50), nullable=False),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_residences_name", "residences", ["name"])
    op.create_index("ix_residences_campus", "residences", ["campus"])

    # residence_channels
    op.create_table(
        "residence_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("residence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("residences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False, server_default="general"),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("residence_id", "name", name="uq_residence_channels_residence_name"),
    )
    op.create_index("ix_residence_channels_residence_id", "residence_channels", ["residence_id"])

    # residence_members
    op.create_table(
        "residence_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("residence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("residences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "residence_id", name="uq_residence_members_user_residence"),
    )
    op.create_index("ix_residence_members_user_id", "residence_members", ["user_id"])
    op.create_index("ix_residence_members_residence_id", "residence_members", ["residence_id"])

    # residence_channel_members (for unread tracking)
    op.create_table(
        "residence_channel_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("residence_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "channel_id", name="uq_residence_channel_members_user_channel"),
    )
    op.create_index("ix_residence_channel_members_user_id", "residence_channel_members", ["user_id"])
    op.create_index("ix_residence_channel_members_channel_id", "residence_channel_members", ["channel_id"])

    # residence_messages
    op.create_table(
        "residence_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("residence_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("reply_to_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("residence_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("message IS NOT NULL OR image_url IS NOT NULL", name="ck_residence_messages_content"),
        sa.CheckConstraint("message IS NULL OR LENGTH(message) <= 500", name="ck_residence_messages_length"),
    )
    op.create_index("ix_residence_messages_channel_created", "residence_messages", ["channel_id", "created_at"])


def downgrade() -> None:
    """Drop residence chat tables."""
    op.drop_table("residence_messages")
    op.drop_table("residence_channel_members")
    op.drop_table("residence_members")
    op.drop_table("residence_channels")
    op.drop_table("residences")
