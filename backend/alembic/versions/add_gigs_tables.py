"""Add gigs marketplace tables

Revision ID: g8h9i0j1k2l3
Revises: f7g8h9i0j1k2
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "g8h9i0j1k2l3"
down_revision: Union[str, None] = "f7g8h9i0j1k2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    gig_type = postgresql.ENUM(
        "offering", "need_help",
        name="gigtype",
        create_type=False,
    )
    gig_type.create(op.get_bind(), checkfirst=True)

    gig_category = postgresql.ENUM(
        "academic", "moving", "tech_help", "errands", "creative", "other",
        name="gigcategory",
        create_type=False,
    )
    gig_category.create(op.get_bind(), checkfirst=True)

    gig_price_type = postgresql.ENUM(
        "fixed", "hourly", "negotiable",
        name="gigpricetype",
        create_type=False,
    )
    gig_price_type.create(op.get_bind(), checkfirst=True)

    gig_location = postgresql.ENUM(
        "on_campus", "off_campus", "online",
        name="giglocation",
        create_type=False,
    )
    gig_location.create(op.get_bind(), checkfirst=True)

    gig_status = postgresql.ENUM(
        "active", "in_progress", "completed", "cancelled", "expired",
        name="gigstatus",
        create_type=False,
    )
    gig_status.create(op.get_bind(), checkfirst=True)

    gig_response_status = postgresql.ENUM(
        "pending", "accepted", "rejected", "completed",
        name="gigresponsestatus",
        create_type=False,
    )
    gig_response_status.create(op.get_bind(), checkfirst=True)

    gig_transaction_status = postgresql.ENUM(
        "pending", "completed", "disputed",
        name="gigtransactionstatus",
        create_type=False,
    )
    gig_transaction_status.create(op.get_bind(), checkfirst=True)

    # Create gigs table
    op.create_table(
        "gigs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("poster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("gig_type", postgresql.ENUM("offering", "need_help", name="gigtype", create_type=False), nullable=False, index=True),
        sa.Column("category", postgresql.ENUM("academic", "moving", "tech_help", "errands", "creative", "other", name="gigcategory", create_type=False), nullable=False, index=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_max", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_type", postgresql.ENUM("fixed", "hourly", "negotiable", name="gigpricetype", create_type=False), nullable=True),
        sa.Column("location", postgresql.ENUM("on_campus", "off_campus", "online", name="giglocation", create_type=False), nullable=True),
        sa.Column("location_details", sa.String(200), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", postgresql.ENUM("active", "in_progress", "completed", "cancelled", "expired", name="gigstatus", create_type=False), nullable=False, server_default="active", index=True),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    # Create gig_responses table
    op.create_table(
        "gig_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gig_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gigs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("responder_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("proposed_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("status", postgresql.ENUM("pending", "accepted", "rejected", "completed", name="gigresponsestatus", create_type=False), nullable=False, server_default="pending", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("gig_id", "responder_id", name="uq_gig_response_unique"),
    )

    # Create gig_transactions table
    op.create_table(
        "gig_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("gig_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gigs.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("response_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gig_responses.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=False, server_default="etransfer"),
        sa.Column("status", postgresql.ENUM("pending", "completed", "disputed", name="gigtransactionstatus", create_type=False), nullable=False, server_default="pending", index=True),
        sa.Column("provider_confirmed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("client_confirmed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )

    # Create gig_ratings table
    op.create_table(
        "gig_ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gig_transactions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("rater_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ratee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("reliability", sa.Integer(), nullable=False),
        sa.Column("communication", sa.Integer(), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=False),
        sa.Column("review_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("transaction_id", "rater_id", name="uq_gig_rating_unique"),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_rating_range"),
        sa.CheckConstraint("reliability >= 1 AND reliability <= 5", name="ck_reliability_range"),
        sa.CheckConstraint("communication >= 1 AND communication <= 5", name="ck_communication_range"),
        sa.CheckConstraint("quality >= 1 AND quality <= 5", name="ck_quality_range"),
    )

    # Add gig stats columns to users table
    op.add_column("users", sa.Column("gig_rating_avg", sa.Numeric(3, 2), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("gigs_completed", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("total_earned", sa.Numeric(10, 2), nullable=False, server_default="0"))

    # Create indexes
    op.create_index("idx_gigs_type_category_status", "gigs", ["gig_type", "category", "status"])
    op.create_index("idx_gigs_poster_status", "gigs", ["poster_id", "status"])
    op.create_index("idx_gig_responses_gig_status", "gig_responses", ["gig_id", "status"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("idx_gig_responses_gig_status", table_name="gig_responses")
    op.drop_index("idx_gigs_poster_status", table_name="gigs")
    op.drop_index("idx_gigs_type_category_status", table_name="gigs")

    # Drop user columns
    op.drop_column("users", "total_earned")
    op.drop_column("users", "gigs_completed")
    op.drop_column("users", "gig_rating_avg")

    # Drop tables
    op.drop_table("gig_ratings")
    op.drop_table("gig_transactions")
    op.drop_table("gig_responses")
    op.drop_table("gigs")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS gigtransactionstatus")
    op.execute("DROP TYPE IF EXISTS gigresponsestatus")
    op.execute("DROP TYPE IF EXISTS gigstatus")
    op.execute("DROP TYPE IF EXISTS giglocation")
    op.execute("DROP TYPE IF EXISTS gigpricetype")
    op.execute("DROP TYPE IF EXISTS gigcategory")
    op.execute("DROP TYPE IF EXISTS gigtype")
