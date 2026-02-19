# 작업 이력: Dashboard Git Monitor 패널 추가

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Dashboard Mode 화면을 상하 2분할하여 상단은 기존 세션 카드 그리드, 하단에 Git Repo 모니터링 뷰를 추가했습니다. 지정한 Git 저장소의 현재 브랜치, dirty 상태, 변경 파일 목록, 파일별 diff를 실시간으로 모니터링할 수 있습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/filesystem.py` - GitStatusFile, GitStatusResponse Pydantic 스키마 추가
- `backend/app/services/filesystem_service.py` - get_git_status(), get_file_diff() 서비스 메서드 추가
- `backend/app/api/v1/endpoints/filesystem.py` - GET /api/fs/git-status, GET /api/fs/git-diff 엔드포인트 추가

### Frontend

- `frontend/src/types/filesystem.ts` - GitStatusFile, GitStatusResponse 타입 추가
- `frontend/src/types/index.ts` - 신규 타입 re-export
- `frontend/src/lib/api/filesystem.api.ts` - getGitStatus(), getGitDiff() API 함수 추가
- `frontend/src/store/useSessionStore.ts` - gitMonitorPath 상태 + localStorage persist 추가
- `frontend/src/features/git-monitor/hooks/useGitStatus.ts` - 30초 폴링 훅 (신규)
- `frontend/src/features/git-monitor/components/GitRepoSelector.tsx` - 저장소 경로 선택 UI (신규)
- `frontend/src/features/git-monitor/components/GitStatusFileList.tsx` - 변경 파일 목록 + Collapsible diff (신규)
- `frontend/src/features/git-monitor/components/GitMonitorPanel.tsx` - 하단 모니터 패널 컨테이너 (신규)
- `frontend/src/routes/__root.tsx` - DashboardGrid 상하 분할 (60/40), GitMonitorPanel lazy import

## 상세 변경 내용

### 1. 백엔드 Git Status API

- `GET /api/fs/git-status?path=...`: `git status --porcelain=v1 -u` 결과를 파싱하여 변경 파일 목록(경로, 상태코드, staged/unstaged/untracked 분류) 반환
- `GET /api/fs/git-diff?path=...&file=...`: 세션 비종속 파일 diff 반환. HEAD diff → unstaged → staged → untracked 4단계 폴백

### 2. 프론트엔드 Git Monitor 패널

- DashboardGrid를 `flex-[3]`(상단 60%) / `flex-[2]`(하단 40%) 상하 분할
- 하단 패널 구성: 헤더(타이틀 + 변경 수 Badge + Repo 선택 + 새로고침) → GitInfoCard(브랜치/dirty/ahead·behind) → ScrollArea(변경 파일 목록)
- 파일 항목 클릭 시 Collapsible로 diff lazy 로드 (기존 DiffViewer 재사용)
- GitRepoSelector: DirectoryBrowser Dialog를 열어 경로 선택, 선택한 경로는 localStorage persist
- 30초 자동 폴링 + 수동 새로고침 버튼

### 3. 기존 컴포넌트 재사용

- GitInfoCard, DiffViewer, DirectoryBrowser, ScrollArea, Badge, Collapsible 등 기존 컴포넌트 최대 활용
- useGitInfo 훅 재사용 (500ms 디바운스, 30초 staleTime)

## 테스트 방법

1. Dashboard Mode 진입 (사이드바 하단 LayoutGrid 아이콘)
2. 하단 Git Monitor 패널에서 FolderGit2 아이콘 클릭 → 모니터링할 Git 저장소 선택
3. 브랜치명, dirty/clean 상태, ahead/behind 확인
4. 변경 파일 목록 확인, 파일 클릭 시 diff 확장
5. 새로고침 버튼 또는 30초 자동 폴링으로 최신 상태 반영

## 비고

- 상하 비율은 60/40 고정 (드래그 리사이저 미구현, 추후 react-resizable-panels로 가능)
- GitMonitorPanel은 React.lazy로 코드 스플리팅 (6.34KB 별도 청크)
- 백엔드 pytest 166개 전체 통과, 프론트엔드 타입 검사 + 빌드 성공
