# 작업 이력: Serena MCP Docker 컨테이너화

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Serena MCP 서버가 HOST 머신에서 실행되어, Docker 내부 세션에서 코드 수정 시 HOST 로컬 파일이 직접 수정되는 문제를 해결했습니다.
Serena를 docker-compose 서비스로 추가하고, `docker_service_name` 필드를 통해 Docker 내부 네트워크 라우팅을 지원합니다.

### 문제 원인

```
Before: Claude CLI (Docker) → host.docker.internal:9121 → HOST Serena → HOST 파일 수정!
After:  Claude CLI (Docker) → serena:9121 (Docker 내부) → Docker Serena → Named Volume만 수정
```

## 변경 파일 목록

### Infrastructure

- `docker-compose.yml` - Serena 서비스 추가 (공식 이미지 ghcr.io/oraios/serena:latest)
- `serena/serena_config.yml` - Docker용 Serena 설정 (headless 모드)
- `.env.docker.example` - Serena 포트 환경변수 추가

### Backend

- `backend/migrations/versions/20260310_0032_add_mcp_docker_service_name.py` - docker_service_name 컬럼 마이그레이션
- `backend/app/models/mcp_server.py` - ORM 모델에 docker_service_name 필드 추가
- `backend/app/schemas/mcp.py` - 3개 Pydantic 스키마에 필드 추가
- `backend/app/services/mcp_service.py` - Docker 서비스명 URL 해석 로직 + CRUD 필드 전달
- `backend/app/api/v1/endpoints/mcp.py` - create/update 엔드포인트에 필드 전달

### Frontend

- `frontend/src/types/mcp.ts` - 3개 TypeScript 인터페이스에 docker_service_name 추가
- `frontend/src/features/mcp/components/McpServerForm.tsx` - Docker 서비스명 입력 UI

### 기타 (별도 커밋)

- `backend/app/api/v1/endpoints/ws.py` - WebSocket 에러 로깅을 구조화 로깅으로 전환
- `backend/app/services/insight_service.py` - logging → structlog 전환

## 상세 변경 내용

### 1. Serena Docker 서비스 추가

- `ghcr.io/oraios/serena:latest` 공식 이미지 사용 (Python 3.11 + Node.js 22 + LSP 내장)
- `rocket-workspaces:/workspaces` Named Volume을 backend과 공유
- `expose: "9121"` — Docker 내부 네트워크에만 노출 (HOST 미노출)
- 헬스체크: `curl -sf http://localhost:9121/sse`

### 2. docker_service_name 필드

- DB: `mcp_servers.docker_service_name` String 컬럼 (nullable)
- NULL: 기존 동작 (localhost → host.docker.internal 변환)
- 값 설정 시: Docker 내부에서 해당 서비스명으로 URL 변환
  - 예: `http://localhost:9121/sse` → `http://serena:9121/sse`

### 3. URL 해석 로직

- `_resolve_url_for_docker_service()` 함수 추가
- `build_mcp_config()`에서 `docker_service_name`이 설정되고 Docker 내부일 때만 서비스명 해석 적용
- 기존 MCP 서버(docker_service_name=NULL)는 동작 변경 없음

## 관련 커밋

- (커밋 후 업데이트 예정)

## 테스트 방법

1. `docker-compose up -d` — serena 서비스 healthy 상태 확인
2. `docker-compose exec backend uv run alembic upgrade head` — 마이그레이션 적용
3. Rocket Session UI → MCP 서버 설정 → Serena의 Docker Service Name에 `serena` 입력
4. 세션에서 Serena 편집 도구 사용 → 변경이 Named Volume 내에만 적용되는지 확인
5. HOST GitHub Desktop → Changes 탭에 아무것도 나타나지 않는지 확인

## 비고

- QA 코드 리뷰: 4/4 PASS (APPROVE)
- 기존 1개 pytest 실패(`test_get_usage_cache_expired`)는 이번 변경과 무관한 기존 실패
