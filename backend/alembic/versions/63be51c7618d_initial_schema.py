"""initial_schema

Revision ID: 63be51c7618d
Revises:
Create Date: 2026-01-31 23:08:08.645976

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "63be51c7618d"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables for YorkPulse."""

    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, default=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_verified", sa.Boolean(), nullable=False, default=False),
        sa.Column("program", sa.String(200), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("campus_days", postgresql.ARRAY(sa.String(20)), nullable=True),
        sa.Column("interests", postgresql.ARRAY(sa.String(50)), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("is_banned", sa.Boolean(), nullable=False, default=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Vault posts table
    op.create_table(
        "vault_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "mental_health",
                "academics",
                "social",
                "safety",
                "housing",
                "general",
                name="vaultcategory",
            ),
            nullable=False,
            index=True,
        ),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            sa.Enum("active", "hidden", "deleted", name="vaultpoststatus"),
            nullable=False,
            default="active",
        ),
        sa.Column("flag_count", sa.Integer(), nullable=False, default=0),
        sa.Column("comment_count", sa.Integer(), nullable=False, default=0),
        sa.Column("upvote_count", sa.Integer(), nullable=False, default=0),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Vault comments table
    op.create_table(
        "vault_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vault_posts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vault_comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("flag_count", sa.Integer(), nullable=False, default=0),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, default=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Marketplace listings table
    op.create_table(
        "marketplace_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_negotiable", sa.Boolean(), nullable=False, default=False),
        sa.Column(
            "category",
            sa.Enum(
                "textbooks",
                "electronics",
                "services",
                "housing",
                "tickets",
                "clothing",
                "furniture",
                "other",
                name="marketplacecategory",
            ),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "condition",
            sa.Enum(
                "new", "like_new", "good", "fair", "poor", name="listingcondition"
            ),
            nullable=True,
        ),
        sa.Column("course_codes", postgresql.ARRAY(sa.String(20)), nullable=True),
        sa.Column("images", postgresql.ARRAY(sa.String(500)), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "sold", "reserved", "deleted", name="listingstatus"),
            nullable=False,
            default="active",
            index=True,
        ),
        sa.Column("preferred_meetup_location", sa.String(200), nullable=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("view_count", sa.Integer(), nullable=False, default=0),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Buddy requests table (Side Quests)
    op.create_table(
        "buddy_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "category",
            sa.Enum(
                "gym", "food", "game", "commute", "study", "custom", name="buddycategory"
            ),
            nullable=False,
            index=True,
        ),
        sa.Column("custom_category", sa.String(50), nullable=True),
        sa.Column("activity", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "scheduled_at", sa.DateTime(timezone=True), nullable=False, index=True
        ),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("max_participants", sa.Integer(), nullable=False, default=2),
        sa.Column("current_participants", sa.Integer(), nullable=False, default=1),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "status",
            sa.Enum(
                "open", "full", "completed", "cancelled", name="buddyrequeststatus"
            ),
            nullable=False,
            default="open",
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Buddy participants table
    op.create_table(
        "buddy_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "buddy_request_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("buddy_requests.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending", "accepted", "rejected", "cancelled", name="participantstatus"
            ),
            nullable=False,
            default="pending",
        ),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Conversations table
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user1_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user2_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "active", "blocked", name="conversationstatus"),
            nullable=False,
            default="pending",
        ),
        sa.Column(
            "initiated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("blocked_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("context_type", sa.String(50), nullable=True),
        sa.Column("context_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_conversations_users",
        "conversations",
        ["user1_id", "user2_id"],
        unique=True,
    )

    # Messages table
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, default=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # Reviews table
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "reviewer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reviewed_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "review_type",
            sa.Enum("marketplace", "buddy", name="reviewtype"),
            nullable=False,
        ),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="check_rating_range"),
        sa.CheckConstraint("reviewer_id != reviewed_id", name="check_no_self_review"),
    )
    op.create_index(
        "ix_reviews_unique_transaction",
        "reviews",
        ["reviewer_id", "reviewed_id", "review_type", "reference_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table("reviews")
    op.drop_table("messages")
    op.drop_index("ix_conversations_users", table_name="conversations")
    op.drop_table("conversations")
    op.drop_table("buddy_participants")
    op.drop_table("buddy_requests")
    op.drop_table("marketplace_listings")
    op.drop_table("vault_comments")
    op.drop_table("vault_posts")
    op.drop_table("users")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS reviewtype")
    op.execute("DROP TYPE IF EXISTS conversationstatus")
    op.execute("DROP TYPE IF EXISTS participantstatus")
    op.execute("DROP TYPE IF EXISTS buddyrequeststatus")
    op.execute("DROP TYPE IF EXISTS buddycategory")
    op.execute("DROP TYPE IF EXISTS listingstatus")
    op.execute("DROP TYPE IF EXISTS listingcondition")
    op.execute("DROP TYPE IF EXISTS marketplacecategory")
    op.execute("DROP TYPE IF EXISTS vaultpoststatus")
    op.execute("DROP TYPE IF EXISTS vaultcategory")
