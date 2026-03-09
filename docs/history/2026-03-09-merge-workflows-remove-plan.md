# 작업 이력: 워크플로우 통합 — Plan 단계 제거 및 WF1/WF2 병합

- **날짜**: 2026-03-09
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Workflow 1(Research→Plan→Implement→QA)에서 Plan 단계를 제거하고, Workflow 2의 3단계 구조(Research→Implement→QA)를 Workflow 1에 통합했습니다. 기존 Workflow 2는 삭제, Workflow 3은 Workflow 2로 이름 변경하였습니다.

### 근본 원인

Research→Plan 자동 전환 시 `--resume` 플래그로 인해 Claude CLI가 Research 대화 전체를 재로드하면서 첫 API 응답이 120초 stall timeout을 초과하는 문제가 빈번히 발생했습니다. Plan 단계 자체가 Research 결과와 기능적으로 중복되어, Plan을 제거하고 Research에 `review_required=True`를 설정하여 자동 체이닝을 차단함으로써 근본적으로 해결했습니다.

### 변경 후 구조

| 변경 전 | 변경 후 |
|---------|---------|
| WF1: Research→Plan→Implement→QA | WF1: Research→Implement→QA (default) |
| WF2: Research→Implement→QA | 삭제 (WF1에 병합) |
| WF3: Implement | WF2: Implement (이름변경) |

## 변경 파일 목록

### Backend — 마이그레이션

- `backend/migrations/versions/20260309_0031_merge_workflows.py` — WF1 steps 교체, WF2 삭제, WF3→WF2 이름변경, plan 상태 세션 리셋

### Backend — 소스 코드

- `backend/app/services/workflow_definition_service.py` — fallback steps에서 plan 제거, research `review_required=True`
- `backend/app/services/workflow_service.py` — `skip_plan` 파라미터 및 로직 제거
- `backend/app/api/v1/endpoints/workflow.py` — `skip_plan` 전달 제거, stale docstring 수정
- `backend/app/schemas/workflow.py` — `skip_plan` 필드 제거
- `backend/app/services/claude_runner.py` — `"plan"` 하드코딩 제거

### Frontend

- `frontend/src/types/workflow.ts` — `skip_plan` 타입 제거
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` — plan 전용 텍스트 제거
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` — plan 폴백 조건 제거
- `frontend/src/features/chat/components/MessageBubble.tsx` — plan 기본값/조건 제거

### 테스트

- `backend/tests/test_workflow_service.py` — plan 관련 테스트 제거/수정, 3단계 흐름 반영
- `backend/tests/test_workflow_definition_service.py` — fallback steps 검증 수정
- `backend/tests/test_api_endpoints.py` — 테스트 fixture plan step 제거
- `backend/tests/test_workflow_gate.py` — awaiting_approval 테스트 phase 목록 수정
- `frontend/src/features/chat/components/MessageBubble.test.tsx` — plan→research 테스트 수정
- `frontend/src/features/chat/hooks/useClaudeSocket.test.ts` — plan→research 테스트 수정

## 상세 변경 내용

### 1. DB 마이그레이션 (0031)

- WF1(`default-workflow`) steps를 4단계→3단계로 교체 (Plan 제거)
- WF2(`system-workflow-2`) 행 삭제 (FK `ondelete=SET NULL`로 세션 참조 안전)
- WF3(`system-workflow-3`)를 "Workflow 2"로 이름변경, sort_order 조정
- `workflow_phase='plan'` 상태의 기존 세션을 `'research'`로 리셋

### 2. skip_plan 완전 제거

- 백엔드: `workflow_service.py`, `workflow.py` endpoint, `workflow.py` schema에서 `skip_plan` 파라미터/필드 제거
- 프론트엔드: `workflow.ts` 타입에서 `skip_plan` 제거

### 3. Plan 하드코딩 제거

- `claude_runner.py`: `workflow_phase in ("research", "plan")` → `== "research"`
- `PhaseApprovalBar.tsx`: plan 전용 버튼 텍스트 ternary 제거
- `WorkflowPhaseCard.tsx`: `message.workflow_phase === "plan"` 폴백 → `false`
- `MessageBubble.tsx`: plan 기본값을 research로 변경, plan-only 라우팅 조건 제거

## 테스트 결과

- 백엔드: 워크플로우 관련 테스트 99개 전체 통과
- 프론트엔드: MessageBubble + useClaudeSocket 테스트 82개 전체 통과

## 비고

- `claude_runner.py`의 `--permission-mode plan`은 Claude CLI의 실행 모드로, 워크플로우 phase와 무관하므로 유지
- `ExitPlanMode` 도구 관련 코드도 CLI 내부 처리로 워크플로우와 무관하므로 유지
- 마이그레이션 downgrade는 WF3 이름변경만 롤백 (WF2 삭제, WF1 변경은 복원 불가 — 단방향 마이그레이션)
