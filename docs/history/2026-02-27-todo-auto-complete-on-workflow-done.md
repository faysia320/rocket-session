# 작업 이력: Workflow 완료 시 Todo 자동 완료 처리

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Workflow의 모든 phase가 완료되었음에도 PinnedTodoBar가 stale 상태(in_progress/pending)로 남는 버그를 수정했습니다. Workflow 시스템과 Todo 시스템 간의 동기화 메커니즘을 추가하여, 세션이 idle로 전환되거나 워크플로우가 완전히 종료될 때 Todo 항목을 자동으로 completed 처리합니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - WS_STATUS idle/error 시 in_progress todo 자동 완료
- `frontend/src/features/chat/hooks/reducers/workflowHandlers.ts` - WS_WORKFLOW_COMPLETED 시 잔여 todo 전체 완료

## 상세 변경 내용

### 1. WS_STATUS 핸들러에 in_progress todo 자동 완료 로직 추가

- 세션이 idle 또는 error로 전환될 때, `in_progress` 상태의 pinnedTodos를 `completed`로 자동 전환
- `pending` 항목은 유지하여 멀티턴 대화에서의 안전성 확보
- `some()` 사전 검사로 변경 없으면 동일 참조 유지 (불필요한 리렌더 방지)

### 2. WS_WORKFLOW_COMPLETED 핸들러에 전체 잔여 todo 완료 로직 추가

- 워크플로우 완전 종료 시, `in_progress`와 `pending` 포함 모든 잔여 todo를 `completed`로 전환
- 백엔드 이벤트 순서(`status:idle` → `workflow_completed`) 보장에 의해, 변경 1이 먼저 in_progress를 정리하고 이 핸들러가 남은 pending을 정리

### 근본 원인

- `pinnedTodos`는 오직 Claude의 `TodoWrite` 도구 호출로만 갱신되었음
- Claude가 마지막 TodoWrite 호출을 생략하면 UI가 stale 상태로 고착
- Workflow 시스템과 Todo 시스템 사이에 동기화 메커니즘이 전혀 없었음

## 테스트 방법

1. 워크플로우(research -> implement) 세션 실행 -> 완료 시 Todo가 전체 completed 표시되는지 확인
2. 비-워크플로우 세션에서 in_progress Todo가 idle 전환 시 completed 되는지 확인
3. 사용자 중단(stopped) 시 Todo가 변경되지 않는지 확인
4. TypeScript (`tsc --noEmit`): 통과
5. ESLint: 통과
