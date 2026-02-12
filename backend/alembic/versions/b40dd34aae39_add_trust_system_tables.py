"""add_trust_system_tables

Revision ID: b40dd34aae39
Revises: b2c3d4e5f6g7
Create Date: 2026-02-11 18:47:14.792679

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b40dd34aae39"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6g7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new columns to users table
    op.add_column(
        "users",
        sa.Column("completed_transactions", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Create marketplace_transactions table
    op.create_table(
        "marketplace_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "listing_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("marketplace_listings.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "seller_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "buyer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("final_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("seller_confirmed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("buyer_confirmed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint("seller_id != buyer_id", name="check_different_parties"),
    )

    # Create marketplace_reviews table
    op.create_table(
        "marketplace_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "transaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("marketplace_transactions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reviewer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reviewee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("item_accuracy", sa.Integer(), nullable=False),
        sa.Column("communication", sa.Integer(), nullable=False),
        sa.Column("punctuality", sa.Integer(), nullable=False),
        sa.Column("text_feedback", sa.Text(), nullable=True),
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
        sa.UniqueConstraint("transaction_id", "reviewer_id", name="uq_transaction_reviewer"),
        sa.CheckConstraint("item_accuracy >= 1 AND item_accuracy <= 5", name="check_item_accuracy_range"),
        sa.CheckConstraint("communication >= 1 AND communication <= 5", name="check_communication_range"),
        sa.CheckConstraint("punctuality >= 1 AND punctuality <= 5", name="check_punctuality_range"),
        sa.CheckConstraint("reviewer_id != reviewee_id", name="check_no_self_marketplace_review"),
    )

    # Create report reason enum
    report_reason_enum = postgresql.ENUM(
        "harassment_safety",
        "scam_fraud",
        "no_show_pattern",
        "spam_bot",
        "other",
        name="reportreason",
        create_type=True,
    )
    report_reason_enum.create(op.get_bind(), checkfirst=True)

    # Create report status enum
    report_status_enum = postgresql.ENUM(
        "pending",
        "under_review",
        "resolved",
        "dismissed",
        name="reportstatus",
        create_type=True,
    )
    report_status_enum.create(op.get_bind(), checkfirst=True)

    # Create user_reports table
    op.create_table(
        "user_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "reporter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reported_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reason",
            postgresql.ENUM(
                "harassment_safety",
                "scam_fraud",
                "no_show_pattern",
                "spam_bot",
                "other",
                name="reportreason",
                create_type=False,
            ),
            nullable=False,
            index=True,
        ),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "under_review",
                "resolved",
                "dismissed",
                name="reportstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
            index=True,
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "resolved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
        sa.CheckConstraint("reporter_id != reported_user_id", name="check_no_self_report"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop tables
    op.drop_table("user_reports")
    op.drop_table("marketplace_reviews")
    op.drop_table("marketplace_transactions")

    # Drop enums
    postgresql.ENUM(name="reportstatus").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="reportreason").drop(op.get_bind(), checkfirst=True)

    # Remove columns from users
    op.drop_column("users", "is_admin")
    op.drop_column("users", "completed_transactions")
