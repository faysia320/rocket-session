# 작업 이력: 워크플로우 시스템 치명적 버그 수정

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 활성화 세션에서 메시지 전송 시 WebSocket 연결이 끊어지고 재연결되면서 메시지가 유실되는 치명적 버그를 포함하여, 워크플로우 시스템 전체의 8건의 버그를 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - build_phase_context 인자 수정 + WS 예외 방어
- `backend/app/api/v1/endpoints/workflow.py` - session_manager 전달 누락 + 완료 판정 수정
- `backend/app/services/workflow_service.py` - get_session → get 메서드명 수정
- `backend/app/services/session_manager.py` - 세션 생성 시 워크플로우 초기화 + None 전달 허용

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 누락된 WS 이벤트 핸들러 추가
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - 새 워크플로우 액션 타입/리듀서
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - workflowEnabled=false 전달
- `frontend/src/features/chat/components/ChatPanel.tsx` - WorkflowProgressBar 위치 조정
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 중앙 정렬

## 상세 변경 내용

### 1. [CRITICAL] build_phase_context 인자 누락 → WS 끊김

- `ws.py:133`에서 `build_phase_context(session_id, workflow_phase)`로 호출했으나, 메서드 시그니처는 `(session_id, workflow_phase, user_prompt)` 3개 인자 필요
- TypeError 발생 → 잡히지 않은 예외로 WebSocket 연결 종료 → 재연결 시 메시지 유실
- `user_prompt` 인자 추가 + `build_phase_context`가 이미 `## 요청` 섹션을 포함하므로 이중 래핑 제거

### 2. [CRITICAL] workflow_service에서 존재하지 않는 메서드 호출

- `workflow_service.py:112,161`에서 `session_manager.get_session()` 호출
- SessionManager에는 `get()` 메서드만 존재 → AttributeError로 승인/수정 요청 불가
- `get_session()` → `get()`으로 수정

### 3. [HIGH] update_settings에서 None 값 클리어 불가

- 워크플로우 완료 시 `update_settings(workflow_phase=None)`을 호출하지만
- `if workflow_phase is not None:` 체크에 걸려 kwargs에 포함되지 않음
- `_UNSET` 센티넬 도입으로 "전달 안 함" vs "명시적 None" 구분

### 4. [HIGH] 세션 생성 시 워크플로우 phase 미초기화

- `workflow_enabled=True`로 생성해도 `workflow_phase=None` → 게이트 1 차단
- 생성 시 자동으로 `workflow_phase="research"`, `workflow_phase_status="in_progress"` 설정

### 5. [MEDIUM] workflow.py 엔드포인트 인자 전달 누락

- `start_workflow`, `approve_phase`, `request_revision` 모두 `session_manager` 인자 미전달 → 500 에러
- `session_manager=manager` 추가

### 6. [MEDIUM] 워크플로우 완료 이벤트 판정 오류

- `result.get("workflow_completed")` → 해당 키가 반환값에 없어 항상 falsy
- `result.get("next_phase") is None`으로 올바른 판정

### 7. [MEDIUM] 프론트엔드 WS 이벤트 핸들러 누락

- `workflow_started`, `workflow_phase_revision`, `workflow_artifact_updated`, `workflow_annotation_added` 이벤트 미처리
- 해당 이벤트 핸들러 + 리듀서 case 추가

### 8. [MEDIUM] SessionSetupPanel workflowEnabled=false 미전달

- `if (workflowEnabled)` 조건으로 true일 때만 전달 → 서버 기본값으로 의도치 않게 활성화 가능
- 항상 `options.workflow_enabled = workflowEnabled`로 전달

### 9. WS 메인 루프 예외 방어

- 메시지 처리 루프에 try/except 추가
- 서비스 에러가 WebSocket 연결을 끊지 않도록 에러 이벤트를 클라이언트에 전송

## 테스트 방법

1. 워크플로우 활성화하고 새 세션 생성 → 바로 채팅 가능한지 확인
2. 기존 세션에서 "워크플로우 전환" 버튼 클릭 → 500 에러 없이 전환되는지 확인
3. 워크플로우 phase별 메시지 전송 시 WS 연결이 유지되는지 확인
4. research → plan → implement 전체 흐름 동작 확인
