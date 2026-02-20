# 작업 이력: Alembic 마이그레이션 도입 및 Git Monitor 커밋 기능

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Backend의 DB 스키마 관리를 인라인 마이그레이션에서 Alembic 기반으로 전환하고, Frontend의 Git Monitor에서 직접 커밋을 실행할 수 있는 기능을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - Alembic 프로그래매틱 마이그레이션으로 리팩토링
- `backend/pyproject.toml` - alembic, sqlalchemy 의존성 추가
- `backend/uv.lock` - lockfile 갱신
- `backend/Dockerfile` - Alembic 설정/마이그레이션 파일 복사 추가
- `backend/alembic.ini` - Alembic 설정 파일 (신규)
- `backend/migrations/` - Alembic 마이그레이션 디렉토리 (신규)
- `backend/tests/conftest.py` - 파일 기반 DB fixture로 변경 (Alembic 호환)
- `backend/tests/test_api_endpoints.py` - 파일 기반 DB fixture로 변경
- `backend/tests/test_database.py` - 파일 기반 DB fixture로 변경

### Frontend

- `frontend/src/store/useSessionStore.ts` - pendingPrompt 상태 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - pendingPrompt 자동 전송 로직
- `frontend/src/features/git-monitor/components/GitMonitorRepoSection.tsx` - 커밋 버튼 추가

## 상세 변경 내용

### 1. Alembic 마이그레이션 시스템 도입

- 기존 인라인 ALTER TABLE 마이그레이션을 Alembic으로 전환
- `database.py`의 `_run_migrations()` 메서드에서 Alembic을 프로그래매틱으로 실행
- 초기 마이그레이션(`20260220_0001_initial_schema.py`)에 전체 스키마 포함
- 기존 DB 호환: `_ensure_migration_integrity()`로 stamp 복구
- 테스트에서 `:memory:` DB 대신 `tmp_path` 파일 기반 DB 사용 (Alembic 호환)

### 2. Git Monitor 커밋 기능

- Git Monitor 저장소 섹션에 커밋 버튼(GitCommit 아이콘) 추가
- 변경사항이 있을 때만 표시, hover 시 나타남
- 클릭 시 해당 work_dir로 새 세션을 생성하고 `/git-commit` 프롬프트 자동 전송
- Zustand store에 `pendingPrompt` 상태 추가로 세션 생성 → 프롬프트 전송 흐름 지원
- ChatPanel에서 WebSocket 연결 후 pendingPrompt 자동 전송 및 클리어

## 관련 커밋

- Refactor: Alembic 마이그레이션 시스템 도입
- Feat: Git Monitor 커밋 기능 및 pendingPrompt 지원

## 테스트 방법

1. Backend: `uv run pytest` - 파일 기반 DB fixture로 테스트 통과 확인
2. Frontend: Git Monitor에서 변경사항 있는 저장소의 커밋 버튼 클릭 → 새 세션 생성 및 /git-commit 자동 실행 확인
