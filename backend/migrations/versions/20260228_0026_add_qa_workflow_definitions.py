"""QA 워크플로우 추가 — 4단계 Research > Plan > Implement > QA Review

기존 3단계 워크플로우를 변경하지 않고, QA 검증 단계가 포함된
새로운 시스템 워크플로우 "Workflow 4"를 추가합니다.

Revision ID: 0026
Revises: 0025b
Create Date: 2026-02-28
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

QA_WORKFLOW = {
    "id": "system-workflow-4",
    "name": "Workflow 4",
    "description": "검증: 구현 후 QA 자동 검증 (Research > Plan > Implement > QA Review)",
    "sort_order": 4,
    "steps": [
        {
            "name": "research",
            "label": "Research",
            "icon": "Search",
            "prompt_template": (
                "## 지시사항\n"
                "아래 요청에 대해 코드베이스를 깊이 탐색하고 **분석 결과만** 마크다운으로 정리하세요.\n\n"
                "### 분석 항목\n"
                "- **관련 파일 및 함수 목록**\n"
                "- **동작 방식 및 데이터 흐름**\n"
                "- **아키텍처 및 환경**\n"
                "- **잠재적 사이드 이펙트 및 파급 범위**\n"
                "- **제약사항 및 엣지 케이스**\n\n"
                "### 금지 사항\n"
                "- 구현 계획, 변경 제안, 해결 방안을 절대 작성하지 마세요.\n"
                "- 어떠한 코드도 수정하거나 구현하지 마세요.\n\n"
                "## 요청\n{user_prompt}"
            ),
            "constraints": "readonly",
            "order_index": 0,
            "review_required": False,
        },
        {
            "name": "plan",
            "label": "Plan",
            "icon": "FileText",
            "prompt_template": (
                "## 이전 단계의 분석 결과 (Research Artifact)\n{previous_artifact}\n\n"
                "## 지시사항\n"
                "위 분석 결과를 바탕으로 상세한 구현 계획을 마크다운으로 작성하세요.\n\n"
                "### 포함할 내용\n"
                "- 변경할 파일 목록 및 구체적인 코드 변경 내용\n"
                "- 작업 순서(Step-by-step)\n"
                "- 테스트 및 검증 전략\n"
                "- 예상되는 리스크 및 대안\n\n"
                "### 금지 사항\n"
                "- 아직 실제 코드를 수정하거나 구현하지 마세요.\n\n"
                "## 요청\n{user_prompt}"
            ),
            "constraints": "readonly",
            "order_index": 1,
            "review_required": True,
        },
        {
            "name": "implement",
            "label": "Implement",
            "icon": "Code",
            "prompt_template": (
                "## 확정된 구현 계획 (Plan Artifact)\n{previous_artifact}\n\n"
                "## 지시사항\n"
                "위 확정된 계획에 따라 실제 코드 구현을 시작하세요.\n\n"
                "### 실행 지침\n"
                "- 원자적(Atomic) 작업 진행\n"
                "- 모든 구현 단계가 완료될 때까지 작업을 멈추지 마세요\n"
                "- 에러 발생 시 자가 수정\n"
                "- 최종 빌드/린트 검증\n\n"
                "### 최종 리포트\n"
                "변경 파일 목록, 주요 변경 사항, 검증 결과를 요약하세요.\n\n"
                "## 요청\n{user_prompt}"
            ),
            "constraints": "full",
            "order_index": 2,
            "review_required": False,
        },
        {
            "name": "qa",
            "label": "QA Review",
            "icon": "CheckCircle",
            "prompt_template": (
                "## 구현 결과 (Implement Artifact)\n{previous_artifact}\n\n"
                "## QA 검증 지시사항\n"
                "위 구현 결과를 다음 기준으로 검증하고, "
                "각 항목에 **PASS/FAIL/WARN** + 근거를 체크리스트로 출력하세요.\n\n"
                "### 검증 항목\n"
                "1. Plan의 모든 변경사항이 구현되었는가\n"
                "2. 빌드/컴파일 에러가 없는가\n"
                "3. 기존 테스트가 통과하는가\n"
                "4. 코드 스타일(lint)을 준수하는가\n"
                "5. 엣지 케이스가 처리되었는가\n"
                "6. 보안 취약점이 없는가\n\n"
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
            "order_index": 3,
            "review_required": True,
        },
    ],
}


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO workflow_definitions
                (id, name, description, is_builtin, is_default, sort_order, steps, created_at, updated_at)
            VALUES
                (:id, :name, :description, true, false, :sort_order, :steps, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET
                is_builtin = true,
                sort_order = :sort_order,
                steps = :steps
            """
        ).bindparams(
            id=QA_WORKFLOW["id"],
            name=QA_WORKFLOW["name"],
            description=QA_WORKFLOW["description"],
            sort_order=QA_WORKFLOW["sort_order"],
            steps=json.dumps(QA_WORKFLOW["steps"]),
        )
    )


def downgrade() -> None:
    op.execute(
        "UPDATE workflow_definitions SET is_builtin = false, sort_order = 0 "
        "WHERE name = 'Workflow 4'"
    )
