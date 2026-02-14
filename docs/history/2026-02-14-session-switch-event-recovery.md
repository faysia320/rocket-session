# 작업 이력: 세션 전환 시 running 세션 이벤트 복구

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: feature-histroy

## 변경 요약

세션 간 이동 시 running 중이던 세션의 중간 진행 내용(assistant_text, tool_use, tool_result 등)이 사라지고 이후 진행 상황을 수신받지 못하는 문제를 수정했습니다. DB events 테이블 기반 fallback을 추가하여 세션 재진입 시 완전한 턴 이벤트를 복구합니다.

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - `get_current_turn_events()` DB 조회 메서드 추가
- `backend/app/services/websocket_manager.py` - `flush_events()` 공개 메서드 추가, `get_current_turn_events()` async 변환 + DB fallback
- `backend/app/services/claude_runner.py` - `clear_buffer` 전 `flush_events()` 호출로 경쟁 조건 해결
- `backend/app/api/v1/endpoints/ws.py` - `is_running` 조건 제거, 완료된 세션에서도 턴 이벤트 전송
- `backend/tests/test_websocket_manager.py` - `get_current_turn_events()` async 변경에 맞춰 `await` 추가

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - `latest_seq` 업데이트 순서를 이벤트 재생 이후로 이동, `result` 이벤트 필터 추가

## 상세 변경 내용

### 1. DB 기반 턴 이벤트 복구 (database.py + websocket_manager.py)

- `Database.get_current_turn_events()`: events 테이블에서 마지막 `user_message`의 seq를 찾고, 그 이후 모든 이벤트를 반환
- `WebSocketManager.get_current_turn_events()`: 인메모리 버퍼 우선 조회 → 비어있으면 DB fallback으로 체이닝
- `WebSocketManager.flush_events()`: 외부에서 이벤트 flush를 트리거할 수 있는 공개 메서드

### 2. 경쟁 조건 해결 (claude_runner.py)

- `clear_buffer()` 호출 전에 `flush_events()`를 await하여 큐에 남은 이벤트가 DB에 확실히 저장되도록 보장
- 이전에는 0.5초 배치 간격 사이에 버퍼가 삭제될 수 있었음

### 3. 완료된 세션에도 턴 이벤트 전송 (ws.py)

- `if is_running:` 조건을 제거하여 idle/error 세션에서도 `current_turn_events`를 전송
- 사용자가 다른 세션에 있는 동안 실행이 완료된 경우에도 중간 과정을 복구

### 4. seq 중복 방지 순서 수정 (useClaudeSocket.ts)

- `latest_seq` 업데이트를 `current_turn_events` 재생 이후로 이동
- 이전에는 `latest_seq`가 먼저 설정되어 재생할 이벤트들이 seq 중복 체크에 걸려 모두 무시됨
- `result` 이벤트도 필터에 추가하여 히스토리의 마지막 assistant 메시지와 중복 방지

## 테스트 방법

1. 세션 A에서 긴 작업 실행 → 세션 B로 이동 → 세션 A로 복귀 → 중간 과정(tool_use, assistant_text) 표시 확인
2. 세션 A에서 작업 실행 → 다른 세션으로 이동 → 작업 완료 후 세션 A 복귀 → 완료된 턴의 중간 과정 표시 확인
3. `uv run pytest` - 166 passed
4. `pnpm build` - 성공
