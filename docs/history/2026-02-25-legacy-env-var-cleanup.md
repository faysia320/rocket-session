# 작업 이력: 레거시 CLAUDE_WORK_DIR 환경변수 정리

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크스페이스 시스템 전면 전환 후 남아있던 레거시 `CLAUDE_WORK_DIR` 환경변수 참조를 `WORKSPACES_ROOT`로 전환했습니다. Backend 설정, Docker Compose, 환경변수 예제 파일, 테스트, 문서를 모두 업데이트합니다.

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` - `claude_work_dir` 필드 제거, `model_validator`로 레거시 하위 호환 유지
- `backend/app/api/dependencies.py` - `settings.claude_work_dir` → `settings.workspaces_root`
- `backend/tests/conftest.py` - 테스트 환경변수/Settings에서 `claude_work_dir` → `workspaces_root`
- `backend/tests/test_api_endpoints.py` - 테스트 Settings에서 `claude_work_dir` → `workspaces_root`
- `backend/.env.example` - `CLAUDE_WORK_DIR` → `WORKSPACES_ROOT`

### Docker/설정

- `docker-compose.yml` - `CLAUDE_WORK_DIR` 환경변수 제거 (중복)
- `cli/templates/docker-compose.yml` - `CLAUDE_WORK_DIR` → `WORKSPACES_ROOT`
- `.env.docker.example` - `CLAUDE_WORK_DIR` 제거

### 문서

- `README.md` - 환경변수 설명 업데이트
- `claude.md` - 환경 설정 섹션 업데이트

## 상세 변경 내용

### 1. Backend Settings 레거시 호환

- `claude_work_dir` 필드를 완전 제거하고 `workspaces_root`만 유지
- `model_validator`로 기존 `CLAUDE_WORK_DIR` 환경변수가 있을 경우 자동으로 `workspaces_root`에 매핑
- 이전 설정 파일을 사용하는 환경에서도 정상 동작 보장

### 2. FilesystemService/GitService 초기화

- `dependencies.py`에서 `settings.claude_work_dir` → `settings.workspaces_root` 직접 참조

### 3. Docker/환경 설정 정리

- `docker-compose.yml`에서 중복된 `CLAUDE_WORK_DIR` 제거 (`WORKSPACES_ROOT`만 유지)
- CLI 템플릿과 예제 파일에서 일관된 환경변수명 사용

## 테스트 방법

1. `backend/tests/` 테스트 실행: `cd backend && uv run pytest`
2. Docker Compose 빌드 + 실행 확인
3. 기존 `CLAUDE_WORK_DIR` 환경변수가 설정된 환경에서 하위 호환 확인

## 비고

- `model_validator`로 레거시 환경변수 하위 호환을 유지하므로 기존 배포 환경에서 즉시 문제 발생하지 않음
