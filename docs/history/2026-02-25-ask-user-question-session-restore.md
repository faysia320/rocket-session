# 작업 이력: AskUserQuestion 세션 전환 시 UI 복원 버그 수정

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

`AskUserQuestion` 인터랙티브 UI 카드가 실시간 WebSocket 이벤트로만 렌더링되어, 사용자가 다른 세션을 보거나 뒤늦게 해당 세션을 열면 카드가 표시되지 않는 문제를 수정했습니다.
`permission_request`의 인메모리 pending store 패턴을 미러링하여 세션 전환/새로고침 시 질문 카드가 복원되도록 구현했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/pending_questions.py` - **신규** 인메모리 pending question store 모듈
- `backend/app/services/claude_runner.py` - AskUserQuestion 감지 시 pending store에 저장
- `backend/app/api/v1/endpoints/ws.py` - WebSocket 연결 시 복원 + 답변 시 클리어
- `backend/app/api/v1/endpoints/sessions.py` - 세션 삭제 시 pending question 클리어
- `backend/app/main.py` - 서버 종료 시 전체 클리어

### Frontend

- `frontend/src/types/ws-events.ts` - `pending_interactions` 타입에 `ask_user_question?` 필드 추가
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - `WS_SESSION_STATE` 액션 타입 확장
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - `session_state` 수신 시 pending question dispatch

## 상세 변경 내용

### 1. 근본 원인

AskUserQuestion 감지 시 subprocess가 종료되어 세션이 IDLE 상태가 됨. `ws.py`의 `session_state` 전송 시:
- `current_turn_events`는 `is_running` 가드로 인해 IDLE 세션에 미전송
- `pending_interactions`는 `permission` 타입만 지원
- `history` (messages 테이블)에는 ask_user_question이 저장되지 않음

### 2. 해결 방법: 인메모리 pending store 패턴

`permissions.py`의 `_pending` dict 패턴을 미러링:
- `pending_questions.py`: session_id를 키로 하는 인메모리 dict
- `claude_runner.py`: 질문 감지 시 `set_pending_question()` 호출
- `ws.py`: 연결 시 `pending_interactions["ask_user_question"]`에 복원, 프롬프트 시 클리어
- 프론트엔드: 기존 `WS_ASK_USER_QUESTION` 리듀서 액션을 재사용하여 카드 렌더링

## 테스트 방법

1. 세션 A에서 Claude가 AskUserQuestion 사용하도록 유도
2. 질문 카드가 표시되면 다른 세션 B로 이동
3. 다시 세션 A로 돌아오면 질문 카드가 복원되는지 확인
4. 답변 후 세션 전환 시 stale 카드가 나타나지 않는지 확인
