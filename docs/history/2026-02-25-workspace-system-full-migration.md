# 작업 이력: 워크스페이스 시스템 전면 전환

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git clone 기반 워크스페이스 시스템 도입 후 남아있던 이전 `work_dir` 기반 패턴을 전면 워크스페이스 기반으로 전환했습니다. Session FK 제약조건 추가, GlobalSettings/Template 모델 전환, 프론트엔드 UI 컴포넌트 전환을 포함합니다.

## 변경 파일 목록

### Backend - 모델/스키마

- `backend/app/models/session.py` - workspace_id에 ForeignKey 추가, workspace relationship 추가
- `backend/app/models/workspace.py` - sessions 역방향 relationship 추가
- `backend/app/models/global_settings.py` - work_dir → default_workspace_id, additional_dirs → default_additional_workspace_ids
- `backend/app/models/template.py` - work_dir, additional_dirs 컬럼 제거
- `backend/app/schemas/settings.py` - root_dir/work_dir 제거, 워크스페이스 ID 기반으로 전환
- `backend/app/schemas/template.py` - work_dir/additional_dirs 필드 제거

### Backend - 서비스/API

- `backend/app/services/workspace_service.py` - 모듈 레벨 WORKSPACES_ROOT 제거, constructor 파라미터화, 삭제 시 영향 세션 경고 로그
- `backend/app/services/filesystem_service.py` - scan-git-repos 스캔 경로를 root_dir.parent → root_dir로 수정
- `backend/app/services/settings_service.py` - work_dir → default_workspace_id, additional_dirs → default_additional_workspace_ids
- `backend/app/services/template_service.py` - work_dir 참조 제거, fallback_model 누락 수정
- `backend/app/api/dependencies.py` - WorkspaceService에 settings.workspaces_root 전달
- `backend/app/api/v1/endpoints/settings.py` - root_dir 반환 제거, git_service 의존성 제거
- `backend/app/api/v1/endpoints/sessions.py` - workspace_id 필수화, Settings 의존성 제거
- `backend/app/api/v1/endpoints/templates.py` - work_dir 제거, fallback_model 추가

### Backend - 마이그레이션

- `backend/migrations/versions/20260225_0012_add_workspace_id_fk.py` - sessions.workspace_id FK 제약조건 추가
- `backend/migrations/versions/20260225_0013_settings_workspace_migration.py` - global_settings/session_templates 컬럼 전환

### Frontend - 타입

- `frontend/src/types/settings.ts` - root_dir/work_dir → default_workspace_id/default_additional_workspace_ids
- `frontend/src/types/template.ts` - work_dir/additional_dirs 필드 제거
- `frontend/src/types/index.ts` - workspace 타입 barrel export 추가

### Frontend - 컴포넌트

- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - DirectoryPicker → WorkspaceSelector
- `frontend/src/features/session/components/SessionSettings.tsx` - DirectoryPicker → WorkspaceSelector + useWorkspaces
- `frontend/src/features/template/components/TemplateFormDialog.tsx` - WORKING DIRECTORY / ADDITIONAL DIRECTORIES UI 제거
- `frontend/src/features/template/components/TemplateListDialog.tsx` - work_dir 표시 제거
- `frontend/src/features/directory/components/DirectoryPicker.tsx` - useGlobalSettings/root_dir 참조 제거

## 상세 변경 내용

### 1. Session.workspace_id ForeignKey + Relationship

- Plain String이던 workspace_id에 `ForeignKey("workspaces.id", ondelete="SET NULL")` 추가
- 워크스페이스 삭제 시 dangling reference 대신 자동 NULL 처리
- Session ↔ Workspace 양방향 relationship 추가 (lazy="raise")

### 2. scan-git-repos 스캔 경로 수정

- root_dir(`/workspaces`)의 부모(`/`)를 스캔하여 전체 파일시스템을 탐색하던 문제 수정
- 워크스페이스 모델에서 각 저장소가 `/workspaces/<id>/`에 위치하므로 root_dir 자체 스캔이 정확

### 3. WorkspaceService 설정 패턴 정리

- 모듈 레벨 `WORKSPACES_ROOT` 환경변수 참조를 constructor 파라미터로 교체
- dependencies.py에서 `settings.workspaces_root` 명시 전달
- delete_workspace()에 영향 받는 세션 수 경고 로그 추가

### 4. GlobalSettings 워크스페이스 전환

- `work_dir` → `default_workspace_id` (워크스페이스 ID 참조)
- `additional_dirs` → `default_additional_workspace_ids` (워크스페이스 ID 배열)
- `root_dir` 응답 필드 제거 (git_service 의존성 불필요)
- 세션 생성 시 workspace_id 필수화 (없으면 400 에러)

### 5. Template 워크스페이스 전환

- 템플릿에서 work_dir/additional_dirs 완전 제거 (워크스페이스는 세션 생성 시 선택)
- fallback_model 필드 누락 수정

### 6. Frontend UI 전환

- GlobalSettingsDialog: DirectoryPicker → WorkspaceSelector (기본/추가 워크스페이스)
- SessionSettings: DirectoryPicker → WorkspaceSelector + local_path 역매칭
- TemplateFormDialog: 작업 디렉토리 관련 UI 섹션 완전 제거
- DirectoryPicker: root_dir 참조 제거

## 테스트 방법

1. Docker 이미지 재빌드 + 컨테이너 재시작 (마이그레이션 자동 실행)
2. 글로벌 설정에서 기본 워크스페이스 선택 확인
3. 새 세션 생성 시 워크스페이스 필수 확인
4. 세션 설정에서 추가 워크스페이스 선택/저장 확인
5. 템플릿 생성/수정에서 작업 디렉토리 UI 없음 확인

## 비고

- 하위 호환성 불필요 - 모든 관련 코드를 워크스페이스 기반으로 전환
- 기존 데이터는 마이그레이션에서 고아 workspace_id NULL 처리
