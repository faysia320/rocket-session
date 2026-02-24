# 작업 이력: Workflow 자동 체이닝 개선

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우의 Research → Plan → Implement 3단계를 자동 체이닝으로 개선하여,
사용자 개입을 Plan 검토/승인 시점에만 필요하도록 변경했습니다.

**변경 전**: Research 완료 → 수동 승인 → Plan 프롬프트 입력 → Plan 완료 → 수동 승인 → Implement 프롬프트 입력
**변경 후**: 프롬프트 1회 입력 → Research 자동 → Plan 자동 실행 → **Plan 검토/승인** → Implement 자동 실행

## 변경 파일 목록

### Backend

- `backend/app/models/session.py` — `workflow_original_prompt` 컬럼 추가
- `backend/app/models/event_types.py` — `WORKFLOW_AUTO_CHAIN` 이벤트 타입 추가
- `backend/migrations/versions/20260224_*.py` — Alembic 마이그레이션
- `backend/app/services/session_process_manager.py` — `clear_runner_task_if_match()` 추가 (레이스컨디션 방지)
- `backend/app/services/session_manager.py` — `clear_runner_task_if_match()` 위임 메서드
- `backend/app/services/claude_runner.py` — Research→Plan 자동 체이닝 + `_auto_chain_done` 콜백
- `backend/app/services/workflow_service.py` — `build_revision_context()` 메서드 추가
- `backend/app/api/v1/endpoints/ws.py` — `workflow_original_prompt` 저장, `original_prompt` 전달
- `backend/app/api/v1/endpoints/workflow.py` — Plan 승인→Implement 자동 실행, 수정 요청→Plan 자동 재실행

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` — `workflow_auto_chain` 이벤트 → 시스템 메시지
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` — Research 승인 버튼 제거 (자동 체이닝)
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` — `phase` prop, "승인 → 구현 시작" 라벨
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` — PhaseApprovalBar에 phase prop 전달
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` — 워크플로우 phase별 상태 메시지
- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` — 토스트 메시지 개선
- `frontend/src/features/chat/components/ChatHeader.tsx` — 워크플로우 전환 버튼을 드롭다운으로 이동
- `frontend/src/features/chat/components/SessionDropdownMenu.tsx` — 워크플로우 전환 메뉴 항목 추가

## 상세 변경 내용

### 1. Research → Plan 자동 체이닝 (ClaudeRunner)

- Research 완료 시 아티팩트 자동 저장 + 자동 승인 + Plan 자동 실행
- `original_prompt` 파라미터로 최초 사용자 프롬프트 전파
- `_auto_chain_done` 콜백으로 task 정리 (레이스컨디션 방지)

### 2. Plan 승인 → Implement 자동 실행 (workflow.py)

- Plan approve 시 next_phase가 "implement"이면 자동으로 ClaudeRunner 실행
- `workflow_original_prompt`로 컨텍스트 빌드

### 3. Plan 수정 요청 → 자동 재실행 (workflow.py)

- request_revision 시 `build_revision_context()`로 이전 plan + 주석 + 피드백 포함
- 자동으로 Plan 재실행

### 4. Frontend UI 개선

- Research 완료 카드에서 승인 버튼 제거 (자동 전환이므로 불필요)
- Plan 승인 버튼 텍스트: "승인 → 구현 시작"
- 워크플로우 phase별 상태 메시지 (조사 중/계획 작성 중/구현 진행 중)
- 자동 체이닝 시 시스템 메시지 표시

## 테스트 방법

1. 세션 생성 → 워크플로우 시작 → 프롬프트 입력
2. Research 자동 실행 → Plan 자동 체이닝 (사용자 개입 없음) 확인
3. Plan 완료 → 승인 대기 UI 표시 확인
4. 인라인 주석 추가 → 수정 요청 → Plan 자동 재생성 확인
5. Plan 승인 → Implement 자동 시작 확인
