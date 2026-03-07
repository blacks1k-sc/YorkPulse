"""Drop professors and professor_courses tables

Revision ID: drop_professor_tables
Revises: grant_founder_all
Create Date: 2026-03-07

"""

from alembic import op

revision = "drop_professor_tables"
down_revision = "grant_founder_all"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS professor_courses CASCADE")
    op.execute("DROP TABLE IF EXISTS professors CASCADE")


def downgrade() -> None:
    pass
