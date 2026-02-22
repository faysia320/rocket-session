# 작업 이력: SQLite → PostgreSQL 전환 잔존 코드 정리

- **날짜**: 2026-02-22
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

SQLite에서 PostgreSQL로 마이그레이션 후 남아있던 SQLite 시대의 패턴(json.dumps/loads 방어 코드, int/bool 변환, 테스트 assertion)을 제거하고 PostgreSQL 네이티브 동작에 맞게 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - JSONB 값 병합 시 불필요한 json.dumps/int() 변환 제거
- `backend/app/services/claude_runner.py` - JSONB 값에 대한 isinstance(str) 방어 코드 제거
- `backend/tests/test_database.py` - docstring에서 SQLite 참조 제거
- `backend/tests/test_session_manager.py` - SQLite 기준 assertion을 PostgreSQL 기준으로 수정

### CLI

- `cli/lib/paths.mjs` - 주석에서 "SQLite DB" → "데이터베이스 관련" 용어 수정

## 상세 변경 내용

### 1. ws.py - JSONB 병합 로직 정리

- **변경 전**: 글로벌 설정 병합 시 `permission_required_tools`, `mcp_server_ids`를 `json.dumps(val)`로 문자열 변환하고, `permission_mode`를 `int()`로 변환하는 SQLite 호환 코드 존재
- **변경 후**: PostgreSQL JSONB 컬럼은 Python 객체를 직접 반환하므로 변환 없이 그대로 할당. Boolean도 Python bool로 직접 반환되므로 int 변환 불필요
- 불필요해진 `json` import 제거

### 2. claude_runner.py - JSONB 방어 코드 제거

- **permission_required_tools**: `json.loads(raw) if isinstance(raw, str) else raw` 패턴을 `session.get("permission_required_tools") or []`로 단순화
- **mcp_server_ids**: 12줄의 str 체크 + json.loads + try/except 코드를 1줄로 단순화

### 3. test_session_manager.py - SQLite 기준 assertion 수정

- `permission_mode == 1` → `permission_mode is True` (PostgreSQL Boolean은 Python bool 반환)
- `permission_mode == 0` → `permission_mode is False`
- `permission_required_tools == json.dumps(perm_tools)` → `permission_required_tools == perm_tools` (JSONB는 Python list 반환)
- 테스트명/docstring도 PostgreSQL 동작 기준으로 수정
- 불필요해진 `json` import 제거

### 4. 주석 정리

- `test_database.py`: "기존 SQLite 기반 API" 언급 제거
- `cli/lib/paths.mjs`: "SQLite DB 디렉토리" → "데이터베이스 관련 디렉토리"

## 미적용 사항 (향후 고려)

- 날짜/시간 컬럼 Text → TIMESTAMP WITH TIME ZONE 변환 (대규모 리팩토링 + 데이터 마이그레이션 필요)
- autoincrement=True 제거 (기능적 문제 없음)

## 테스트 방법

1. `cd backend && uv run pytest tests/ -v` (PostgreSQL 연결 필요)
2. `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
3. `cd backend && uv run ruff check app/ tests/`
