"""workflow_definitions 테이블 추가 — 커스터마이징 가능한 워크플로우 단계 정의

Revision ID: 0017
Revises: 0016
Create Date: 2026-02-25
"""

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 기존 하드코딩된 프롬프트를 그대로 기본 프리셋으로 저장
DEFAULT_STEPS = [
    {
        "name": "research",
        "label": "Research",
        "icon": "Search",
        "prompt_template": (
            "## 지시사항\n"
            "아래 요청에 대해 코드베이스를 깊이 탐색하고 **분석 결과만** 마크다운으로 정리하세요.\n\n"
            "### 분석 항목\n"
            "- 관련 파일 및 함수 목록\n"
            "- 현재 코드의 동작 방식과 데이터 흐름\n"
            "- 아키텍처 패턴 및 의존성 관계\n"
            "- 현재 구현의 제약사항이나 주의점\n\n"
            "### 금지 사항\n"
            "- **구현 계획, 변경 제안, 해결 방안을 작성하지 마세요.**\n"
            "- **코드를 수정하거나 구현하지 마세요.**\n"
            "- 계획 작성은 다음 단계(Plan)에서 별도로 수행됩니다.\n"
            "- 이 단계에서는 현재 상태의 분석과 발견 사항만 보고하세요.\n\n"
            "## 요청\n{user_prompt}"
        ),
        "constraints": "readonly",
        "auto_advance": True,
        "review_required": False,
        "order_index": 0,
    },
    {
        "name": "plan",
        "label": "Plan",
        "icon": "FileText",
        "prompt_template": (
            "{previous_artifact}\n\n"
            "## 지시사항\n"
            "위 연구 결과를 바탕으로 상세한 구현 계획을 마크다운으로 작성하세요.\n"
            "변경할 파일, 구체적인 코드 변경 내용, 순서를 명시하세요.\n"
            "**중요: 아직 코드를 수정하거나 구현하지 마세요.**\n\n"
            "## 요청\n{user_prompt}"
        ),
        "constraints": "readonly",
        "auto_advance": False,
        "review_required": True,
        "order_index": 1,
    },
    {
        "name": "implement",
        "label": "Implement",
        "icon": "Code",
        "prompt_template": (
            "{previous_artifact}\n\n"
            "## 지시사항\n"
            "위 계획에 따라 구현하세요. 모든 단계가 완료될 때까지 멈추지 마세요.\n"
            "구현 후 빌드/린트 검증까지 수행하세요.\n\n"
            "## 요청\n{user_prompt}"
        ),
        "constraints": "full",
        "auto_advance": False,
        "review_required": False,
        "order_index": 2,
    },
]


def upgrade() -> None:
    # 1. workflow_definitions 테이블 생성
    op.create_table(
        "workflow_definitions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("steps", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # 2. 기본 프리셋 삽입
    op.execute(
        sa.text(
            """
            INSERT INTO workflow_definitions (id, name, description, is_builtin, steps, created_at, updated_at)
            VALUES (
                'default-workflow',
                'Default (Research → Plan → Implement)',
                '기본 3단계 워크플로우: 코드 분석 → 구현 계획 → 실제 구현',
                true,
                :steps,
                NOW(),
                NOW()
            )
            """
        ).bindparams(steps=json.dumps(DEFAULT_STEPS))
    )

    # 3. sessions 테이블에 FK 추가
    op.add_column(
        "sessions",
        sa.Column(
            "workflow_definition_id",
            sa.String(),
            sa.ForeignKey("workflow_definitions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 4. session_templates 테이블에 FK 추가
    op.add_column(
        "session_templates",
        sa.Column(
            "workflow_definition_id",
            sa.String(),
            sa.ForeignKey("workflow_definitions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 5. 기존 workflow_enabled=true 세션에 기본 프리셋 연결
    op.execute(
        """
        UPDATE sessions
        SET workflow_definition_id = 'default-workflow'
        WHERE workflow_enabled = true
        """
    )


def downgrade() -> None:
    op.drop_column("session_templates", "workflow_definition_id")
    op.drop_column("sessions", "workflow_definition_id")
    op.drop_table("workflow_definitions")
