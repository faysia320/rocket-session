# 작업 이력: 질문 UI 네비게이션 복구

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 페이지에서 질문 UI(PermissionDialog, PlanResultCard, AskUserQuestionCard)가 떠 있는 상태에서 다른 페이지로 이동했다가 돌아오면 질문 UI가 사라지는 버그를 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - session_state에 pending_interactions 필드 추가

### Frontend

- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - WS_SESSION_STATE에서 permission 복원 + WS_RESULT에서 history 메시지 업그레이드 로직 추가
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - current_turn_events 재생 필터 수정 (result 허용, permission_response 건너뛰기)
- `frontend/src/features/chat/hooks/claudeSocketReducer.test.ts` - 테스트에 pendingInteractions 필드 추가

## 상세 변경 내용

### 1. PlanResultCard 복구 (가장 심각한 이슈)

- **문제**: `result` 이벤트가 `current_turn_events` 재생 시 명시적으로 필터링되었고, DB history에서 복원된 메시지에 `mode: "plan"` 필드가 없어 Plan 승인 UI가 완전히 사라졌음
- **해결**: `result` 이벤트 재생을 허용하되, reducer의 `WS_RESULT` 핸들러에서 `hist-` prefix를 가진 history 복원 메시지를 감지하여 `mode`와 `planFileContent`로 인플레이스 업그레이드
- 토큰 이중 계산 방지 (history 로딩 시 이미 계산된 tokenUsage 유지)

### 2. PermissionDialog 복구

- **문제**: 백엔드 120초 타임아웃 시 `permission_request`와 `permission_response`가 동시에 재생되어 다이얼로그가 즉시 닫힘
- **해결**:
  - 백엔드 `session_state`에 `pending_interactions` 필드 추가 — 인메모리 `_pending` 딕셔너리에서 해당 세션의 대기 중 permission을 조회하여 전달
  - 프론트엔드에서 `permission_response` 이벤트 재생 건너뛰기 — `pending_interactions`가 권위적 소스
  - Reducer `WS_SESSION_STATE`에서 `pending_interactions.permission`이 있으면 `pendingPermission` 상태 복원

### 3. AskUserQuestionCard

- 기존에도 `ask_user_question` 이벤트가 정상 재생되어 카드 자체는 복구됨 (사용자 답변 소실은 경미한 이슈)

## 테스트 방법

1. **PlanResultCard**: Plan 모드 세션에서 result 대기 중 → 다른 페이지 이동 → 돌아오기 → Plan 승인 버튼 표시 확인
2. **PermissionDialog**: Permission 모드 세션에서 도구 승인 대기 중 → 다른 페이지 이동 → 돌아오기 → Permission 다이얼로그 표시 확인
3. **AskUserQuestionCard**: AskUserQuestion 표시 상태 → 다른 페이지 이동 → 돌아오기 → 질문 카드 표시 확인
4. **회귀 테스트**: 정상적인 세션 동작(메시지 스트리밍, 도구 사용, 재연결) 이상 없음 확인
