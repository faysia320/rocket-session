# 작업 이력: WORKSPACES_ROOT 환경변수 제거 → 코드 상수화

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

`WORKSPACES_ROOT` 환경변수를 제거하고 코드 내 상수(`WORKSPACES_ROOT = "/workspaces"`)로 전환했습니다.
Docker 컨테이너 내부 경로는 사용자가 커스터마이징할 이유가 없으므로, 환경변수가 아닌 상수로 충분합니다.

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` - `workspaces_root` Settings 필드 + `model_validator` 제거, 모듈 레벨 상수 추가
- `backend/app/api/dependencies.py` - `settings.workspaces_root` → `WORKSPACES_ROOT` 상수 (3곳)
- `backend/entrypoint.sh` - `"${WORKSPACES_ROOT:-/workspaces}"` → `/workspaces` 하드코딩
- `backend/.env.example` - `WORKSPACES_ROOT` 행 삭제
- `backend/tests/conftest.py` - `os.environ["WORKSPACES_ROOT"]` 삭제, Settings fixture 정리
- `backend/tests/test_api_endpoints.py` - Settings fixture에서 `workspaces_root=` 제거

### Infrastructure

- `docker-compose.yml` - `WORKSPACES_ROOT=/workspaces` 환경변수 행 삭제
- `cli/templates/docker-compose.yml` - 볼륨 `/projects` → `/workspaces` 통일, `WORKSPACES_ROOT` 행 삭제

### 문서

- `CLAUDE.md` - 환경변수 섹션에서 `WORKSPACES_ROOT` 행 삭제
- `README.md` - 환경변수 섹션에서 `WORKSPACES_ROOT` 행 삭제, `.env` 안내 수정

## 상세 변경 내용

### 1. Settings 필드 제거 + 상수 추가

- `config.py`에서 `workspaces_root` Pydantic 필드와 레거시 `CLAUDE_WORK_DIR` 마이그레이션 validator 삭제
- `import os`, `from pydantic import model_validator` 불필요 import 제거
- 모듈 레벨 상수 `WORKSPACES_ROOT = "/workspaces"` 추가

### 2. 의존성 주입 상수 전환

- `dependencies.py`에서 `settings.workspaces_root` 참조 3곳을 `WORKSPACES_ROOT` 상수로 교체
- `FilesystemService`, `GitService`, `WorkspaceService` 생성자에 전달하는 값 변경

### 3. Docker/CI 환경변수 정리

- `docker-compose.yml`, `cli/templates/docker-compose.yml`, `entrypoint.sh`, `.env.example`에서 환경변수 참조 제거
- CLI 템플릿의 볼륨 경로를 `/projects` → `/workspaces`로 통일

## 수정 불필요 파일

- `workspace_service.py`, `filesystem_service.py`, `git_service.py` - constructor 파라미터로 받으므로 변경 없음
- `docs/history/` 과거 기록 - 역사적 기록 유지

## 비고

- 이 변경은 `CLAUDE_WORK_DIR` → `WORKSPACES_ROOT` 마이그레이션 (51890c0) 이후 최종 단계입니다
- 환경변수 3단계 전환: `CLAUDE_WORK_DIR` → `WORKSPACES_ROOT` (환경변수) → `WORKSPACES_ROOT` (코드 상수)
