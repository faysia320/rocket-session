# 작업 이력: Git Stage/Unstage 기능 추가

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor에서 `git pull --rebase` 실행 시 unstaged changes로 인해 실패하는 문제를 해결하기 위해,
VS Code 스타일의 Staged/Changes 분리 패널과 개별 파일 stage/unstage 기능을 추가했습니다.
Pull 실패 시 안내 메시지도 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/git_service.py` - `unstage_files()` 메서드 추가 (git restore --staged / git reset HEAD)
- `backend/app/schemas/filesystem.py` - `GitUnstageRequest`, `GitUnstageResponse` 스키마 추가
- `backend/app/api/v1/endpoints/filesystem.py` - `POST /api/fs/git-unstage` 엔드포인트 추가

### Frontend

- `frontend/src/types/filesystem.ts` - `GitUnstageResponse` 타입 추가
- `frontend/src/types/index.ts` - `GitUnstageResponse` re-export
- `frontend/src/lib/api/filesystem.api.ts` - `unstageGitFiles()` API 함수 추가
- `frontend/src/features/git-monitor/hooks/useGitActions.ts` - `useStageFiles`, `useUnstageFiles` hooks 추가
- `frontend/src/features/git-monitor/components/GitStatusFileList.tsx` - VS Code 스타일 Staged/Changes 분리 패널로 리팩토링
- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - Pull 에러 메시지 개선

## 상세 변경 내용

### 1. Backend Unstage API

- `GitService.unstage_files(repo_path, files?)` 추가
  - 개별 파일: `git restore --staged -- <files>`
  - 전체: `git reset HEAD`
  - 기존 `stage_files`와 동일한 패턴 (lock, timeout, cross-platform opts)
- `POST /api/fs/git-unstage` 엔드포인트 (기존 git-stage 미러링)

### 2. VS Code 스타일 파일 목록 UI

- `GitStatusFileList`를 "Staged Changes" / "Changes" 두 섹션으로 분리
- 파일 분류: `is_staged` → Staged, `is_unstaged || is_untracked` → Changes
- "MM" 상태 파일은 양쪽 모두 표시 (key prefix로 구분)
- 각 파일에 hover 시 [+] stage / [-] unstage 버튼 표시
- 섹션 헤더에 "Stage All" / "Unstage All" 일괄 처리 버튼

### 3. Pull 에러 메시지 개선

- unstaged/uncommitted changes 에러 감지 시 구체적 안내 메시지 표시
- "먼저 변경사항을 Stage → Commit 후 다시 시도하세요" 가이드 제공

## 테스트 방법

1. Git Monitor에서 워크스페이스 선택
2. 파일 수정 후 Status 탭에서 "Staged Changes" / "Changes" 섹션 분리 확인
3. [+] 버튼으로 개별 파일 stage, [-] 버튼으로 unstage 확인
4. "Stage All" / "Unstage All" 일괄 처리 확인
5. unstaged 상태에서 Pull 클릭 → 안내 메시지 확인
6. Stage → Commit 후 Pull 성공 확인
