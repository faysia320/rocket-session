# 작업 이력: 상태 표시 Race Condition 수정

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

에이전트가 실행 중임에도 ChatHeader에 "Connected"(idle)로 표시되고 ActivityStatusBar가 보이지 않는 버그를 수정했습니다. `isEffectivelyRunning` 파생 상태를 도입하여 `status` 값뿐만 아니라 `activeTools` 존재 여부도 함께 확인합니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - isEffectivelyRunning 적용
- `frontend/src/features/chat/components/ChatHeader.tsx` - activeTools prop 추가, 상태 표시에 isEffectivelyRunning 적용
- `frontend/src/features/chat/components/ChatInput.tsx` - activeTools prop 추가, 전송 차단/중지 버튼에 isEffectivelyRunning 적용
- `frontend/src/features/chat/components/ChatPanel.tsx` - activeTools를 ChatHeader, ChatInput에 전달

## 상세 변경 내용

### 1. 근본 원인

WebSocket 이벤트 전달 경합 조건(race condition):
- 클라이언트가 세션 중간에 연결하면, broadcast 이벤트가 `session_state`보다 먼저 도착
- `lastSeqRef`가 갱신되어 `current_turn_events`의 `status: running` 이벤트가 seq 중복 검사에 걸려 드롭
- 프론트엔드가 `status` 값에만 의존하고 실제 활동 증거(`activeTools`)를 무시

### 2. 수정 방법: `isEffectivelyRunning` 파생 상태

```typescript
const isEffectivelyRunning = status === "running" || activeTools.length > 0;
```

- `status`가 race condition으로 `"idle"`이 되더라도, `activeTools`가 남아있으면 running 상태 유지
- ActivityStatusBar: 표시 조건에 isEffectivelyRunning 적용
- ChatHeader: 상태 점(dot), 상태 텍스트에 isEffectivelyRunning 적용
- ChatInput: 전송 차단, 중지 버튼 표시, Escape 키 동작에 isEffectivelyRunning 적용

## 테스트 방법

1. 세션에서 프롬프트를 전송하여 에이전트 실행 시작
2. 브라우저를 새로고침하여 세션 중간에 재연결
3. ChatHeader에 "Running" 상태가 정확히 표시되는지 확인
4. ActivityStatusBar에 도구 활동이 표시되는지 확인
5. 에이전트 실행 중 전송 버튼이 비활성화되고 중지 버튼이 표시되는지 확인
