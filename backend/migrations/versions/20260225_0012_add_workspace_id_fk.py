"""sessions.workspace_id에 FK 제약조건 추가

고아 workspace_id를 NULL 처리 후 FK 제약조건을 추가합니다.

Revision ID: 0012
Revises: 0011
Create Date: 2026-02-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012"
down_revision: Union[str, Sequence[str], None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 고아 workspace_id NULL 처리 (존재하지 않는 워크스페이스 참조 정리)
    op.execute(
        """
        UPDATE sessions
        SET workspace_id = NULL
        WHERE workspace_id IS NOT NULL
          AND workspace_id NOT IN (SELECT id FROM workspaces)
        """
    )

    # FK 제약조건 추가
    op.create_foreign_key(
        "fk_sessions_workspace_id",
        "sessions",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_sessions_workspace_id", "sessions", type_="foreignkey")
