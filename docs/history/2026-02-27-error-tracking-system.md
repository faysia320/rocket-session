# 작업 이력: 에러 추적 시스템 도입

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Self-hosted 에러 추적 시스템을 3단계로 도입합니다:
1. GlitchTip (Self-hosted Sentry 호환) — 에러 자동 수집/그룹핑/알림
2. Request ID + structlog 컨텍스트 — 에러 상관관계 (프론트↔백엔드 추적)
3. Loki + Grafana — 로그 집계/검색 (에러 전후 맥락 파악)

## 변경 파일 목록

### Backend

- `backend/app/core/sentry.py` (신규) - Sentry SDK 초기화 (GlitchTip 호환) + structlog→태그 브릿지
- `backend/app/core/middleware.py` (신규) - Request ID 미들웨어 (X-Request-ID + structlog 바인딩)
- `backend/app/core/config.py` - `sentry_dsn`, `sentry_environment` 설정 필드 추가
- `backend/app/core/logging.py` - `CallsiteParameterAdder` 프로세서 추가
- `backend/app/main.py` - `setup_sentry()` 호출 + `RequestIdMiddleware` 등록
- `backend/app/services/claude_runner.py` - `session_id` structlog 컨텍스트 바인딩
- `backend/app/api/v1/endpoints/ws.py` - `session_id` structlog 컨텍스트 바인딩
- `backend/pyproject.toml` - `sentry-sdk[fastapi]` 의존성 추가

### Frontend

- `frontend/src/lib/sentry.ts` (신규) - 프론트엔드 Sentry SDK 초기화 (GlitchTip 대상)
- `frontend/src/main.tsx` - `initSentry()` 최상단 호출
- `frontend/src/components/ui/ErrorBoundary.tsx` - `Sentry.captureException()` 추가
- `frontend/src/lib/api/client.ts` - `X-Request-ID` 헤더 + API 에러 Sentry 전송
- `frontend/package.json` - `@sentry/react` 의존성 추가

### Infrastructure

- `docker-compose.yml` - redis, glitchtip-web, glitchtip-worker, loki, promtail, grafana 서비스 추가
- `.env.docker.example` - GlitchTip + Sentry DSN 환경변수 추가
- `observability/postgres/init-glitchtip.sql` (신규) - GlitchTip용 PostgreSQL DB 생성
- `observability/loki/loki-config.yml` (신규) - Loki 스토리지/보존 설정
- `observability/promtail/promtail-config.yml` (신규) - Docker 로그 수집 파이프라인
- `observability/grafana/provisioning/datasources/datasources.yml` (신규) - Loki 데이터소스
- `observability/grafana/provisioning/dashboards/dashboards.yml` (신규) - 대시보드 프로비저닝
- `observability/grafana/dashboards/error-tracking.json` (신규) - 에러 추적 대시보드

## 상세 변경 내용

### 1. GlitchTip (Phase 1)

- Sentry SaaS 대신 GlitchTip Self-hosted 선택 (3컨테이너 vs 70컨테이너, 256MB vs 16GB RAM)
- Sentry SDK는 동일하게 사용 (`sentry-sdk[fastapi]`, `@sentry/react`)
- 기존 PostgreSQL 인스턴스를 재사용하여 `glitchtip` 별도 DB 생성
- DSN 미설정 시 완전 비활성화 — 기존 동작 무영향

### 2. Request ID + structlog 컨텍스트 (Phase 2)

- `RequestIdMiddleware`: 모든 HTTP 요청에 `X-Request-ID` 부여, structlog contextvars에 바인딩
- `CallsiteParameterAdder`: 모든 로그에 파일명/함수명/줄번호 자동 추가
- `session_id` 바인딩: claude_runner, ws 핸들러에서 세션 ID를 로그 컨텍스트에 바인딩
- 프론트엔드 API client: 모든 요청에 X-Request-ID 헤더 전송

### 3. Loki + Grafana (Phase 3)

- Loki: 로그 저장소 (7일 보존, TSDB v13 스키마)
- Promtail: Docker 컨테이너 로그 자동 수집 + structlog JSON 파싱 (request_id, session_id 라벨)
- Grafana: Loki 데이터소스 자동 프로비저닝 + 에러 추적 대시보드 (5개 패널)

## 검증 결과

| 검증 항목 | 결과 |
|-----------|------|
| 백엔드 Python import | PASS |
| 백엔드 Ruff 린트 | PASS |
| 백엔드 ty 타입 체크 | PASS |
| 프론트엔드 TypeScript 타입 체크 | PASS |
| 프론트엔드 ESLint | PASS |
| docker-compose.yml YAML 구문 | PASS |
| 모든 observability 설정 파일 구문 | PASS |

## 배포 후 초기 설정

1. `docker compose up -d`
2. http://localhost:8200 → GlitchTip 관리자 계정 생성
3. Organization + Project 2개 → DSN 획득
4. `.env.docker`에 DSN 설정 → `docker compose restart backend frontend`
5. http://localhost:3000 → Grafana 에러 추적 대시보드 확인

## 비고

- GlitchTip → 공식 Sentry self-hosted 전환 시 DSN만 변경하면 됨
- 총 추가 RAM: ~530MB (GlitchTip ~200MB + Redis ~30MB + Loki ~150MB + Promtail ~50MB + Grafana ~100MB)
