# 작업 이력: Git 브랜치 관리 개선

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor의 BranchSelect에서 브랜치 변경 후 "detached"로 표시되는 문제, 브랜치 목록이 불완전한 문제, 새 세션 생성 시 브랜치 선택 불가 문제를 해결했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/workspace_service.py` - list_all()에 Git 실시간 정보 병렬 조회 추가
- `backend/app/services/git_service.py` - list_branches()에 fetch 옵션 추가 + fetch_remote() 메서드 추가
- `backend/app/schemas/filesystem.py` - GitFetchRequest/GitFetchResponse 스키마 추가
- `backend/app/schemas/session.py` - CreateSessionRequest에 branch 필드 추가
- `backend/app/api/v1/endpoints/filesystem.py` - POST /api/fs/git-fetch 엔드포인트 추가
- `backend/app/api/v1/endpoints/sessions.py` - 세션 생성 시 브랜치 checkout 로직 추가

### Frontend

- `frontend/src/types/filesystem.ts` - GitFetchResponse 타입 추가
- `frontend/src/types/index.ts` - GitFetchResponse re-export
- `frontend/src/lib/api/filesystem.api.ts` - fetchRemote() API 함수 추가
- `frontend/src/lib/api/sessions.api.ts` - create options에 branch 추가
- `frontend/src/features/git-monitor/hooks/useGitActions.ts` - useFetchRemote() 훅 추가
- `frontend/src/features/git-monitor/components/BranchSelect.tsx` - Fetch 버튼 추가
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 브랜치 선택 UI 추가

## 상세 변경 내용

### 1. 워크스페이스 목록에 Git 실시간 정보 포함 (문제 1 해결)

- `WorkspaceService.list_all()`이 DB 필드만 반환하여 `current_branch`가 항상 undefined였음
- ready 워크스페이스에 대해 `asyncio.gather`로 Git 정보(branch, is_dirty, ahead, behind)를 병렬 조회하도록 변경
- Git Monitor 및 워크스페이스 목록에서 현재 브랜치가 즉시 표시됨

### 2. 브랜치 목록 완전성 개선 (문제 2 해결)

- `list_branches()`에 `fetch: bool = True` 파라미터 추가
- 브랜치 목록 조회 전 `git fetch --prune --quiet` 자동 실행으로 원격 ref 갱신
- 원격 브랜치(`git branch -r`)도 로컬에 없는 것만 목록에 포함
- `POST /api/fs/git-fetch` 엔드포인트 + `fetchRemote()` API + `useFetchRemote()` 훅 추가
- BranchSelect 드롭다운에 Fetch(새로고침) 버튼 추가하여 수동 갱신 가능

### 3. 새 세션 생성 시 브랜치 선택 (문제 3 해결)

- `CreateSessionRequest`에 `branch: Optional[str]` 필드 추가
- 세션 생성 시 `branch` 지정되면 워크트리 생성 전 `checkout_branch()` 실행
- SessionSetupPanel에 워크스페이스 선택 후 브랜치 Select UI 추가
- 워크스페이스 변경 시 브랜치 선택 자동 초기화

## 관련 커밋

- (이 문서와 함께 커밋)

## 테스트 방법

1. Git Monitor에서 워크스페이스 선택 → 현재 브랜치 이름이 정상 표시되는지 확인 (detached 아님)
2. BranchSelect에서 다른 브랜치 선택 → 표시 텍스트가 즉시 갱신되는지 확인
3. BranchSelect Fetch 버튼 클릭 → 원격 브랜치가 새로 표시되는지 확인
4. New Session에서 워크스페이스 선택 → 브랜치 목록이 로드되는지 확인
5. 다른 브랜치 선택 후 세션 생성 → 해당 브랜치에서 세션이 시작되는지 확인
