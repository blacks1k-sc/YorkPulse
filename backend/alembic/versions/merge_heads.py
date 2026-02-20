"""Merge multiple heads

Revision ID: f7g8h9i0j1k2
Revises: e6f7g8h9i0j1, add_user_feedback
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7g8h9i0j1k2"
down_revision: Union[str, Sequence[str], None] = ("e6f7g8h9i0j1", "add_user_feedback")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
