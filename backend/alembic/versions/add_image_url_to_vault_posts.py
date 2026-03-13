"""add_image_url_to_vault_posts

Revision ID: add_vault_image_url
Revises: 8ec545ca7d1a
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_vault_image_url"
down_revision: Union[str, Sequence[str], None] = "8ec545ca7d1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vault_posts",
        sa.Column("image_url", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vault_posts", "image_url")
