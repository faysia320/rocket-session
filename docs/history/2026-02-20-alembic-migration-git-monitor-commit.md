# 작업 이력: Alembic 마이그레이션 도입 + Git Monitor 커밋 버튼

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Backend에 Alembic 마이그레이션 시스템을 도입하여 DB 스키마 관리를 체계화하고,
Frontend에 Git Monitor에서 직접 커밋 세션을 시작할 수 있는 버튼과 pendingPrompt 메커니즘을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - Alembic 마이그레이션 기반으로 DB 초기화 리팩토링
- `backend/pyproject.toml` - alembic, sqlalchemy 의존성 추가
- `backend/uv.lock` - 의존성 잠금 파일 업데이트
- `backend/Dockerfile` - Alembic 마이그레이션 파일 복사 추가
- `backend/alembic.ini` - Alembic 설정 파일 (신규)
- `backend/migrations/` - Alembic 마이그레이션 디렉토리 (신규)
- `backend/tests/conftest.py` - 테스트 DB를 파일 기반으로 변경 (Alembic 호환)
- `backend/tests/test_api_endpoints.py` - 테스트 DB를 파일 기반으로 변경
- `backend/tests/test_database.py` - 테스트 DB를 파일 기반으로 변경

### Frontend

- `frontend/src/store/useSessionStore.ts` - pendingPrompt 상태 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - pendingPrompt 자동 전송 로직
- `frontend/src/features/git-monitor/components/GitMonitorRepoSection.tsx` - 커밋 버튼 추가

## 상세 변경 내용

### 1. Alembic 마이그레이션 시스템 도입

- `database.py`의 초기화 로직을 Alembic 기반으로 리팩토링
- 기존 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` 패턴에서 Alembic `upgrade head` 방식으로 전환
- 기존 DB와의 호환성을 위한 `_ensure_migration_integrity()` 메서드 추가
- 테스트 fixtures를 `:memory:`에서 파일 기반 tmp_path로 변경 (Alembic이 파일 경로 필요)

### 2. Git Monitor 커밋 버튼

- Git Monitor 저장소 섹션에 커밋 아이콘 버튼 추가 (변경사항 있을 때만 표시)
- 클릭 시 해당 디렉토리로 새 세션을 생성하고 `/git-commit` 프롬프트를 자동 전송
- `pendingPrompt` 메커니즘: Zustand store에 프롬프트를 저장해두고 WebSocket 연결 후 자동 전송

## 관련 커밋

- 커밋 후 해시 기재 예정

## 테스트 방법

1. Backend: `cd backend && uv run pytest` - Alembic 기반 DB 초기화 테스트
2. Frontend: Git Monitor에서 변경사항 있는 저장소의 커밋 버튼 클릭 → 새 세션 생성 후 `/git-commit` 자동 실행 확인

## 비고

- Alembic 마이그레이션은 `backend/migrations/versions/` 디렉토리에 버전별로 관리됩니다
- Docker 빌드 시 alembic.ini와 migrations/ 디렉토리가 포함되어야 합니다
