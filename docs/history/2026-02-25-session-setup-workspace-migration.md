# 작업 이력: SessionSetupPanel Working Directory → Workspace 전환

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 생성 화면(SessionSetupPanel)에서 디렉토리 기반 입력(Working Directory, Additional Directories)을 워크스페이스 기반으로 전환했습니다. DirectoryPicker를 제거하고 WorkspaceSelector로 통합하여 워크스페이스 중심 UX를 완성했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workspace/components/WorkspaceSelector.tsx` - excludeIds prop 추가 (중복 선택 방지)
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - DirectoryPicker 제거, 워크스페이스 기반 UI로 전환

## 상세 변경 내용

### 1. WorkspaceSelector에 excludeIds prop 추가

- `excludeIds?: string[]` optional prop 추가
- readyWorkspaces 필터링에 excludeIds 제외 로직 추가
- 기존 사용처에는 영향 없음 (optional prop)

### 2. SessionSetupPanel 워크스페이스 기반 전환

**제거 항목:**
- `workDir` / `setWorkDir` state
- `useGitInfo` 훅 import 및 호출
- `DirectoryPicker` import 및 WORKING DIRECTORY 섹션 전체
- `additionalDirs` state
- `FolderPlus` 아이콘 import

**변경 항목:**
- `additionalDirs: string[]` → `additionalWorkspaceIds: string[]`
- ADDITIONAL DIRECTORIES → ADDITIONAL WORKSPACES (DirectoryPicker → WorkspaceSelector)
- GIT WORKTREE 조건: `gitInfo?.is_git_repo` → `selectedWorkspaceId` (워크스페이스는 항상 Git 저장소)
- WORKSPACE 라벨에 `*` (필수) 표시 추가
- `handleCreate`: additionalWorkspaceIds → readyWorkspaces에서 local_path 변환 → additional_dirs로 전달
- `handleCreate`: workDir 대신 항상 undefined 전달
- Create 버튼 disabled 조건: `!selectedWorkspaceId` (워크스페이스 필수)
- 템플릿 적용: work_dir, additional_dirs는 경로 기반이므로 UI에 반영하지 않음
- 글로벌 설정: work_dir 기본값 적용 로직 제거
- 메인/추가 워크스페이스 간 excludeIds로 중복 선택 방지

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. `/session/new` 접속 → Working Directory 섹션이 없는지 확인
2. 워크스페이스 선택 → GIT WORKTREE 옵션 표시 확인
3. Additional Workspaces에서 워크스페이스 추가/제거 확인
4. 메인 워크스페이스가 Additional에서 제외되는지 확인
5. 워크스페이스 미선택 시 Create 버튼 비활성화 확인

## 비고

- 백엔드 변경 없음 (기존 work_dir/additional_dirs 필드 그대로 활용)
- onCreate 콜백 시그니처 유지 (workDir 파라미터는 항상 undefined 전달)
