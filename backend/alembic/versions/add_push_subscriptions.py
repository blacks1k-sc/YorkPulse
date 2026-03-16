"""add_push_subscriptions

Revision ID: add_push_subscriptions
Revises: add_vault_image_url
Create Date: 2026-03-15

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "add_push_subscriptions"
down_revision: Union[str, Sequence[str], None] = "add_vault_image_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(500), nullable=False),
        sa.Column("auth", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_push_subs_user_id", "push_subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_push_subs_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
