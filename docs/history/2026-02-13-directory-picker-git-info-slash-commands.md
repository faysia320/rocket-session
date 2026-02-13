# 작업 이력: 디렉토리 선택기 + Git 정보 + 워크트리 + 슬래시 명령어

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 생성 시 디렉토리를 시각적으로 탐색하고 Git 정보를 표시하는 디렉토리 선택기, Git worktree 관리 기능, 채팅 입력에서 "/" 키로 빠른 명령어를 실행할 수 있는 슬래시 명령어 시스템을 추가했습니다.

## 변경 파일 목록

### Backend (신규)

- `backend/app/schemas/filesystem.py` - 파일시스템/Git/워크트리 Pydantic 스키마
- `backend/app/services/filesystem_service.py` - 디렉토리 탐색 + Git 명령 실행 서비스
- `backend/app/api/v1/endpoints/filesystem.py` - FS API 엔드포인트 (4개)

### Backend (수정)

- `backend/app/api/dependencies.py` - FilesystemService DI 추가
- `backend/app/api/v1/api.py` - filesystem 라우터 등록
- `backend/app/main.py` - Windows asyncio ProactorEventLoop 설정
- `backend/app/services/claude_runner.py` - CLAUDECODE 환경변수 제거, 에러 로깅 개선

### Frontend (신규)

- `frontend/src/types/filesystem.ts` - FS/Git/Worktree TypeScript 타입
- `frontend/src/lib/api/filesystem.api.ts` - FS API 클라이언트
- `frontend/src/features/directory/hooks/useGitInfo.ts` - Git 정보 debounce 훅
- `frontend/src/features/directory/hooks/useDirectoryBrowser.ts` - 디렉토리 탐색 훅
- `frontend/src/features/directory/hooks/useWorktrees.ts` - 워크트리 관리 훅
- `frontend/src/features/directory/components/GitInfoCard.tsx` - Git 정보 카드
- `frontend/src/features/directory/components/DirectoryBrowser.tsx` - 디렉토리 탐색 Dialog
- `frontend/src/features/directory/components/WorktreePanel.tsx` - 워크트리 목록/생성
- `frontend/src/features/directory/components/DirectoryPicker.tsx` - 통합 디렉토리 선택 컴포넌트
- `frontend/src/features/chat/constants/slashCommands.ts` - 슬래시 명령어 레지스트리
- `frontend/src/features/chat/hooks/useSlashCommands.ts` - 슬래시 명령어 훅
- `frontend/src/features/chat/components/SlashCommandPopup.tsx` - 명령어 팝업 UI

### Frontend (수정)

- `frontend/src/types/index.ts` - filesystem 타입 re-export
- `frontend/src/features/session/components/Sidebar.tsx` - Input → DirectoryPicker 교체
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - clearMessages, addSystemMessage 추가
- `frontend/src/features/session/components/SessionSettings.tsx` - controlled open 모드 지원
- `frontend/src/features/chat/components/ChatPanel.tsx` - 슬래시 명령어 통합
- `frontend/src/features/chat/components/MessageBubble.tsx` - 에러 메시지 fallback 개선

## 상세 변경 내용

### 1. 디렉토리 선택기 + Git 정보

- 백엔드: `GET /api/fs/list`, `GET /api/fs/git-info` 엔드포인트로 디렉토리 탐색 및 Git 상태 조회
- 프론트엔드: DirectoryPicker로 Sidebar의 텍스트 입력을 대체, 500ms debounce로 Git 정보 자동 로딩
- GitInfoCard: 브랜치명, dirty/clean 상태, ahead/behind, 최근 커밋 메시지 표시
- DirectoryBrowser: Dialog 기반 시각적 디렉토리 탐색, git repo 아이콘 표시

### 2. 워크트리 옵션

- 백엔드: `GET /api/fs/worktrees`, `POST /api/fs/worktrees` 엔드포인트
- 프론트엔드: WorktreePanel (접을 수 있는 목록 + 새 워크트리 생성 폼)
- 워크트리 선택 시 작업 디렉토리 자동 변경

### 3. 슬래시 명령어

- 6개 명령어: /help, /clear, /compact, /model, /settings, /files
- "/" 입력 시 팝업 표시, 키보드(화살표/Enter/Escape) + 마우스 선택 지원
- 연결 상태/실행 상태에 따라 명령어 가용성 자동 제어

### 4. 기타 개선

- Windows asyncio ProactorEventLoop 설정 (subprocess 지원)
- ClaudeRunner: CLAUDECODE 환경변수 제거 (중첩 세션 방지), --verbose 플래그 추가
- ErrorMessage: fallback 텍스트 개선

## 테스트 방법

1. 백엔드 서버 실행 후 API 테스트:
   - `curl http://localhost:8101/api/fs/list?path=~`
   - `curl http://localhost:8101/api/fs/git-info?path=/path/to/git-repo`
2. 프론트엔드에서 세션 생성 시 디렉토리 탐색기 사용
3. 채팅 입력에서 "/" 타이핑하여 명령어 팝업 확인
