"""mcp_servers에 docker_service_name 컬럼 추가

Docker 컨테이너 내부에서 MCP 서버에 접근할 때
localhost 대신 Docker 서비스명으로 라우팅하기 위한 필드.

Revision ID: 0032
Revises: 0031
Create Date: 2026-03-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mcp_servers",
        sa.Column("docker_service_name", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mcp_servers", "docker_service_name")
