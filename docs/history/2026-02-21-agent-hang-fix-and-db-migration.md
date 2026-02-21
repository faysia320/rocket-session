# 작업 이력: 에이전트 멈춤 현상 개선 및 DB 마이그레이션

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

에이전트(Claude CLI subprocess)가 실행 중 멈춰 보이는 현상을 프론트엔드 상태 표시 개선과 백엔드 hang 방지로 해결했습니다. 또한 SQLite에서 PostgreSQL + SQLAlchemy ORM으로의 데이터베이스 마이그레이션을 적용했습니다.

## 변경 파일 목록

### Backend (에이전트 멈춤 개선)

- `backend/app/services/permission_mcp_server.py` - HTTP 요청 스레드 분리 + 에러 핸들링 강화
- `backend/app/services/claude_runner.py` - stderr 읽기/프로세스 대기에 타임아웃 추가

### Frontend (에이전트 멈춤 개선)

- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - 상태별 인디케이터 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - Plan 승인 대기 감지 및 props 전달

### Backend (DB 마이그레이션)

- `backend/app/core/config.py` - DATABASE_URL 설정 추가
- `backend/app/core/database.py` - SQLAlchemy async engine/session 설정으로 전환
- `backend/app/models/` - SQLAlchemy ORM 모델 추가 (base, event, file_change, global_settings, mcp_server, message, tag, template)
- `backend/app/repositories/` - Repository 패턴 도입
- `backend/app/services/` - 각 서비스에서 직접 SQL 대신 Repository 사용
- `backend/app/api/dependencies.py` - SQLAlchemy 세션 의존성 추가
- `backend/migrations/` - Alembic 마이그레이션 업데이트
- `backend/pyproject.toml` - asyncpg, psycopg2-binary 등 의존성 추가
- `backend/Dockerfile` - libpq-dev 빌드 의존성 추가
- `docker-compose.yml` - PostgreSQL 서비스 추가

## 상세 변경 내용

### 1. ActivityStatusBar 상태 인디케이터 개선

- `running` 상태에서 도구가 없을 때 "Claude가 처리 중…" 기본 스피너 표시
- Permission 승인 대기 시 경고색 배경 + "도구 사용 승인 대기 중" 메시지
- Plan 검토 대기 시 정보색 배경 + "계획 검토 대기 중" 메시지
- 각 상태에 맞는 아이콘(ShieldAlert, ClipboardList)과 펄스 애니메이션

### 2. Permission MCP 서버 비동기화

- `urllib.request.urlopen()` 호출을 별도 `threading.Thread(daemon=True)`에서 실행
- `thread.join(timeout=...)` 으로 안전한 타임아웃 적용
- stderr 로깅 추가로 디버깅 용이성 확보
- 에러 발생 시 즉시 deny 반환하여 무한 대기 방지

### 3. Claude Runner stderr/프로세스 대기 타임아웃

- `process.stderr.read()`에 10초 타임아웃 적용
- `process.wait()`에 10초 타임아웃 적용, 초과 시 `process.kill()` 강제 종료
- subprocess가 정상 종료되지 않는 경우에도 세션이 영구 running 상태에 빠지지 않음

### 4. SQLite → PostgreSQL + SQLAlchemy ORM 마이그레이션

- 직접 aiosqlite SQL 쿼리에서 SQLAlchemy ORM + Repository 패턴으로 전환
- PostgreSQL asyncpg 드라이버 사용
- Docker Compose에 PostgreSQL 서비스 추가

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. 프롬프트 전송 후 `running` 상태에서 하단 ActivityStatusBar에 "Claude가 처리 중…" 스피너 확인
2. Permission 모드에서 도구 승인 요청 시 경고색 "도구 사용 승인 대기 중" 표시 확인
3. Plan 모드에서 계획 결과 수신 후 정보색 "계획 검토 대기 중" 표시 확인
4. 도구 실행 중에는 기존과 동일하게 도구 활동 표시 확인

## 비고

- Permission MCP 서버는 Claude CLI의 자식 프로세스(stdio 기반)로 실행되므로 asyncio 사용 불가, threading으로 처리
- 백엔드 테스트는 PostgreSQL 연결이 필요하여 로컬 환경에서 별도 DB 서버 필요
