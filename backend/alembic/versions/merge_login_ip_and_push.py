"""Merge add_last_login_ip and add_push_subscriptions heads

Revision ID: merge_login_ip_and_push
Revises: add_last_login_ip, add_push_subscriptions
Create Date: 2026-03-21
"""
from typing import Sequence, Union
from alembic import op

revision: str = "merge_login_ip_and_push"
down_revision: Union[str, Sequence[str], None] = ("add_last_login_ip", "add_push_subscriptions")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
