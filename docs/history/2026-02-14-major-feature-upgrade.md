# 작업 이력: 주요 기능 대규모 업그레이드

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 이름 관리, Markdown 내보내기, Markdown 렌더링(구문 강조), Git diff 뷰어, 이미지 업로드, WebSocket 안정성 개선, 메시지 검색 등 다수의 핵심 기능을 추가하고 전반적인 UI를 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - sessions 테이블에 name 컬럼 추가
- `backend/app/schemas/session.py` - UpdateSessionRequest, SessionInfo에 name 필드 추가
- `backend/app/api/dependencies.py` - 서버 재시작 시 stale running 세션 idle 복구
- `backend/app/services/session_manager.py` - runner_tasks 관리 + name 필드 지원
- `backend/app/services/websocket_manager.py` - get_current_turn_events() 추가
- `backend/app/api/v1/endpoints/sessions.py` - name 업데이트 + Markdown 내보내기 API
- `backend/app/api/v1/endpoints/ws.py` - runner_task 중앙 관리, 자동 이름 설정, 이미지 전달, is_running/current_turn_events
- `backend/app/api/v1/endpoints/files.py` - Git diff API + 이미지 업로드 API
- `backend/app/services/claude_runner.py` - 이미지 복사/프롬프트 삽입 + tool_result 잘림 표시
- `backend/pyproject.toml` - python-multipart 의존성 추가

### Frontend

- `frontend/src/components/ui/CodeBlock.tsx` - 코드 블록 (복사 버튼) 컴포넌트
- `frontend/src/components/ui/MarkdownRenderer.tsx` - react-markdown + rehype-highlight 렌더러
- `frontend/src/components/ui/ErrorBoundary.tsx` - 메시지 렌더링 에러 경계
- `frontend/src/features/files/components/DiffViewer.tsx` - Git diff 뷰어 컴포넌트
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 재연결 backoff + loading + is_running 복구
- `frontend/src/features/chat/components/ChatPanel.tsx` - 메시지 검색 + 이미지 전달 + 로딩 스켈레톤
- `frontend/src/features/chat/components/ChatInput.tsx` - 이미지 붙여넣기/드래그/업로드 UI
- `frontend/src/features/chat/components/ChatHeader.tsx` - 검색/내보내기 버튼 + 재연결 상태 표시
- `frontend/src/features/chat/components/MessageBubble.tsx` - Markdown 렌더링 전환 + 타입 개선
- `frontend/src/features/files/components/FilePanel.tsx` - 인라인 diff 미리보기
- `frontend/src/features/files/components/FileViewer.tsx` - Diff/Content 탭 뷰
- `frontend/src/features/session/components/Sidebar.tsx` - SessionItem 분리 + 더블클릭 이름 변경
- `frontend/src/features/session/hooks/useSessions.ts` - renameSession mutation 추가
- `frontend/src/lib/api/sessions.api.ts` - fileDiff, exportMarkdown, uploadImage API
- `frontend/src/types/session.ts` - name 필드
- `frontend/src/types/message.ts` - is_truncated, full_length 필드
- `frontend/src/routes/__root.tsx` - onRename prop 전달
- `frontend/src/index.css` - prose-chat Markdown 스타일 + highlight.js 테마
- `frontend/package.json` - rehype-highlight 의존성
- `frontend/vite.config.ts` - manualChunks에 rehype-highlight/highlight.js 추가

### 기타

- `.gitignore` - .rocket-uploads 제외 추가

## 상세 변경 내용

### 1. 세션 이름 관리

- DB에 `name` 컬럼 추가, CRUD API에서 name 필드 지원
- 첫 프롬프트 전송 시 자동으로 세션 이름 설정 (최대 40자)
- 사이드바에서 더블클릭으로 세션 이름 인라인 편집

### 2. Markdown 내보내기

- `GET /api/sessions/{id}/export` 엔드포인트로 대화를 Markdown 파일로 다운로드
- ChatHeader에 내보내기 버튼 추가

### 3. Markdown 렌더링 시스템

- `FormattedText` 대신 `react-markdown` + `remark-gfm` + `rehype-highlight` 사용
- 코드 블록에 언어 표시 + 복사 버튼 (CodeBlock 컴포넌트)
- Deep Space 테마에 맞는 highlight.js 커스텀 테마 (light/dark)
- prose-chat CSS 클래스로 채팅 내 Markdown 스타일링

### 4. Git diff 뷰어

- `GET /api/sessions/{id}/file-diff/{path}` 엔드포인트
- DiffViewer 컴포넌트: 줄 번호, +/- 표시, 색상 구분
- FilePanel에서 파일 클릭 시 인라인 diff 미리보기
- FileViewer에서 Diff/Content 탭 전환

### 5. 이미지 업로드

- `POST /api/sessions/{id}/upload` 엔드포인트 (MIME 검증, 10MB 제한)
- ChatInput에서 이미지 붙여넣기, 드래그앤드롭, 파일 선택 지원
- 업로드된 이미지를 작업 디렉토리의 .rocket-uploads/에 복사 후 프롬프트에 참조 삽입
- python-multipart 의존성 추가

### 6. WebSocket 안정성 개선

- runner_task를 SessionManager에서 중앙 관리 (WS 연결과 독립적)
- WS 연결 해제 시 runner_task를 취소하지 않음 (Claude 프로세스 유지)
- 서버 재시작 시 stale running 세션을 idle로 자동 복구
- 재연결 시 is_running 상태 + current_turn_events 전송으로 진행 중 작업 복구
- 클라이언트: 지수 백오프 재연결 (최대 10회, 최대 30초 딜레이)
- 연결 상태 UI 개선 (Reconnecting 표시 + 시도 횟수)

### 7. 메시지 검색 + UI 개선

- ChatHeader에 검색 버튼, ChatPanel에 검색 바 추가
- 검색 결과 하이라이트 + 이전/다음 이동 (Enter/화살표)
- ErrorBoundary로 메시지 렌더링 오류 격리
- tool_result 잘림 표시 (is_truncated, full_length)
- MessageBubble 타입 any -> Message 전환
- 로딩 스켈레톤 추가
- Esc키: running이면 정지, idle이면 입력 클리어

## 테스트 방법

1. 세션 생성 후 메시지 전송 → 자동 이름 설정 확인
2. 사이드바에서 세션 이름 더블클릭 → 인라인 편집 확인
3. ChatHeader 내보내기 버튼 → Markdown 파일 다운로드 확인
4. 어시스턴트 응답에서 코드 블록 구문 강조 + 복사 버튼 확인
5. 파일 변경 패널에서 파일 클릭 → 인라인 diff 확인
6. FileViewer에서 Diff/Content 탭 전환 확인
7. ChatInput에 이미지 붙여넣기/드래그 → 미리보기 + 전송 확인
8. WebSocket 끊김 시 재연결 상태 표시 + 자동 복구 확인
9. 검색 바에서 메시지 검색 + Enter로 결과 이동 확인
