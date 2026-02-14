# 작업 이력: Prettier + Ruff 코드 포맷팅 적용

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Frontend에 Prettier, Backend에 Ruff format + lint fix를 적용하여 전체 코드베이스의 포맷팅을 통일했습니다.

## 변경 파일 목록

### Backend (15개 파일 리포맷)

- `backend/app/api/dependencies.py` - Ruff 포맷팅
- `backend/app/api/v1/endpoints/files.py` - Ruff 포맷팅
- `backend/app/api/v1/endpoints/filesystem.py` - Ruff 포맷팅
- `backend/app/api/v1/endpoints/local_sessions.py` - Ruff 포맷팅
- `backend/app/api/v1/endpoints/sessions.py` - Ruff 포맷팅
- `backend/app/api/v1/endpoints/ws.py` - Ruff 포맷팅
- `backend/app/core/database.py` - Ruff 포맷팅
- `backend/app/main.py` - Ruff 포맷팅 + E402 noqa 주석 추가
- `backend/app/services/claude_runner.py` - Ruff 포맷팅
- `backend/app/services/filesystem_service.py` - Ruff 포맷팅
- `backend/app/services/jsonl_watcher.py` - Ruff 포맷팅
- `backend/app/services/local_session_scanner.py` - Ruff 포맷팅
- `backend/app/services/session_manager.py` - Ruff 포맷팅
- `backend/app/services/usage_service.py` - Ruff 포맷팅
- `backend/app/services/websocket_manager.py` - Ruff 포맷팅

### Frontend (106개 파일 포맷팅)

- `frontend/src/**/*.{ts,tsx,css}` - Prettier 포맷팅 적용

## 상세 변경 내용

### 1. Backend - Ruff Format + Lint Fix

- `ruff format app/`: 15개 파일 리포맷, 23개 파일 변경 없음
- `ruff check app/ --fix`: 2개 lint 이슈 자동 수정
- `main.py`의 E402 (module level import not at top) 4건은 `noqa` 주석 처리
  - Windows 이벤트 루프 정책 설정이 import보다 먼저 와야 하는 의도적 구조

### 2. Frontend - Prettier

- `npx prettier --write "src/**/*.{ts,tsx,css}"`: 전체 소스 포맷팅
- 들여쓰기, 따옴표, 세미콜론, trailing comma 등 일관성 확보

## 검증 결과

- `ruff check app/` - All checks passed
- `npx tsc -p tsconfig.app.json --noEmit` - 에러 없음
- `pnpm build` - 빌드 성공 (4.07s)
- `uv run python -c "from app.main import app; print('OK')"` - OK

## 비고

- 코드 로직 변경 없음, 순수 포맷팅 변경만 포함
- ESLint는 미설정 상태이므로 스킵
