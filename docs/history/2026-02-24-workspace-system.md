# 작업 이력: Git Clone 기반 워크스페이스 시스템

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Docker 바인드 마운트(`HOST_PROJECTS_DIR:/projects`) 대신 Git clone 기반 워크스페이스 시스템을 도입하여, 컨테이너 내부에서 네이티브 Linux 파일시스템으로 작업하도록 전환했습니다. Windows 호스트의 `.venv` 손상 문제를 근본적으로 해결합니다.

## 변경 파일 목록

### Backend - 신규

- `backend/app/models/workspace.py` - Workspace ORM 모델 (id, name, repo_url, branch, status 등)
- `backend/app/schemas/workspace.py` - Pydantic Request/Response 스키마
- `backend/app/repositories/workspace_repo.py` - WorkspaceRepository (BaseRepository 상속)
- `backend/app/services/workspace_service.py` - 핵심 서비스 (clone/install/sync/delete)
- `backend/app/api/v1/endpoints/workspaces.py` - REST API (CRUD + sync)
- `backend/migrations/versions/20260224_0011_add_workspaces_table.py` - Alembic 마이그레이션

### Backend - 수정

- `backend/app/models/__init__.py` - Workspace 모델 export 추가
- `backend/app/models/session.py` - workspace_id 컬럼 + 인덱스 추가
- `backend/app/core/config.py` - workspaces_root 설정 추가
- `backend/app/api/dependencies.py` - WorkspaceService DI 등록
- `backend/app/api/v1/api.py` - workspaces 라우터 등록
- `backend/app/api/v1/endpoints/sessions.py` - workspace_id 기반 work_dir 결정
- `backend/app/repositories/session_repo.py` - workspace_id 매핑 추가
- `backend/app/schemas/session.py` - workspace_id 필드 추가
- `backend/app/services/session_manager.py` - create()에 workspace_id 파라미터 추가
- `backend/app/services/git_service.py` - pull(), push() 메서드 추가

### Frontend - 신규

- `frontend/src/types/workspace.ts` - TypeScript 타입 정의
- `frontend/src/lib/api/workspaces.api.ts` - API 클라이언트
- `frontend/src/features/workspace/hooks/useWorkspaces.ts` - TanStack Query 훅
- `frontend/src/features/workspace/components/WorkspaceCreateDialog.tsx` - 생성 다이얼로그
- `frontend/src/features/workspace/components/WorkspaceList.tsx` - 목록 카드 UI
- `frontend/src/features/workspace/components/WorkspaceSelector.tsx` - 셀렉트 드롭다운

### Frontend - 수정

- `frontend/src/types/session.ts` - workspace_id 필드 추가
- `frontend/src/lib/api/sessions.api.ts` - workspace_id 옵션 추가
- `frontend/src/features/session/hooks/useSessions.ts` - workspace_id 지원
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 워크스페이스 셀렉터 UI 추가

### Infra

- `docker-compose.yml` - HOST_PROJECTS_DIR 바인드 마운트 제거, rocket-workspaces volume 추가
- `backend/entrypoint.sh` - FRONTEND_DIR 자동 설치 제거, /workspaces 디렉토리 생성
- `.env.docker.example` - HOST_PROJECTS_DIR/FRONTEND_DIR 제거, 워크스페이스 설명 추가

### Tests

- `backend/tests/conftest.py` - workspaces 테이블 truncate 추가
- `backend/tests/test_api_endpoints.py` - WorkspaceService DI 오버라이드 추가

## 상세 변경 내용

### 1. 문제: Windows 호스트 .venv 손상

- `docker-compose.yml`의 `${HOST_PROJECTS_DIR}:/projects` 바인드 마운트로 Windows 파일시스템이 Linux 컨테이너에 노출
- 컨테이너 내 Claude CLI가 `uv sync` 실행 시 Windows의 `.venv`를 Linux 심볼릭 링크로 덮어씀
- 결과: Windows에서 `.venv` 접근 불가, "액세스가 거부되었습니다" 오류

### 2. 해결: Git clone 기반 워크스페이스

- 바인드 마운트 완전 제거 → Docker named volume(`rocket-workspaces:/workspaces`)로 전환
- 사용자가 Git repo URL을 입력하면 컨테이너 내부에서 `git clone`
- 변경사항은 `git push`로 원격 저장소에 동기화
- Windows 호스트 파일에 컨테이너가 접근하지 않음

### 3. 워크스페이스 생명주기

1. **생성**: POST /api/workspaces/ → status=cloning → 비동기 git clone (10분 타임아웃)
2. **의존성 설치**: clone 후 pyproject.toml/pnpm-lock.yaml 자동 감지 → uv sync/pnpm install 병렬 실행
3. **사용**: 세션 생성 시 workspace_id 지정 → work_dir이 `/workspaces/{id}`로 설정
4. **동기화**: POST /api/workspaces/{id}/sync → git pull --rebase 또는 git push
5. **삭제**: DELETE /api/workspaces/{id} → 파일 + DB 삭제

### 4. Docker 구성 변경

```diff
 backend:
   volumes:
-    - ${HOST_PROJECTS_DIR}:/projects
+    - rocket-workspaces:/workspaces
   environment:
-    - CLAUDE_WORK_DIR=/projects
+    - CLAUDE_WORK_DIR=/workspaces
+    - WORKSPACES_ROOT=/workspaces
-    - FRONTEND_DIR=${FRONTEND_DIR:-}

 volumes:
+  rocket-workspaces:
```

## 테스트 방법

1. `uv run pytest tests/test_api_endpoints.py -v` → 23/23 PASS
2. `cd frontend && pnpm build` → TypeScript + Vite 빌드 성공
3. Docker 배포 후: 워크스페이스 생성 → 세션 연결 → Claude CLI 실행 확인

## 비고

- 하위 호환성 불필요 (HOST_PROJECTS_DIR 완전 제거)
- GITHUB_TOKEN이 entrypoint.sh에서 이미 git-credentials로 설정되므로 HTTPS clone 시 자동 인증
- 의존성 설치 실패는 워크스페이스 생성을 차단하지 않음 (사용자가 수동 설치 가능)
