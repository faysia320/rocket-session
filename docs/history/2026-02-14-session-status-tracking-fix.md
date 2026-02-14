# 작업 이력: 세션 상태 추적 버그 수정

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 상태가 항상 "Idle"로만 표시되는 문제를 수정했습니다. 백엔드의 `finally` 블록에서 ERROR 상태를 보존하도록 수정하고, 프론트엔드에서 WebSocket status 이벤트를 통해 세션 목록 캐시를 실시간으로 동기화하도록 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - finally 블록 ERROR 상태 보존 + is_error 시 status 이벤트 브로드캐스트

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - status 타입에 "error" 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - status 변경 시 세션 목록 TanStack Query 캐시 실시간 동기화
- `frontend/src/features/chat/components/ChatHeader.tsx` - error 상태 인디케이터 (빨간색 점 + "Error" 텍스트)
- `frontend/src/features/chat/components/ChatInput.tsx` - status 타입 일관성 업데이트
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - status 타입 일관성 업데이트
- `frontend/src/features/chat/components/GitActionsBar.tsx` - status 타입 일관성 업데이트

## 상세 변경 내용

### 1. 백엔드 ERROR 상태 보존

- `claude_runner.py`의 `finally` 블록에서 무조건 IDLE로 리셋하던 로직 수정
- 현재 세션 상태를 DB에서 조회하여 ERROR면 보존, 그 외에는 IDLE로 전환
- `_handle_result_event()`에서 `is_error=True`일 때 WebSocket으로 `status: "error"` 이벤트도 함께 브로드캐스트

### 2. 프론트엔드 세션 목록 실시간 동기화

- `ChatPanel.tsx`에서 status 변경 감지 시 `queryClient.setQueryData()`로 세션 목록 캐시를 즉시 업데이트
- 이를 통해 사이드바의 세션 상태 인디케이터가 REST API 폴링 없이 실시간 반영

### 3. error 상태 UI 표시

- ChatHeader에 error 상태 전용 스타일 추가 (빨간색 점 + "Error" 텍스트)
- 모든 status 관련 컴포넌트의 타입을 `"idle" | "running" | "error"`로 통일

## 테스트 방법

1. 세션에서 프롬프트 전송 → 사이드바와 ChatHeader 모두에서 "Running" 상태 확인
2. 작업 완료 → "Connected"/"Idle" 상태로 복귀 확인
3. 에러 발생 시 → "Error" 상태가 유지되는지 확인
