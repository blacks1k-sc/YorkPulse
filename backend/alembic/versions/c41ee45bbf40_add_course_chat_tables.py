"""add_course_chat_tables

Revision ID: c41ee45bbf40
Revises: b40dd34aae39
Create Date: 2026-02-12 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c41ee45bbf40"
down_revision: Union[str, Sequence[str], None] = "b40dd34aae39"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create channel_type enum
    channel_type_enum = postgresql.ENUM(
        "general",
        "professor",
        name="channeltype",
        create_type=True,
    )
    channel_type_enum.create(op.get_bind(), checkfirst=True)

    # Create courses table
    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("faculty", sa.String(200), nullable=False),
        sa.Column("programs", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("credits", sa.Numeric(5, 2), nullable=True),
        sa.Column("campus", sa.String(50), nullable=True),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("year >= 1 AND year <= 4", name="ck_courses_year_range"),
    )
    op.create_index("ix_courses_code", "courses", ["code"])
    op.create_index("ix_courses_faculty", "courses", ["faculty"])
    op.create_index("ix_courses_year", "courses", ["year"])
    op.create_index("ix_courses_campus", "courses", ["campus"])
    op.create_index("ix_courses_faculty_year", "courses", ["faculty", "year"])

    # Create course_channels table
    op.create_table(
        "course_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "type",
            postgresql.ENUM(
                "general",
                "professor",
                name="channeltype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("prof_name", sa.String(200), nullable=True),
        sa.Column("semester", sa.String(10), nullable=True),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("course_id", "name", name="uq_course_channels_course_name"),
    )
    op.create_index("ix_course_channels_course_id", "course_channels", ["course_id"])

    # Create course_members table
    op.create_table(
        "course_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "course_id", name="uq_course_members_user_course"),
    )
    op.create_index("ix_course_members_user_id", "course_members", ["user_id"])
    op.create_index("ix_course_members_course_id", "course_members", ["course_id"])

    # Create channel_members table
    op.create_table(
        "channel_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "channel_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("course_channels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "channel_id", name="uq_channel_members_user_channel"),
    )
    op.create_index("ix_channel_members_user_id", "channel_members", ["user_id"])
    op.create_index("ix_channel_members_channel_id", "channel_members", ["channel_id"])

    # Create course_messages table
    op.create_table(
        "course_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "channel_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("course_channels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("LENGTH(message) <= 500", name="ck_course_messages_length"),
    )
    op.create_index("ix_course_messages_channel_id", "course_messages", ["channel_id"])
    op.create_index("ix_course_messages_user_id", "course_messages", ["user_id"])
    op.create_index(
        "ix_course_messages_channel_created",
        "course_messages",
        ["channel_id", "created_at"],
    )

    # Create channel_creation_votes table
    op.create_table(
        "channel_creation_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("prof_name_normalized", sa.String(200), nullable=False),
        sa.Column(
            "voter_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("semester", sa.String(10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "course_id",
            "voter_user_id",
            "semester",
            name="uq_channel_votes_user_course_semester",
        ),
    )
    op.create_index("ix_channel_creation_votes_course_id", "channel_creation_votes", ["course_id"])
    op.create_index(
        "ix_channel_creation_votes_voter_user_id",
        "channel_creation_votes",
        ["voter_user_id"],
    )
    op.create_index(
        "ix_channel_votes_course_prof",
        "channel_creation_votes",
        ["course_id", "prof_name_normalized", "semester"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop tables in reverse order (due to foreign keys)
    op.drop_table("channel_creation_votes")
    op.drop_table("course_messages")
    op.drop_table("channel_members")
    op.drop_table("course_members")
    op.drop_table("course_channels")
    op.drop_table("courses")

    # Drop enum
    postgresql.ENUM(name="channeltype").drop(op.get_bind(), checkfirst=True)
