"""(정리됨) 원래 Workflow 통합 (Plan 제거 + WF 병합) — 현재 불필요

Revision ID: 0031
Revises: 73480a682def
Create Date: 2026-03-09
"""

from typing import Sequence, Union

revision: str = "0031"
down_revision: Union[str, None] = "73480a682def"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
