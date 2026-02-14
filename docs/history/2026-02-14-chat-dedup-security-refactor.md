# 작업 이력: 채팅 중복 메시지 제거 + 보안/리팩토링

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

채팅 UI에서 assistant 텍스트 메시지가 도구 사용 사이에 반복 표시되는 문제를 백엔드/프론트엔드 양쪽에서 수정했습니다.
추가로 보안 강화(CORS 제한, 파일 업로드 검증), 코드 리팩토링(공통 유틸 추출, 타입 강화), UI 개선(메시지 간격, 검색 단축키, 접근성)을 적용했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` - CORS 와일드카드를 localhost 오리진으로 제한
- `backend/app/api/v1/endpoints/files.py` - 파일 업로드 확장자 화이트리스트 검증
- `backend/app/services/claude_runner.py` - has_new_text 플래그로 중복 broadcast 방지 + 에러 로깅
- `backend/app/services/session_manager.py` - bare except를 로깅으로 교체

### Frontend

- `frontend/src/lib/utils.ts` - formatTime 공통 유틸 추출
- `frontend/src/features/files/constants/toolColors.ts` - (신규) tool별 Badge 스타일 상수
- `frontend/src/features/files/components/FilePanel.tsx` - toolColors 사용 + ScrollArea 적용 + formatTime 공통화
- `frontend/src/features/files/components/FileViewer.tsx` - toolColors 사용 + ScrollArea 래핑 + formatTime 공통화
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - SessionState 타입 강화 + sessionId 변경 시 상태 초기화 + assistant_text 역순 탐색
- `frontend/src/features/chat/components/ChatPanel.tsx` - messageGaps 계산 + Ctrl+F 단축키 + 접근성 속성
- `frontend/src/features/chat/components/ChatInput.tsx` - 업로드 실패 toast 알림 + PendingImage 타입 정리
- `frontend/src/routes/session/$sessionId.tsx` - ChatPanel에 key prop 추가
- `frontend/src/store/useSessionStore.ts` - zustand persist 미들웨어 (사이드바/분할뷰 상태 유지)

## 상세 변경 내용

### 1. 채팅 중복 메시지 제거 (근본 원인 + 방어적 보호)

- **백엔드**: `_handle_assistant_event`에서 `has_new_text` 플래그를 추가하여, text 블록이 없는 assistant 이벤트에서 이전 텍스트를 다시 broadcast하지 않음
- **프론트엔드**: `assistant_text` 처리 시 역순 탐색으로 같은 턴(user_message/result 경계 이전) 내의 마지막 assistant_text를 찾아 덮어쓰기

### 2. 보안 강화

- CORS: 와일드카드(`*`) → localhost 오리진만 허용
- 파일 업로드: 확장자 화이트리스트 검증 (경로 조작 방지)
- 에러 처리: bare `except: pass` → 구체적 로깅

### 3. 리팩토링

- `formatTime` 중복 함수를 `@/lib/utils`로 공통화
- tool Badge 스타일을 `toolColors.ts` 상수로 추출
- `SessionState` 인터페이스를 `[key: string]: unknown`에서 명시적 필드로 강화
- `useSessionStore`에 persist 미들웨어 추가

### 4. UI/UX 개선

- 같은 턴 내 연속 메시지(text → tool → tool) 간격을 `pb-0.5`로 축소
- Ctrl+F / Cmd+F 검색 단축키
- 검색 입력에 `aria-label`, 결과에 `aria-live="polite"` 추가
- 이미지 업로드 실패 시 toast 알림
- sessionId 변경 시 ChatPanel key 리셋

## 테스트 방법

1. 백엔드 임포트: `cd backend && uv run python -c "from app.main import app; print('OK')"`
2. 프론트엔드 타입: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
3. 프론트엔드 빌드: `cd frontend && pnpm build`
4. 수동 테스트: 세션에서 프롬프트 전송 후 도구 사용 시 텍스트 중복 여부 확인
