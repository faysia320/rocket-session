# 작업 이력: 모바일 탭 복귀 시 자동 갱신 + 스크롤 위치 수정

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

모바일 브라우저에서 탭을 백그라운드로 전환했다가 다시 돌아올 때 발생하던 두 가지 문제를 수정했습니다:
1. 새로운 내용이 자동 갱신되지 않는 문제 (WebSocket이 stale/dead 상태이지만 감지 못함)
2. 스크롤이 최신 메시지가 아닌 시작 지점으로 이동하는 문제 (isNearBottom ref 상태 손실)

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - visibilitychange 리스너 추가: WS 상태 점검 + 자동 재연결
- `frontend/src/features/chat/components/ChatPanel.tsx` - visibilitychange 리스너 추가: 스크롤 위치 복원 + TanStack Query 갱신

## 상세 변경 내용

### 1. WebSocket 상태 점검 + 자동 재연결 (useClaudeSocket.ts)

- `visibilitychange` 이벤트 리스너를 새 `useEffect`에 추가
- 탭이 5초 이상 백그라운드에 있다가 복귀할 때:
  - WS가 이미 닫혀있으면 → 즉시 재연결 (reconnectAttempt 초기화, `last_seq`로 놓친 이벤트 복구)
  - WS가 OPEN 상태면 → ping 프로브 전송, 3초 내 응답 없으면 stale로 판단하여 강제 재연결
  - 어떤 메시지든 수신되면 연결 정상으로 판단 (pong뿐 아니라 running 중인 이벤트도 유효)
- `handleMessage`에 `"pong"` case 추가 (서버의 ping 응답 인식)
- 백엔드는 이미 ping/pong 핸들러가 구현되어 있어 변경 불필요

### 2. 스크롤 위치 복원 + TanStack Query 갱신 (ChatPanel.tsx)

- `visibilitychange` 이벤트 리스너를 새 `useEffect`에 추가
- 탭 숨겨질 때 `isNearBottom.current` 값을 클로저 변수 `savedNearBottom`에 저장
- 5초+ 백그라운드 후 복귀 시:
  - 하단에 있었으면 `isNearBottom.current = true` 복원 + 즉시 `scrollToIndex(last, "end")`
  - TanStack Query `["sessions"]` 캐시 무효화로 세션 목록 갱신
- 이후 WS 재연결로 missed_events가 들어오면, 기존 messagesLength useEffect가 `isNearBottom === true`를 보고 자동 하단 스크롤

## 근본 원인 분석

- 모바일 브라우저는 백그라운드 탭의 WebSocket을 적극적으로 종료/동결함
- 기존 재연결 타이머(`setTimeout`)도 백그라운드에서 동결되어 작동하지 않음
- 프론트엔드 전체에 `visibilitychange` 이벤트 리스너가 없어 탭 복귀를 감지할 방법이 없었음
- 스크롤 이벤트도 백그라운드에서 발생하지 않아 `isNearBottom` ref가 정확하지 않았음

## 테스트 방법

1. 모바일 브라우저에서 세션 페이지 열기
2. 다른 앱/탭으로 5초 이상 전환
3. 다시 돌아와서:
   - 콘솔에 `[Visibility] WS probe succeeded` 또는 `[Visibility] WS not open, forcing reconnect` 로그 확인
   - 놓친 메시지가 자동으로 나타나는지 확인
   - 스크롤이 하단에 유지되는지 확인
