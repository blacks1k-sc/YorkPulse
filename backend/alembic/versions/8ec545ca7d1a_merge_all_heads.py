"""merge_all_heads

Revision ID: 8ec545ca7d1a
Revises: add_last_login_at, h9i0j1k2l3m4, add_residence_chat
Create Date: 2026-03-10 11:03:19.520379

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8ec545ca7d1a"
down_revision: Union[str, Sequence[str], None] = (
    "add_last_login_at",
    "h9i0j1k2l3m4",
    "add_residence_chat",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
