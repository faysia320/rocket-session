# 작업 이력: 세션 워크트리 전환 기능 + Git Monitor 확장 + UI 개선

- **날짜**: 2026-02-22
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

기존 세션의 작업 디렉토리를 Git 워크트리로 전환하는 기능을 구현했습니다. 대화 기록과 Claude CLI 컨텍스트를 모두 보존하면서 `work_dir`만 워크트리 경로로 변경합니다. 또한 Git Monitor 페이지에 커밋 히스토리, GitHub PR 조회 기능을 확장하고, 대시보드/메시지 UI를 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/session.py` - `ConvertToWorktreeRequest` 스키마 추가, `UpdateSessionRequest`에 `work_dir` 필드 추가
- `backend/app/services/session_manager.py` - `update_settings()`에 `work_dir` 파라미터 추가
- `backend/app/api/v1/endpoints/sessions.py` - `POST /convert-to-worktree` 엔드포인트 추가, PATCH에 `work_dir` 전달
- `backend/app/api/v1/endpoints/filesystem.py` - Git log, GitHub PR, git status 엔드포인트 추가
- `backend/app/schemas/filesystem.py` - Git log, GitHub PR, git status 관련 스키마 추가
- `backend/app/services/filesystem_service.py` - Git log, GitHub CLI, git status 서비스 메서드 추가

### Frontend

- `frontend/src/types/session.ts` - `ConvertToWorktreeRequest` 타입 추가
- `frontend/src/types/index.ts` - barrel export 업데이트
- `frontend/src/lib/api/sessions.api.ts` - `convertToWorktree()` API 함수 추가
- `frontend/src/features/chat/components/GitDropdownMenu.tsx` - "워크트리로 전환" 메뉴 항목 + 브랜치명 입력 Dialog
- `frontend/src/features/chat/components/ChatHeader.tsx` - `onConvertToWorktree` prop relay
- `frontend/src/features/chat/components/ChatPanel.tsx` - `handleConvertToWorktree` 핸들러
- `frontend/src/types/filesystem.ts` - Git log, GitHub PR, git status 타입 추가
- `frontend/src/lib/api/filesystem.api.ts` - Git log, PR, status API 함수 추가
- `frontend/src/features/git-monitor/` - Git Monitor 페이지 컴포넌트 및 훅 (신규)
- `frontend/src/routes/git-monitor.tsx` - Git Monitor 라우트 (신규)
- `frontend/src/features/dashboard/components/DashboardGrid.tsx` - 대시보드 레이아웃 개선
- `frontend/src/features/chat/components/MessageBubble.tsx` - 메시지 UI 개선
- `frontend/src/features/chat/components/toolMessageUtils.ts` - 도구 메시지 유틸 확장

## 상세 변경 내용

### 1. 세션 워크트리 전환 기능

- `POST /api/sessions/{id}/convert-to-worktree` 엔드포인트 추가
- idle 상태 검증, 워크트리 생성, 세션 work_dir 업데이트를 원자적으로 처리
- GitDropdownMenu에 "워크트리로 전환" 메뉴와 브랜치명 입력 Dialog 추가
- 전환 후 WebSocket 재연결로 UI 자동 갱신

### 2. Git Monitor 확장

- Git log (커밋 히스토리) 조회 API 및 UI
- GitHub PR 목록/상세 조회 API 및 UI
- Git status (변경 파일 목록) API 및 UI

### 3. UI 개선

- 대시보드 그리드 레이아웃 개선
- 메시지 버블 및 도구 메시지 표시 개선
- 명령 팔레트 네비게이션 업데이트

## 테스트 방법

1. Git 저장소 경로로 세션 생성 (워크트리 없이)
2. GitDropdownMenu 열기 → "워크트리로 전환" 클릭
3. 새 브랜치명 입력 → "전환" 클릭
4. 헤더의 작업 디렉토리 경로 및 브랜치명 변경 확인
5. 이전 대화 기록 보존 확인
