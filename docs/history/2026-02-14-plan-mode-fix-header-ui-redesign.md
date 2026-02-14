# 작업 이력: Plan Mode 버그 수정 + Header UI 개선

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: feature-imp

## 변경 요약

Plan Mode 뱃지가 메시지 전송 시 사라지는 상태 동기화 버그를 수정하고, ChatHeader UI를 개선했습니다. Running/Plan Mode 뱃지를 제거하고 Connected 영역에 상태를 통합했으며, Git 액션 버튼을 입력창 상단 플로팅 패널로 이동했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - updateSessionMode 함수 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - mode 동기화 로직 수정 + GitActionsBar 위치 이동
- `frontend/src/features/chat/components/ChatHeader.tsx` - ModeIndicator/Running 뱃지 제거, Connected에 상태 통합
- `frontend/src/features/chat/components/GitActionsBar.tsx` - 인라인 → 플로팅 패널 레이아웃 변경

## 상세 변경 내용

### 1. Plan Mode 뱃지 상태 동기화 버그 수정

**문제**: Plan Mode 토글 시 로컬 state(`setMode`)만 변경하고 `sessionInfo.mode`는 업데이트하지 않아, WebSocket `session_info` 이벤트로 sessionInfo 참조가 변경될 때 `useEffect([sessionInfo])`가 stale한 "normal" 값으로 로컬 mode를 덮어씌움

**수정**:
- `useClaudeSocket.ts`에 `updateSessionMode` 함수 추가하여 sessionInfo.mode를 외부에서 업데이트 가능하게 함
- `ChatPanel.tsx`의 `cycleMode`와 `handleExecutePlan`에서 `updateSessionMode`를 호출하여 양쪽 상태 동기화

### 2. ChatHeader Running 상태 통합

- ModeIndicator (Plan Mode 뱃지) 제거
- Running Badge 제거
- Connected 영역에 Running 상태 통합: idle이면 초록 점 + "Connected", running이면 amber 점(pulse) + "Running"(primary 색상)

### 3. GitActionsBar 플로팅 패널로 이동

- ChatHeader에서 제거하여 header를 깔끔하게 정리
- ChatInput 오른쪽 위에 플로팅 패널로 배치 (`absolute right-4 -top-9`)
- 반투명 카드 스타일 적용 (`bg-card/90 backdrop-blur border shadow-md`)

## 관련 커밋

- Plan Mode 상태 동기화 버그 수정
- Header UI 개선 (상태 통합 + Git 버튼 플로팅)
