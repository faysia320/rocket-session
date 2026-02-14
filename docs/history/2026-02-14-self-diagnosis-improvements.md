# 작업 이력: 자가 검진 기반 4단계 개선

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프로젝트 전체 자가 검진(스타일, UI/UX, 성능, 백엔드 안정성) 결과를 바탕으로 4단계 개선을 수행했습니다.
- 1단계: 백엔드 안정성 (SQLite busy_timeout, 업로드 파일 정리)
- 2단계: 하드코딩 색상을 시맨틱 디자인 토큰으로 전환 (9건)
- 3단계: WebSocket 스트리밍 성능 최적화 (RAF 배치, sendPrompt 안정화)
- 4단계: 코드 스플리팅 (React.lazy + Suspense, 3개 컴포넌트 별도 청크 분리)

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - SQLite PRAGMA busy_timeout=5000 추가
- `backend/app/services/session_manager.py` - 세션 삭제 시 업로드 디렉토리 자동 정리
- `backend/app/api/dependencies.py` - SessionManager에 upload_dir 전달

### Frontend

- `frontend/src/features/session/components/Sidebar.tsx` - bg-green-500/bg-red-500 → bg-success/bg-destructive
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - 하드코딩 색상 5건 시맨틱 토큰 전환
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - RAF 배치 처리 + sendPrompt messages 의존성 제거
- `frontend/src/routes/__root.tsx` - ChatPanel, SessionDashboardCard lazy import + Suspense
- `frontend/src/routes/index.tsx` - SessionDashboardCard lazy import
- `frontend/src/routes/session/$sessionId.tsx` - ChatPanel lazy import + Suspense
- `frontend/src/routes/session/new.tsx` - SessionSetupPanel lazy import + Suspense

## 상세 변경 내용

### 1. 백엔드 안정성

- **busy_timeout**: WebSocket + REST API 동시 DB 접근 시 SQLITE_BUSY 에러를 방지하기 위해 5초 대기 설정
- **업로드 파일 정리**: SessionManager에 upload_dir을 주입받아, 세션 삭제 시 해당 세션의 업로드 디렉토리를 shutil.rmtree로 정리

### 2. 시맨틱 색상 토큰 전환

- Sidebar, SessionDashboardCard에서 `bg-green-500`, `bg-red-500`, `border-green-500/30` 등을 `bg-success`, `bg-destructive`, `border-success/30` 등으로 전환
- 프로젝트의 CSS 변수 기반 테마 시스템과 일관성 확보 (index.css의 --success, --destructive 변수 활용)

### 3. WebSocket 스트리밍 성능 최적화

- **RAF 배치**: assistant_text 이벤트를 requestAnimationFrame으로 프레임당 1회만 setMessages 호출 (초당 수십회 → ~60회/초)
- **sendPrompt 안정화**: messages 배열 의존성을 messagesRef로 대체하여 함수 참조를 안정시키고, ChatInput 리렌더 방지

### 4. 코드 스플리팅

- ChatPanel (91.74 kB), SessionSetupPanel (6.09 kB), SessionDashboardCard (3.27 kB) 별도 청크 분리
- 초기 로드 번들 3.1 kB 감소 (193.09 → 189.99 kB)
- Suspense fallback으로 로딩 스켈레톤 적용

## 테스트 방법

1. `cd backend && uv run pytest` - 백엔드 테스트 (166 passed)
2. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` - TypeScript 타입 체크 (에러 없음)
3. `cd frontend && pnpm build` - 프로덕션 빌드 (성공, 경고 없음)

## 비고

- 5단계(선택적 API 키 인증)는 사용자 요청에 따라 제외
- 하드코딩 픽셀/크기 217건, useReducer 전체 전환, 에러 응답 통일은 별도 작업으로 분리
