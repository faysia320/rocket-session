# 작업 이력: ClaudeRunner 안정성 개선 + 메시지 UI 리팩토링 + WebSocket 버그 수정

- **날짜**: 2026-02-22
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

ClaudeRunner의 비정상 종료 시 데이터 유실을 방지하고, 도구 메시지 컴포넌트를 전용 파일로 분리하며, WebSocket 재연결 및 Permission 처리 관련 버그를 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - turn_state 리팩토링, partial text 저장, result_received 추적

### Frontend

- `frontend/src/features/chat/components/MessageBubble.tsx` - Read/Search/Web 전용 컴포넌트 분리, Permission 상태 표시
- `frontend/src/features/chat/components/ReadToolMessage.tsx` - (신규) Read 도구 전용 컴포넌트
- `frontend/src/features/chat/components/SearchToolMessage.tsx` - (신규) Grep/Glob 도구 전용 컴포넌트
- `frontend/src/features/chat/components/WebToolMessage.tsx` - (신규) WebFetch/WebSearch 도구 전용 컴포넌트
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - Permission resolved 마킹, error 상태 설정
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 재연결 assistant_text 재생 수정
- `frontend/src/types/message.ts` - PermissionRequestMsg에 resolved/resolution 필드 추가

## 상세 변경 내용

### 1. ClaudeRunner turn_state 리팩토링

- `create_turn_state()` 정적 메서드 추출: turn_state 초기화를 명확한 팩토리로 분리
- `_parse_stream()` 반환값 제거: turn_state를 in-place 갱신하여 외부에서 직접 참조
- `result_received` 플래그 추가: result 이벤트 수신 여부를 추적하여 비정상 종료 감지
- 비정상 종료 시 partial text를 DB에 `is_error=True`로 저장 (데이터 유실 방지)

### 2. 도구 메시지 컴포넌트 분리

- `ReadToolMessage.tsx`: Read 도구를 CodeBlock으로 구문 강조 렌더링
- `SearchToolMessage.tsx`: Grep/Glob 결과를 구조화 표시
- `WebToolMessage.tsx`: WebFetch/WebSearch 결과 표시
- `MessageBubble.tsx`의 ToolUseMessage에서 Read 전용 로직 제거 (일반 도구 + MCP 전용으로 단순화)

### 3. Permission 상태 표시 개선

- `PermissionRequestMsg`에 `resolved`, `resolution` 필드 추가
- 승인 시 초록색, 거부 시 빨간색으로 상태 변경 표시
- `CLEAR_PENDING_PERMISSION` 액션에 `behavior` 전달하여 즉시 UI 반영

### 4. WebSocket 재연결 버그 수정

- `assistant_text` 이벤트를 RAF 배치 우회하여 직접 dispatch (재생 시 마지막 이벤트만 반영되는 버그 수정)
- `user_message` 이벤트 파싱 개선: 백엔드 형태에 맞게 content 추출
- 에러 이벤트 수신 시 방어적으로 `status: "error"` 설정

## 테스트 방법

1. 세션 실행 중 비정상 종료 → 대시보드에서 partial text가 보존되는지 확인
2. Read/Grep/WebSearch 도구 호출 → 전용 UI 컴포넌트로 표시되는지 확인
3. Permission 승인/거부 → 카드 색상이 초록/빨간색으로 변경되는지 확인
4. WebSocket 재연결 → 이전 assistant_text가 정상 복원되는지 확인
