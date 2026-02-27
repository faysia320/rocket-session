# 작업 이력: Backend 핵심 서비스 리팩토링 + 성능 최적화

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

`claude_runner.py`(1,123 LOC)와 `git_service.py`(1,044 LOC) 핵심 서비스의 6단계 리팩토링을 수행했습니다.
보안 수정 → 중복 제거 → 책임 분리 → 최적화 순으로 진행하며, 동시에 DB 풀/큐/WebSocket 성능 최적화 인프라를 추가했습니다.

## 변경 파일 목록

### Backend - 핵심 리팩토링

- `backend/app/services/claude_runner.py` - God Method 분해, TurnState/WorkflowContext dataclass, 헬퍼 메서드 추출
- `backend/app/services/git_service.py` - 경로 경계 검증 보안 수정, 중복 제거, 정적 파서 추출, cache stampede 방지
- `backend/app/services/team_coordinator.py` - try_handle_delegate_commands() 공개 메서드 추가

### Backend - 성능 최적화 인프라

- `backend/app/core/config.py` - DB 풀, 이벤트 큐, 메시지 배치, 하트비트 설정 추가
- `backend/app/core/database.py` - 연결 풀 파라미터 설정, raw_connection() 추가
- `backend/app/core/logging.py` - structlog 구조화 로깅 모듈 신규 생성
- `backend/app/main.py` - structlog 설정, Materialized View 주기적 갱신 태스크
- `backend/app/api/dependencies.py` - DB/WS/메시지 배치 파라미터 주입, MV 초기화
- `backend/app/api/v1/endpoints/health.py` - 상세 모니터링 엔드포인트 (/health/detailed)
- `backend/app/api/v1/endpoints/ws.py` - LRU Lock 딕셔너리, 워크플로우 시작 이벤트
- `backend/app/services/websocket_manager.py` - list→set 전환, 큐 설정 주입, 재시도/긴급flush, 메트릭
- `backend/app/services/session_manager.py` - 메시지 배치 큐 + 배치 라이터
- `backend/app/services/session_process_manager.py` - 프로세스 메트릭 반환
- `backend/app/services/usage_service.py` - inflight dedup 패턴으로 stampede 방지 개선
- `backend/app/repositories/analytics_repo.py` - Materialized View 생성/갱신
- `backend/app/repositories/event_repo.py` - asyncpg COPY 프로토콜 벌크 삽입
- `backend/pyproject.toml` - structlog 의존성 추가
- `docker-compose.yml` - PostgreSQL max_connections, shared_buffers 튜닝

## 상세 변경 내용

### 1. git_service.py 보안 수정 (Phase 1)

- 6개 메서드(`get_git_status`, `get_file_diff`, `pull`, `smart_pull`, `reset_to_remote`, `push`)에 `_is_within_root()` 경로 경계 검증 추가
- 경로 탐색 공격(path traversal) 방지

### 2. git_service.py 구조 개선 (Phase 2)

- `_resolve_cwd()`: 22개 메서드의 3-4행 검증 패턴을 1행 호출로 통합 (~44행 절감)
- `_invalidate_cache()`: 7개 메서드의 캐시 삭제 패턴 통합
- 클래스 상수: `_DEFAULT_GIT_TIMEOUT`, `_WRITE_GIT_TIMEOUT`, `_HEAVY_GIT_TIMEOUT` 등
- 정적 파서 5개: `_parse_porcelain_status`, `_parse_commit_log`, `_parse_ahead_behind`, `_parse_log_entries`, `_parse_worktree_porcelain`

### 3. claude_runner.py God Method 분해 (Phase 3)

- `run()` (178행) → `_run_process_lifecycle()` + `_handle_workflow_completion()` + 오케스트레이션
- `_handle_assistant_event` (174행) → `_handle_thinking_block()` + `_handle_tool_use_block()` + `_handle_file_change_from_tool()`
- `_terminate_process()`: 3곳의 프로세스 종료 패턴 통합
- `_update_and_broadcast_status()`: 상태 업데이트+브로드캐스트 통합
- 팀 delegation 디커플링: TeamCoordinator에 `try_handle_delegate_commands()` 공개 메서드

### 4. run() 파라미터 정리 + MCP 리소스 관리 (Phase 4)

- `WorkflowContext` dataclass: 워크플로우 관련 4개 파라미터 구조화
- `_mcp_config_scope()` async context manager: MCP config 파일 생명주기 관리

### 5. Lock 안전성 + 에러 처리 문서화 (Phase 5)

- Lock 풀 포화 시 경고 로그
- 에러 반환 규약 docstring 문서화 (읽기=예외, 쓰기=튜플)

### 6. TurnState dataclass + cache stampede 방지 (Phase 6)

- `TurnState` dataclass: plain dict → 타입 안전한 dataclass (IDE 자동완성, 키 오타 방지)
- git_service.py `get_git_info()`: asyncio.Event 기반 inflight dedup으로 cache stampede 방지

### 7. 성능 최적화 인프라

- DB 연결 풀: pool_size=20, max_overflow=40, pool_timeout/recycle 설정
- WebSocket 연결 관리: list→set 전환 (O(n) remove → O(1) discard)
- 이벤트 저장: asyncpg COPY 프로토콜 시도 (INSERT 대비 5~50배 빠름), 재시도/긴급flush
- 메시지 배치 큐: 0.3초 간격 배치 DB 저장
- Materialized View: 분석 쿼리 최적화, 5분 주기 갱신
- usage_service: Lock → inflight Event 패턴으로 stampede 방지 개선
- structlog: JSON 구조화 로깅 (ELK/CloudWatch 연동 가능)
- /health/detailed: DB 풀, WS, 프로세스, 메시지 큐 상태 모니터링

## 관련 커밋

- (이 문서와 함께 커밋 예정)

## 테스트 방법

1. `cd backend && uv run python -c "from app.main import app; print('OK')"` — 임포트 검증
2. `cd backend && uv run pytest` — 테스트 실행
3. Docker 이미지 빌드 후 컨테이너 기동 → 세션 생성/실행 E2E 확인
4. `/health/detailed` 엔드포인트로 DB 풀/WS/큐 상태 모니터링

## 비고

- 기존 테스트 중 `WorkflowDefinitionService` 미등록 문제로 실패하는 테스트는 이번 리팩토링과 무관한 기존 이슈
- 총 LOC는 소폭 증가했으나 (메서드 분해 + dataclass/상수/docstring 추가), 메서드 최대 길이와 코드 품질은 크게 개선
