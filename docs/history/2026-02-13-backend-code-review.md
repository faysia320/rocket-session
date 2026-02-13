# 작업 이력: Backend 코드 검수 17개 항목 개선

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

FastAPI + SQLite + WebSocket 백엔드에 대한 종합 코드 검수 결과 식별된 17개 개선 항목을 3개 Phase로 나눠 구현했습니다. 안정성, 코드 품질, 성능, 유지보수성 전반에 걸친 개선입니다.

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - 마이그레이션 에러 처리 강화, DB 인덱스 추가, 트랜잭션 컨텍스트 매니저, get_session_with_counts() 추가
- `backend/app/main.py` - 구조화된 로깅 설정, shutdown 시 pending permission 정리
- `backend/app/api/dependencies.py` - ClaudeRunner 싱글턴 패턴 적용
- `backend/app/api/v1/endpoints/sessions.py` - 중복 list_all() 쿼리 제거, get_with_counts() 사용
- `backend/app/api/v1/endpoints/ws.py` - asyncio Task 추적/관리, 핸들러 함수 분해
- `backend/app/api/v1/endpoints/health.py` - datetime.utcnow() 교체
- `backend/app/api/v1/endpoints/permissions.py` - MAX_PENDING 제한, clear_pending(), 미사용 import 제거
- `backend/app/services/claude_runner.py` - God Method 분해 (8개 메서드), SessionStatus enum, datetime 교체
- `backend/app/services/session_manager.py` - SessionStatus enum 사용, datetime 교체, get_with_counts() 추가
- `backend/app/services/websocket_manager.py` - broadcast 실패 시 로깅 추가
- `backend/app/services/permission_mcp_server.py` - deny 응답 중복 제거 (_make_deny_response 헬퍼)
- `backend/app/services/filesystem_service.py` - get_git_info() 10초 TTL 캐시 추가

### Ruff 포맷팅 (코드 스타일 통일)

- `backend/app/api/v1/api.py`
- `backend/app/core/config.py`
- `backend/app/schemas/filesystem.py`
- `backend/app/services/local_session_scanner.py`
- `backend/app/services/usage_service.py`

## 상세 변경 내용

### Phase 1: Quick Wins (9개 항목)

#### 1.1 DB 마이그레이션 Silent Failure 수정
- `except Exception: pass` → `except aiosqlite.OperationalError`로 변경
- "duplicate column" 메시지 확인 후 정상 무시, 그 외 에러는 로깅 후 raise

#### 2.2 중복 쿼리 패턴 제거
- `Database.get_session_with_counts()` 단일 쿼리 메서드 추가
- 3개 엔드포인트 + ws.py에서 `list_all()` O(N) 탐색 제거

#### 2.5 WebSocketManager 로깅
- broadcast 실패 시 `logger.debug()` 추가 (디버깅 지원)

#### 3.2 Permission MCP 중복 제거
- deny 응답 JSON 구조 3회 반복 → `_make_deny_response()` 헬퍼 추출

#### 3.3 deprecated datetime.utcnow() 교체
- 8곳에서 `datetime.now(timezone.utc)`로 교체 (Python 3.12 호환)

#### 3.4 ClaudeRunner 싱글턴 불일치 수정
- 매 호출 새 인스턴스 → 다른 서비스와 동일한 싱글턴 패턴

#### 3.5 DB Foreign Key 인덱스 추가
- `idx_messages_session_id`, `idx_file_changes_session_id`, `idx_sessions_created_at` 3개 인덱스

#### 4.1 Permission 전역 상태 정리
- MAX_PENDING=100 제한, shutdown 시 clear_pending() 호출

#### 4.2 구조화된 로깅 설정
- `logging.basicConfig(INFO, timestamp format)` 추가

### Phase 2: 핵심 품질 (3개 항목)

#### 1.3 트랜잭션 컨텍스트 매니저
- `async with db.transaction()` 추가 (commit/rollback 자동 관리)

#### 2.4 SessionStatus Enum 일관 사용
- 문자열 리터럴 "idle", "running", "error" → `SessionStatus.IDLE`, `.RUNNING`, `.ERROR`

#### 1.2 asyncio Task 미추적 수정
- Task 참조 저장, `add_done_callback` 에러 로깅, 중복 실행 방지, finally cancel

### Phase 3: 구조적 리팩토링 (5개 항목)

#### 2.3 WebSocket 핸들러 분해
- `_handle_prompt()`, `_handle_stop()`, `_handle_permission_respond()` 추출

#### 2.1 ClaudeRunner.run() God Method 분해
- 298줄 단일 메서드 → 8개 메서드로 분리
- `_build_command()`, `_setup_permission_mcp()`, `_start_process()`
- `_parse_stream()`, `_handle_stream_event()`, `_handle_assistant_event()`
- `_handle_user_event()`, `_handle_result_event()`, `_cleanup_mcp_config()`

#### 3.1 FilesystemService Git 캐싱
- `get_git_info()` 10초 TTL 캐시 추가 (매 호출 5개 subprocess → 캐시 히트 시 0개)

## 검증 결과

- `from app.main import app` - OK
- `ruff check app/` - All checks passed
- `ruff format app/` - 12 files reformatted
- `npx tsc -p tsconfig.app.json --noEmit` - TypeScript 타입 검사 통과
