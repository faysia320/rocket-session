"""시스템 워크플로우 추가 — sort_order 컬럼 및 Workflow 1~3 시드

sort_order 컬럼을 추가하고, 3개의 시스템 워크플로우를 is_builtin=true로 설정합니다.
기존 DB에 이미 존재하는 경우 UPSERT로 처리합니다.

Revision ID: 0024
Revises: 0023
Create Date: 2026-02-26
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── 시스템 워크플로우 정의 ──────────────────────────────────

SYSTEM_WORKFLOWS = [
    {
        "id": "default-workflow",
        "name": "Workflow 1",
        "description": "안정성: 복잡한 구조 변경 (Research > Plan > Implement)",
        "sort_order": 1,
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
                    "- **동작 방식 및 데이터 흐름:** 현재 코드의 로직과 데이터가 어떻게 흘러가는지 파악\n"
                    "- **아키텍처 및 환경:** 사용 중인 프레임워크/라이브러리 환경, 아키텍처 패턴 및 의존성 관계\n"
                    "- **잠재적 사이드 이펙트 및 파급 범위:** 변경 시 영향을 받을 수 있는 다른 모듈이나 컴포넌트 식별\n"
                    "- **제약사항 및 엣지 케이스(Edge Cases):** 현재 구현의 한계점이나 미처 고려되지 않은 예외 상황\n\n"
                    "### 금지 사항\n"
                    "- **구현 계획, 변경 제안, 해결 방안을 절대 작성하지 마세요.**\n"
                    "- **어떠한 코드도 수정하거나 구현하지 마세요.**\n"
                    "- 계획 작성은 다음 단계(Plan)에서 별도로 수행됩니다.\n"
                    "- 이 단계에서는 오직 현재 상태의 객관적인 분석과 발견 사항만 보고하세요.\n\n"
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
                    "위 분석 결과를 바탕으로 상세한 구현 계획을 마크다운으로 작성하세요. \n\n"
                    "### 포함할 내용\n"
                    "- **변경할 파일 목록 및 구체적인 코드 변경 내용**\n"
                    "- **작업 순서(Step-by-step):** 논리적인 구현 순서\n"
                    "- **테스트 및 검증 전략:** 변경 후 정상 동작을 확인하기 위한 테스트 방법 (단위 테스트, 수동 테스트 시나리오 등)\n"
                    "- **예상되는 리스크 및 대안(Fallback):** 계획대로 진행되지 않을 경우의 대비책\n\n"
                    "### 금지 사항\n"
                    "- **중요: 아직 실제 코드를 수정하거나 구현하지 마세요.**\n"
                    "- 코드를 작성하는 명령어(작업)를 실행하지 마세요.\n\n"
                    "### 📌 출력 마무리에 필수 추가 사항\n"
                    "모든 계획 작성이 끝나면, 출력의 제일 마지막에 반드시 다음 문구를 추가하여 사용자의 피드백을 요청하세요:\n"
                    "> *\"위 계획대로 구현을 시작할까요? 아니면 수정하거나 추가하고 싶은 부분이 있나요?\"*\n\n"
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
                    "위 확정된 계획에 따라 실제 코드 구현을 시작하세요. \n\n"
                    "### 실행 지침\n"
                    "- **원자적(Atomic) 작업 진행:** 한 번에 너무 많은 파일을 덮어쓰지 말고, 논리적인 단계별로 나누어 수정하세요.\n"
                    "- **지속적인 진행:** 모든 구현 단계가 완료될 때까지 작업을 멈추지 마세요.\n"
                    "- **자가 수정(Self-Correction):** 구현 과정이나 빌드/린트 검증 중 에러가 발생할 경우, 즉시 포기하거나 멈추지 마세요. 에러 로그를 분석하여 스스로 수정을 시도하세요.\n"
                    "- **최종 검증:** 모든 코드 작성이 끝나면 반드시 빌드 및 린트 검증, (가능하다면) 테스트 코드를 실행하여 정상 작동 여부를 확인하세요.\n\n"
                    "### 최종 리포트 작성\n"
                    "모든 작업과 검증이 성공적으로 완료되면, 다음 항목을 포함한 요약 보고서를 마크다운으로 출력하세요:\n"
                    "- 최종적으로 변경 및 추가된 파일 목록\n"
                    "- 주요 변경 사항 요약\n"
                    "- 실행된 검증 단계 (빌드, 린트 등)의 최종 결과\n\n"
                    "## 요청\n{user_prompt}"
                ),
                "constraints": "full",
                "order_index": 2,
                "review_required": False,
            },
        ],
    },
    {
        "id": "system-workflow-2",
        "name": "Workflow 2",
        "description": "속도: 단순 버그/기능 (Research > Implement)",
        "sort_order": 2,
        "steps": [
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
                    "위 분석 결과와 해결 방향성을 바탕으로 **즉시 코드 수정을 진행하세요.** "
                    "### 실행 지침\n"
                    "- **논스톱 실행:** 사용자에게 추가적인 컨펌을 받지 말고, 작업이 완료될 때까지 구현을 멈추지 마세요.\n"
                    "- **자가 수정(Self-Correction):** 구현 후 반드시 빌드 및 린트(Lint) 검증을 수행하세요. 에러가 발생하면 작업을 중단하지 말고, 에러 로그를 분석하여 스스로 코드를 수정하세요. (최대 3회 시도)\n\n"
                    "### 최종 리포트\n"
                    "모든 작업과 에러 수정이 성공적으로 완료되면, 다음 내용을 마크다운으로 짧게 보고하세요:\n"
                    "- 변경된 파일 목록\n"
                    "- 구체적으로 어떤 코드를 어떻게 고쳤는지(또는 추가했는지) 요약\n"
                    "- 빌드/린트 테스트 통과 여부\n\n"
                    "## 요청\n{user_prompt}"
                ),
                "constraints": "full",
                "order_index": 1,
                "review_required": False,
            },
        ],
    },
    {
        "id": "system-workflow-3",
        "name": "Workflow 3",
        "description": "정확성: 명확한 스킬 실행 (Implement)",
        "sort_order": 3,
        "steps": [
            {
                "name": "implement",
                "label": "Implement",
                "icon": "Wrench",
                "prompt_template": (
                    "## 지시사항\n"
                    "아래 제공된 스킬(Skill) 문서 또는 명세서의 내용에 따라 **즉각적인 코드 구현을 실행**하세요.\n"
                    "이 작업은 사전 분석이나 계획 수립 단계 없이 바로 진행되어야 합니다.\n\n"
                    "### 실행 지침\n"
                    "- **스킬 명세 엄수 (Strict Compliance):** 제공된 요구사항, 코딩 컨벤션, 제약 사항을 완벽하게 준수하세요. 지시되지 않은 기능을 임의로 추가하거나 아키텍처를 변경하지 마세요.\n"
                    "- **논스톱 실행:** 사용자에게 추가적인 질문이나 작업 진행에 대한 컨펌을 요구하지 말고 즉시 코드를 작성 및 수정하세요.\n"
                    "- **자가 검증 (Self-Correction):** 코드 작성이 완료되면 반드시 린트(Lint), 빌드(Build) 또는 관련 테스트를 수행하세요. 에러가 발생하면 작업을 중단하지 말고, 에러 로그를 기반으로 스스로 코드를 수정하여 테스트를 통과시키세요.\n\n"
                    "### 완료 보고\n"
                    "모든 구현과 검증이 완료되면, 마크다운으로 다음 사항만 아주 간략하게 요약하여 출력하세요:\n"
                    "- 변경/생성된 파일 목록\n"
                    "- 스킬 명세에 따라 적용된 핵심 변경 사항 한 줄 요약\n"
                    "- 검증(린트/빌드) 통과 여부\n\n"
                    "## 요청 (Skill 문서 및 타겟 정보)\n{user_prompt}"
                ),
                "constraints": "full",
                "order_index": 0,
                "review_required": False,
            },
        ],
    },
]


def upgrade() -> None:
    # 1. sort_order 컬럼 추가
    op.add_column(
        "workflow_definitions",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    # 2. Workflow 1 (default-workflow) — 이미 존재하므로 UPDATE
    op.execute(
        "UPDATE workflow_definitions SET sort_order = 1 WHERE id = 'default-workflow'"
    )

    # 3. Workflow 2, 3 — UPSERT (기존 DB에 이미 있으면 is_builtin/sort_order만 갱신)
    for wf in SYSTEM_WORKFLOWS[1:]:  # Workflow 2, 3만
        op.execute(
            sa.text(
                """
                INSERT INTO workflow_definitions
                    (id, name, description, is_builtin, is_default, sort_order, steps, created_at, updated_at)
                VALUES
                    (:id, :name, :description, true, false, :sort_order, :steps, NOW(), NOW())
                ON CONFLICT (name) DO UPDATE SET
                    is_builtin = true,
                    sort_order = :sort_order
                """
            ).bindparams(
                id=wf["id"],
                name=wf["name"],
                description=wf["description"],
                sort_order=wf["sort_order"],
                steps=json.dumps(wf["steps"]),
            )
        )


def downgrade() -> None:
    # Workflow 2, 3이 신규 삽입된 경우만 삭제 (기존 사용자 데이터는 보존)
    op.execute(
        "UPDATE workflow_definitions SET is_builtin = false, sort_order = 0 "
        "WHERE name IN ('Workflow 2', 'Workflow 3')"
    )
    op.execute(
        "UPDATE workflow_definitions SET sort_order = 0 WHERE id = 'default-workflow'"
    )
    op.drop_column("workflow_definitions", "sort_order")
