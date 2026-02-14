# 작업 이력: Frontend TSX 마이그레이션 및 프로젝트 설정 재구성

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프로젝트 전반의 설정 파일을 재구성하고, Frontend를 JavaScript(JSX)에서 TypeScript(TSX)로 완전 마이그레이션했습니다.
Tailwind CSS + shadcn/ui 디자인 시스템, TanStack Router/Query, Zustand 상태 관리를 도입했습니다.

## 변경 파일 목록

### 프로젝트 설정

- `.gitignore` - gitignore 패턴 전면 개편
- `.gitmessage.txt` - 커밋 메시지 템플릿 추가
- `.mcp.json` - MCP 서버 설정 (Playwright, Serena)
- `.vscode/settings.json` - VS Code 포맷터/린터 설정
- `.vscode/launch.json` - FastAPI 디버그 설정
- `.claude/skills/` - Claude Code 스킬 정의 파일들
- `docker-compose.yml` - Docker 컨테이너 구성
- `claude.md` - 프로젝트 개발 가이드

### Backend

- `backend/pyproject.toml` - 프로젝트명 rocket-session-backend으로 변경

### Frontend (삭제)

- `frontend/src/App.jsx` - JSX 앱 컴포넌트
- `frontend/src/main.jsx` - JSX 엔트리포인트
- `frontend/src/config/env.js` - JS 환경 설정
- `frontend/src/styles/global.css` - 기존 CSS 변수 기반 글로벌 스타일
- `frontend/vite.config.js` - JS Vite 설정
- `frontend/src/components/ui/EmptyState.jsx` - JSX 빈 상태 컴포넌트
- `frontend/src/components/ui/FormattedText.jsx` - JSX 텍스트 포맷 컴포넌트
- `frontend/src/features/chat/components/ChatPanel.jsx` - JSX 채팅 패널
- `frontend/src/features/chat/components/MessageBubble.jsx` - JSX 메시지 버블
- `frontend/src/features/chat/hooks/useClaudeSocket.js` - JS WebSocket 훅
- `frontend/src/features/files/components/FilePanel.jsx` - JSX 파일 패널
- `frontend/src/features/session/components/Sidebar.jsx` - JSX 사이드바
- `frontend/src/features/session/hooks/useSessions.js` - JS 세션 훅
- `frontend/src/lib/api/client.js` - JS API 클라이언트
- `frontend/src/lib/api/sessions.api.js` - JS 세션 API
- `preview.html` - UI 프리뷰 HTML
- `start.sh` - 시작 스크립트

### Frontend (빌드 설정 추가/변경)

- `frontend/index.html` - TSX 엔트리포인트로 변경
- `frontend/package.json` - 의존성 추가 (TanStack, Tailwind, shadcn/ui 등)
- `frontend/pnpm-lock.yaml` - 잠금 파일 갱신
- `frontend/tsconfig.json` - TypeScript 기본 설정
- `frontend/tsconfig.app.json` - 앱 TypeScript 설정 (strict, path aliases)
- `frontend/tsconfig.node.json` - Node TypeScript 설정
- `frontend/vite.config.ts` - Vite + TanStack Router 플러그인
- `frontend/tailwind.config.js` - Tailwind CSS Deep Space 테마
- `frontend/postcss.config.js` - PostCSS 설정
- `frontend/components.json` - shadcn/ui 설정

### Frontend (TSX 소스 추가)

- `frontend/src/main.tsx` - React 엔트리포인트
- `frontend/src/App.tsx` - Provider 래핑 (Query + Router + Tooltip + Toaster)
- `frontend/src/index.css` - Tailwind + Deep Space 테마 (HSL CSS 변수)
- `frontend/src/config/env.ts` - 타입 안전 환경 설정
- `frontend/src/lib/utils.ts` - cn() 유틸리티
- `frontend/src/lib/api/client.ts` - 타입 안전 API 클라이언트
- `frontend/src/lib/api/sessions.api.ts` - 세션 API 함수
- `frontend/src/types/session.ts` - SessionInfo, SessionStatus 타입
- `frontend/src/types/message.ts` - Message, FileChange 타입
- `frontend/src/types/index.ts` - barrel export
- `frontend/src/store/useSessionStore.ts` - Zustand 상태 관리
- `frontend/src/store/index.ts` - barrel export
- `frontend/src/routeTree.gen.ts` - TanStack Router 자동 생성
- `frontend/src/routes/__root.tsx` - 루트 레이아웃
- `frontend/src/routes/index.tsx` - 홈 페이지
- `frontend/src/routes/session/$sessionId.tsx` - 세션 상세 페이지
- `frontend/src/components/ui/*.tsx` - shadcn/ui 컴포넌트 (13개)
- `frontend/src/features/session/components/Sidebar.tsx` - 사이드바
- `frontend/src/features/session/hooks/sessionKeys.ts` - Query 키 팩토리
- `frontend/src/features/session/hooks/useSessions.ts` - 세션 훅
- `frontend/src/features/chat/components/ChatPanel.tsx` - 채팅 패널
- `frontend/src/features/chat/components/MessageBubble.tsx` - 메시지 버블
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - WebSocket 훅
- `frontend/src/features/files/components/FilePanel.tsx` - 파일 패널

## 상세 변경 내용

### 1. 프로젝트 설정 재구성

- `.gitignore`를 Python/Node.js 프로젝트에 맞게 전면 개편
- VS Code 설정 (Ruff for Python, Prettier for TS/JS/CSS)
- Claude Code 스킬 정의 파일 추가 (git-commit, git-worktree 등)
- Docker Compose 구성 추가

### 2. Frontend JSX → TSX 완전 마이그레이션

- 모든 `.jsx` 파일을 `.tsx`로 변환하고 타입 안전성 확보
- 모든 `.js` 파일을 `.ts`로 변환
- `tsconfig.json` 기반 strict TypeScript 설정 적용
- Path aliases (`@/`) 설정

### 3. 빌드 도구 현대화

- Vite + TanStack Router 플러그인 (파일 기반 라우팅)
- Tailwind CSS + PostCSS 설정
- shadcn/ui 컴포넌트 라이브러리 통합

### 4. 상태 관리 아키텍처 도입

- TanStack Query: 서버 상태 (세션 목록, 세션 상세)
- Zustand: 클라이언트 상태 (활성 세션 ID, UI 토글)
- Query 키 팩토리 패턴 적용

### 5. 디자인 시스템 전환

- 기존 CSS 변수 기반 → Tailwind CSS + HSL CSS 변수 (Deep Space 테마)
- shadcn/ui 컴포넌트 (Button, Card, Input, Badge 등 13개)
- 인라인 스타일 → Tailwind 유틸리티 클래스

## 관련 커밋

- (커밋 후 업데이트 예정)

## 테스트 방법

1. Backend: `cd backend && uv run pytest`
2. Frontend 타입 검사: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
3. Frontend 빌드: `cd frontend && pnpm build`

## 비고

- 모든 상태는 인메모리로 관리되며, 서버 재시작 시 초기화됨
- `preview.html`과 `start.sh`는 초기 프로토타입 파일로 더 이상 사용하지 않아 삭제
