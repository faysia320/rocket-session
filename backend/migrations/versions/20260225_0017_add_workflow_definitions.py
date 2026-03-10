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

# 기본 시스템 워크플로우: Research → Implement → QA
DEFAULT_STEPS = [
    {
        "name": "research",
        "label": "Research",
        "icon": "Search",
        "prompt_template": (
            "## 지시사항\n"
            "아래 요청에 대해 코드베이스를 탐색하고, **빠르고 정확한 분석 결과**를 마크다운으로 정리하세요.\n\n"
            "### 핵심 분석 항목\n"
            "- **타겟 파일 및 위치:** 수정이나 추가가 필요한 구체적인 파일과 코드 라인 파악\n"
            "- **에러 원인 / 현재 로직 파악:** 버그인 경우 근본 원인 파악, 기능 추가인 경우 삽입 지점의 컨텍스트 파악\n"
            "- **해결 방향성 요약:** 코드를 어떻게 수정할 것인지에 대한 핵심적인 방향성 (단, 실제 코드는 작성하지 마세요)\n\n"
            "### 금지 사항\n"
            "- **직접적으로 코드를 수정하거나 구현하지 마세요.**\n"
            "- 장황한 아키텍처 분석이나 불필요한 전체 파일 탐색은 생략하고, 요청과 직결된 부분만 분석하세요.\n\n"
            "## 요청\n{user_prompt}"
        ),
        "constraints": "readonly",
        "order_index": 0,
        "review_required": True,
    },
    {
        "name": "implement",
        "label": "Implement",
        "icon": "Code",
        "prompt_template": (
            "## 이전 단계의 분석 결과 (Research Artifact)\n{previous_artifact}\n\n"
            "## 지시사항\n"
            "위 분석 결과와 해결 방향성을 바탕으로 즉시 코드 수정을 진행하세요.\n\n"
            "### 실행 지침\n"
            "- **논스톱 실행:** 사용자에게 추가적인 컨펌을 받지 말고, "
            "작업이 완료될 때까지 구현을 멈추지 마세요.\n"
            "- **자가 수정(Self-Correction):** 구현 후 반드시 빌드 및 린트(Lint)를 "
            "실행하세요. 에러가 발생하면 작업을 중단하지 말고, 에러 로그를 분석하여 "
            "스스로 코드를 수정하세요. (최대 3회 시도)\n\n"
            "### 최종 리포트\n"
            "모든 구현이 완료되면, 다음 내용을 마크다운으로 짧게 보고하세요:\n"
            "- 변경된 파일 목록\n"
            "- 구체적으로 어떤 코드를 어떻게 고쳤는지(또는 추가했는지) 요약\n\n"
            "## 요청\n{user_prompt}"
        ),
        "constraints": "full",
        "order_index": 1,
        "review_required": False,
        "run_validation": False,
    },
    {
        "name": "qa",
        "label": "QA Review",
        "icon": "CheckCircle",
        "prompt_template": (
            "## 구현 결과 (Implement Artifact)\n{previous_artifact}\n\n"
            "## QA 코드 리뷰 지시사항\n"
            "당신은 독립적인 코드 리뷰어입니다. "
            "위 구현 보고서를 **참고만** 하되, 변경된 파일을 직접 읽고 검증하세요.\n\n"
            "### 참고\n"
            "- 빌드 및 테스트 통과 여부는 시스템이 이미 자동으로 검증했습니다.\n"
            "- 당신은 **코드 품질 리뷰**에 집중하세요.\n\n"
            "### 검증 항목\n"
            "변경된 파일을 직접 읽고 다음을 평가하세요:\n"
            "1. **완성도:** Research 분석에서 파악한 문제가 정확히 해결되었는가\n"
            "2. **코드 품질:** 프로젝트의 기존 패턴과 코드 스타일을 따르는가\n"
            "3. **엣지 케이스:** 예외 상황, 경계값, 에러 처리가 적절한가\n"
            "4. **보안:** 하드코딩된 시크릿, SQL 인젝션, XSS 등 보안 취약점이 없는가\n\n"
            "### 출력 형식\n"
            "각 항목을 아래 형식으로 출력:\n"
            "- [PASS] 항목명: 근거 설명\n"
            "- [FAIL] 항목명: 문제점과 수정 제안\n"
            "- [WARN] 항목명: 주의 사항\n\n"
            "### 요약\n"
            "마지막에 전체 결과 요약 (N/M 통과) 및 종합 의견을 작성하세요.\n\n"
            "{user_prompt}"
        ),
        "constraints": "readonly",
        "order_index": 2,
        "review_required": True,
        "run_validation": True,
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

    # 2. 기본 시스템 워크플로우 삽입
    op.execute(
        sa.text(
            """
            INSERT INTO workflow_definitions (id, name, description, is_builtin, steps, created_at, updated_at)
            VALUES (
                'default-workflow',
                'Workflow 1',
                'Research > Implement > QA',
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
