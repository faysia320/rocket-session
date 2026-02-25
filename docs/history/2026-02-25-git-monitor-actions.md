# 작업 이력: Git Monitor Branch/Push/Pull/Commit 기능 추가

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor 페이지 액션 바에 브랜치 변경, Push, Pull, Commit 기능을 추가했습니다.
Commit은 수동 메시지 입력 모드와 AI 커밋(/git-commit 스킬) 모드 중 선택 가능합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/git_service.py` - `list_branches()`, `checkout_branch()` 메서드 추가
- `backend/app/schemas/filesystem.py` - Git Branch/Stage/Commit 관련 6개 스키마 추가
- `backend/app/api/v1/endpoints/filesystem.py` - 4개 엔드포인트 추가 (git-branches, git-checkout, git-stage, git-commit)

### Frontend

- `frontend/src/types/filesystem.ts` - 4개 응답 타입 추가
- `frontend/src/types/index.ts` - 타입 export 추가
- `frontend/src/lib/api/filesystem.api.ts` - 4개 API 클라이언트 메서드 추가
- `frontend/src/features/git-monitor/hooks/useGitActions.ts` - useGitBranches, useCheckoutBranch, useStageAndCommit 훅
- `frontend/src/features/git-monitor/components/BranchSelect.tsx` - Popover+Command 기반 브랜치 선택 컴포넌트
- `frontend/src/features/git-monitor/components/CommitDialog.tsx` - 수동/AI 커밋 모드 선택 다이얼로그
- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - 액션 바에 BranchSelect, Pull, Push, Commit 버튼 통합

## 상세 변경 내용

### 1. 백엔드 Git 브랜치 관리 API

- `list_branches()`: `git branch --list --format=%(refname:short)` + `git branch --show-current`로 로컬 브랜치 목록과 현재 브랜치 조회
- `checkout_branch()`: `git checkout <branch>` 실행, 성공 시 캐시 무효화
- Stage/Commit API: 기존 `stage_files()`와 `commit()` 메서드를 REST 엔드포인트로 노출
- Push/Pull: 기존 workspace sync API 재사용

### 2. 브랜치 선택 UI (BranchSelect)

- Popover + Command(cmdk) 패턴으로 검색 가능한 브랜치 목록
- 현재 브랜치에 체크 표시, 다른 브랜치 선택 시 checkout mutation 실행
- dirty 상태에서 checkout 실패 시 toast 에러 메시지

### 3. 커밋 다이얼로그 (CommitDialog)

- 수동 커밋: Textarea에 메시지 입력 → Stage All + Commit API 직접 호출
- AI 커밋: 세션 생성 → /git-commit 스킬 자동 실행 (기존 GitMonitorRepoSection 패턴 재사용)
- Ctrl+Enter 단축키로 수동 커밋 실행

### 4. 액션 바 레이아웃 변경

- 기존: `[이름] [브랜치Badge] [dirty] [ahead/behind] [PR] ... [⋮삭제]`
- 변경: `[이름] [BranchSelect▾] [dirty] [ahead/behind] [PR] ... [Pull] [Push] [Commit] [⋮삭제]`
- hooks를 early return 전으로 이동하여 React rules of hooks 린트 에러 해결

## 테스트 방법

1. Git Monitor 페이지에서 워크스페이스 선택
2. BranchSelect 클릭 → 브랜치 목록 표시 → 다른 브랜치 선택 시 checkout 확인
3. Pull 버튼 → git pull --rebase 실행 확인
4. Push 버튼 → git push 실행 확인
5. Commit 버튼 → 다이얼로그에서 수동/AI 모드 전환 확인
6. 수동 커밋: 메시지 입력 → Stage All & Commit 성공 확인
7. AI 커밋: 세션 열기 → 새 세션에서 /git-commit 자동 실행 확인
