# 작업 이력: 워크트리 생성 방식을 claude -w로 변경

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

기존 `cwd=worktree_path` 방식의 워크트리 세션 생성을 Claude Code CLI의 네이티브 `-w` (--worktree) 플래그 방식으로 전면 교체했습니다.
`claude -w <name>`은 `<repo>/.claude/worktrees/<name>/` 경로에 워크트리를 생성하고 `worktree-<name>` 브랜치를 자동 생성합니다.

## 변경 파일 목록

### Backend

- `backend/app/models/session.py` - `worktree_name` nullable 컬럼 추가
- `backend/migrations/versions/20260223_...` - Alembic 마이그레이션 (sessions 테이블에 worktree_name 추가)
- `backend/app/schemas/session.py` - `CreateSessionRequest`, `UpdateSessionRequest`, `SessionInfo`에 `worktree_name` 추가, `ConvertToWorktreeRequest` 간소화
- `backend/app/schemas/filesystem.py` - `CreateWorktreeRequest` 클래스 삭제
- `backend/app/repositories/session_repo.py` - `_session_to_dict()`에 `worktree_name` 매핑 추가
- `backend/app/services/session_manager.py` - `create()`, `update_settings()`, `to_info()`에 `worktree_name` 처리
- `backend/app/services/claude_runner.py` - `_build_command()`에 `-w` 플래그, `_normalize_file_path()` 워크트리 경로 인식, `create_turn_state()`/`run()` 업데이트
- `backend/app/services/filesystem_service.py` - `create_worktree()`, `remove_worktree()` 삭제 → `remove_claude_worktree()` 신규 추가
- `backend/app/api/v1/endpoints/filesystem.py` - `POST /fs/worktrees` 삭제, `DELETE /fs/worktrees` 파라미터 변경
- `backend/app/api/v1/endpoints/sessions.py` - 세션 생성 시 `worktree_name` 전달, `convert-to-worktree` 간소화

### Frontend

- `frontend/src/types/session.ts` - `worktree_name` 필드 추가, `ConvertToWorktreeRequest` 변경
- `frontend/src/types/filesystem.ts` - `CreateWorktreeRequest` 삭제
- `frontend/src/types/index.ts` - barrel export에서 `CreateWorktreeRequest` 제거
- `frontend/src/lib/api/filesystem.api.ts` - `createWorktree` 삭제, `removeWorktree` 시그니처 변경
- `frontend/src/lib/api/sessions.api.ts` - create options에 `worktree_name` 추가
- `frontend/src/features/session/hooks/useSessions.ts` - `useCreateSession` 타입 업데이트
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - `SessionState`에 `worktree_name` 추가
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - `filesystemApi.createWorktree()` 호출 제거, `worktree_name` options로 전달
- `frontend/src/features/chat/components/ChatPanel.tsx` - `handleRemoveWorktree`, `handleConvertToWorktree` 업데이트
- `frontend/src/features/chat/components/ChatHeader.tsx` - `worktreeName` prop 추가/전달
- `frontend/src/features/chat/components/GitDropdownMenu.tsx` - `gitInfo.is_worktree` → `!!worktreeName`
- `frontend/src/features/chat/components/SessionDropdownMenu.tsx` - `worktreeName` prop, 조건/텍스트 업데이트

## 상세 변경 내용

### 1. 워크트리 생성 방식 변경

- **기존**: `filesystemApi.createWorktree()` → `git worktree add` → `cwd=worktree_path`로 subprocess 실행
- **변경**: 세션에 `worktree_name`만 저장 → `claude -w <name>` 플래그로 CLI가 워크트리 자동 관리
- `work_dir`는 항상 레포 루트 경로를 유지

### 2. 워크트리 삭제 방식 변경

- **기존**: `git worktree remove <path>` + 브랜치 삭제
- **변경**: `.claude/worktrees/<name>` 디렉토리 삭제 + `worktree-<name>` 브랜치 로컬/리모트 삭제
- protected 브랜치(main, master, develop) 삭제 시도 방지

### 3. 워크트리로 전환 (convert-to-worktree) 간소화

- **기존**: `fs.create_worktree()` → `work_dir` 변경 → `manager.update_settings(work_dir=...)`
- **변경**: `manager.update_settings(worktree_name=name)` 만으로 전환 완료 (다음 실행 시 `-w` 플래그 자동 적용)

### 4. 프론트엔드 워크트리 감지 방식 변경

- **기존**: `gitInfo.is_worktree` (git-dir 기반 감지, work_dir이 워크트리 경로여야 동작)
- **변경**: `sessionInfo.worktree_name` (세션 모델 기반 감지, work_dir이 레포 루트여도 정확히 감지)

## 테스트 방법

1. Docker 이미지 재빌드 + 컨테이너 재시작 (Alembic 마이그레이션 자동 적용)
2. 새 세션 생성 시 "GIT WORKTREE" 토글 ON → 워크트리 이름 입력 → 세션 생성
3. 세션 실행 시 Claude가 `-w <name>` 플래그로 워크트리에서 작업하는지 확인
4. Git 메뉴에서 Rebase & Merge, 워크트리 삭제 정상 동작 확인
5. 기존 세션 → "워크트리로 전환" 메뉴로 전환 후 정상 동작 확인

## 비고

- Rebase & Merge는 `/git-merge-rebase` 슬래시 커맨드로 Claude AI가 동적으로 처리하므로 코드 변경 불필요
- `gitInfo.is_worktree` 필드는 백엔드에서 여전히 반환되지만, 프론트엔드에서는 더 이상 워크트리 판단에 사용하지 않음
