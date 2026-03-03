# 작업 이력: 첫 메시지 전송 시 즉각 피드백 UX 개선

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

새 세션에서 첫 메시지를 전송하면 워크플로우 추천 LLM 호출(5~10초) 동안 아무 피드백이 없던 UX 문제를 개선했습니다. USER_MESSAGE 브로드캐스트를 워크플로우 처리 앞으로 이동하고, "preparing" 상태를 추가하여 사용자에게 즉각적인 피드백을 제공합니다.

## 변경 파일 목록

### Backend

- `backend/app/models/session.py` - SessionStatus enum에 PREPARING 추가
- `backend/app/api/v1/endpoints/ws.py` - _handle_prompt 처리 순서 재배치 + preparing 상태 브로드캐스트

### Frontend

- `frontend/src/types/session.ts` - SessionStatus 타입에 "preparing" 추가
- `frontend/src/types/ws-events.ts` - WsStatusEvent status에 "preparing" 추가
- `frontend/src/features/chat/hooks/reducers/types.ts` - ClaudeSocketState.status + WS_STATUS 액션 타입 확장
- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - preparing은 running과 동일하게 처리
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - status 캐스팅에 "preparing" 추가
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - preparing 상태 스피너 + "워크플로우 분석 중…" 표시
- `frontend/src/features/chat/components/ChatInput.tsx` - preparing 시 전송 차단
- `frontend/src/features/chat/components/ChatHeader.tsx` - status 타입 확장
- `frontend/src/features/chat/components/GitDropdownMenu.tsx` - status 타입 확장

## 상세 변경 내용

### 1. Backend: _handle_prompt 처리 순서 재배치

기존 순서에서 메시지 DB 저장 + USER_MESSAGE 브로드캐스트를 워크플로우 처리 **앞으로** 이동했습니다.

**기존**: 유효성 검사 → 세션 로드 → 워크플로우 처리(5~10초) → 메시지 저장 → USER_MESSAGE 브로드캐스트
**수정**: 유효성 검사 → 세션 로드 → 메시지 저장 → USER_MESSAGE 브로드캐스트(즉시!) → STATUS "preparing" → 워크플로우 처리

### 2. Backend: SessionStatus.PREPARING 추가

세션 상태 enum에 `PREPARING = "preparing"` 값을 추가하여 워크플로우 분석 중 상태를 표현합니다.

### 3. Frontend: preparing 상태 처리

- 리듀서: `preparing`은 `idle/error`의 정리 분기에 진입하지 않고, `running`과 동일하게 단순 상태 업데이트
- ActivityStatusBar: `isEffectivelyRunning`에 preparing 포함, "워크플로우 분석 중…" 메시지 표시
- ChatInput: preparing 시 전송 버튼 차단 (중지 버튼으로 전환)

## 관련 커밋

- Backend: _handle_prompt 순서 재배치 + PREPARING 상태 추가
- Frontend: preparing 상태 타입 확장 및 UI 처리

## 테스트 방법

1. 워크플로우가 활성화된 새 세션 생성
2. 첫 메시지 전송
3. 즉시 USER_MESSAGE가 화면에 표시되는지 확인
4. "워크플로우 분석 중…" 스피너가 표시되는지 확인
5. 워크플로우 추천 완료 후 정상적으로 running 상태로 전환되는지 확인
