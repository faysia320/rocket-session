"""(정리됨) 원래 WF1/WF2에 QA 단계 추가 및 WF4 삭제 — 현재 불필요

Revision ID: 0028
Revises: 0027
Create Date: 2026-03-02
"""

from typing import Sequence, Union

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
