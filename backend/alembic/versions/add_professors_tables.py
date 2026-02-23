"""Add professors and professor_courses tables

Revision ID: h9i0j1k2l3m4
Revises: g8h9i0j1k2l3
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "h9i0j1k2l3m4"
down_revision: Union[str, None] = "g8h9i0j1k2l3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create professors table
    op.create_table(
        "professors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, index=True),
        sa.Column("name_normalized", sa.String(200), nullable=False, unique=True, index=True),
        sa.Column("department", sa.String(200), nullable=True, index=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("york_exclusive", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Create professor_courses join table
    op.create_table(
        "professor_courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("professor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("professors.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("semester", sa.String(20), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("professor_id", "course_id", "semester", "year", "section", name="uq_professor_courses_assignment"),
    )

    # Create indexes
    op.create_index("ix_professor_courses_semester_year", "professor_courses", ["semester", "year"])


def downgrade() -> None:
    op.drop_index("ix_professor_courses_semester_year", table_name="professor_courses")
    op.drop_table("professor_courses")
    op.drop_table("professors")
