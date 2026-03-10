"""(정리됨) 원래 Workflow 4 추가 — 현재 불필요

Revision ID: 0026
Revises: 0025b
Create Date: 2026-02-28
"""

from typing import Sequence, Union

revision: str = "0026"
down_revision: Union[str, None] = "0025b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
