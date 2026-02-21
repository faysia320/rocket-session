# 작업 이력: 비동기 성능 최적화 + 레이아웃 개편

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

백엔드 비동기/동시성 처리 개선, 프론트엔드 렌더링 최적화, WebSocket 안정성 강화, 글로벌 TopBar 도입 및 사이드바 레이아웃 개편을 수행했습니다.

## 변경 파일 목록

### Backend - 코드 포맷팅 (ruff format)

- `backend/app/api/v1/endpoints/filesystem.py` - ruff 포맷팅 적용
- `backend/app/api/v1/endpoints/templates.py` - ruff 포맷팅 적용
- `backend/app/models/base.py` - ruff 포맷팅 적용
- `backend/app/models/file_change.py` - ruff 포맷팅 적용
- `backend/app/models/mcp_server.py` - ruff 포맷팅 적용
- `backend/app/models/session.py` - ruff 포맷팅 적용
- `backend/app/models/template.py` - ruff 포맷팅 적용
- `backend/app/repositories/analytics_repo.py` - ruff 포맷팅 적용
- `backend/app/repositories/search_repo.py` - ruff 포맷팅 적용
- `backend/app/repositories/session_repo.py` - ruff 포맷팅 적용
- `backend/app/repositories/tag_repo.py` - ruff 포맷팅 적용
- `backend/app/services/analytics_service.py` - ruff 포맷팅 적용
- `backend/app/services/mcp_service.py` - ruff 포맷팅 적용
- `backend/app/services/tag_service.py` - ruff 포맷팅 적용

### Backend - 비동기/동시성 처리 개선

- `backend/app/main.py` - 라이프사이클 정리 개선
- `backend/app/services/claude_runner.py` - `_build_command` asyncio.to_thread, stderr/wait gather 병렬 처리
- `backend/app/services/filesystem_service.py` - GIT_CROSS_PLATFORM_OPTS, per-repo git lock, to_thread 전환
- `backend/app/services/local_session_scanner.py` - asyncio.gather + Semaphore 병렬 메타데이터 추출
- `backend/app/services/session_manager.py` - kill_process runner task await 추가
- `backend/app/services/usage_service.py` - 에러 응답 short TTL 캐싱 (5초)
- `backend/app/services/websocket_manager.py` - Queue maxsize, fire-and-forget broadcast, 빈 리스트 정리

### Backend - WebSocket 안정성

- `backend/app/api/v1/endpoints/ws.py` - 프롬프트 TOCTOU 방지 (per-session Lock), JSONL auto-start try 블록 이동
- `backend/app/api/v1/endpoints/sessions.py` - 세션 삭제 시 ws_manager.reset_session() 호출

### Frontend - 렌더링 최적화

- `frontend/src/components/ui/MarkdownRenderer.tsx` - useDeferredValue 스트리밍 최적화, 모듈 레벨 플러그인 배열
- `frontend/src/features/files/components/DiffViewer.tsx` - 200줄 이상 diff 가상화 (useVirtualizer)
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - WS_STATUS 타겟 업데이트, WS_TOOL_RESULT 역검색, WS_FILE_CHANGE 500개 제한
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - idle 상태에서만 300+ 메시지 truncation

### Frontend - ChatPanel 성능 최적화

- `frontend/src/features/chat/components/ChatPanel.tsx` - useSessionMutations 분리, messagesRef, ref 기반 커맨드팔레트
- `frontend/src/features/session/hooks/useSessions.ts` - useSessionMutations 훅 추가
- `frontend/src/features/session/hooks/useSessionStats.ts` - isRunning 상태 추가
- `frontend/src/features/session/components/SessionStatsBar.tsx` - isRunning prop 추가

### Frontend - 글로벌 TopBar + 사이드바 개편

- `frontend/src/routes/__root.tsx` - GlobalTopBar 도입, 세션 라우트에서만 사이드바 표시
- `frontend/src/features/session/components/Sidebar.tsx` - 네비게이션/설정 버튼 제거, 단순화
- `frontend/src/features/chat/components/ChatHeader.tsx` - onMenuToggle 제거
- `frontend/src/routes/analytics.tsx` - 레이아웃 조정
- `frontend/src/routes/index.tsx` - 레이아웃 조정
- `frontend/src/features/layout/` - 새 GlobalTopBar 컴포넌트 (신규)

## 상세 변경 내용

### 1. 백엔드 코드 포맷팅

- ruff format을 적용하여 14개 파일의 코드 스타일 통일
- 주로 import 정렬, 줄바꿈, 공백 정리

### 2. 백엔드 비동기/동시성 처리 개선

- `claude_runner.py`: `_build_command`를 `asyncio.to_thread`로 감싸 블로킹 I/O 방지, stderr 읽기와 프로세스 대기를 `asyncio.gather`로 병렬 실행
- `filesystem_service.py`: Git 명령에 `core.fileMode=false` 크로스플랫폼 옵션 추가, 리포지토리별 git lock으로 동시 접근 방지, 디렉토리/스킬 스캔을 `asyncio.to_thread`로 전환
- `local_session_scanner.py`: `asyncio.gather` + `Semaphore(10)`으로 메타데이터 병렬 추출, glob 패턴 재사용
- `websocket_manager.py`: Queue maxsize 10000 설정, 브로드캐스트 fire-and-forget, 빈 연결 리스트 자동 정리

### 3. WebSocket 안정성 강화

- `ws.py`: per-session `asyncio.Lock`으로 프롬프트 중복 전송(TOCTOU) 방지
- `sessions.py`: 세션 삭제 시 `ws_manager.reset_session()` 호출로 리소스 정리

### 4. 프론트엔드 렌더링 최적화

- Markdown 렌더러에 `useDeferredValue` 적용으로 스트리밍 중 부드러운 렌더링
- DiffViewer에 200줄 이상 diff 가상화 스크롤 적용
- WebSocket reducer 최적화 (타겟 업데이트, 역검색, 파일 변경 500개 제한)

### 5. ChatPanel 성능 최적화

- `useSessionMutations` 훅으로 mutation 로직 분리
- messagesRef로 최신 메시지 상태 참조 최적화
- SessionStatsBar에 isRunning 상태 전달

### 6. 글로벌 TopBar 도입 + 사이드바 레이아웃 개편

- 새로운 GlobalTopBar 컴포넌트로 네비게이션 통합
- 사이드바에서 네비게이션/설정 버튼 제거하여 단순화
- 세션 라우트에서만 사이드바 표시하도록 변경

## 관련 커밋

_(커밋 후 업데이트)_

## 테스트 방법

1. 백엔드: `cd backend && uv run pytest`
2. 프론트엔드: `cd frontend && npx tsc -p tsconfig.app.json --noEmit && pnpm build`
3. 세션 생성 후 실시간 스트리밍 동작 확인
4. 대량 diff 파일에서 가상화 스크롤 확인
5. TopBar 네비게이션 동작 확인

## 비고

- 14개 백엔드 파일은 순수 ruff format 변경 (기능 변경 없음)
- WSL2 환경에서 Git `core.fileMode=false` 옵션 추가로 Windows↔Linux 호환성 개선
