# 작업 이력: 동시 세션 안정성 Phase 4 - TaskGroup + Rate Limiting

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Phase 4 (미래 확장 대비) 구현: Python 3.11+ `asyncio.TaskGroup`으로 배경 태스크 구조적 동시성 관리, `aiolimiter`로 세션별/글로벌 레이트 리미팅을 도입했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` - Rate Limiting 환경변수 추가
- `backend/app/main.py` - TaskGroup 기반 배경 태스크 구조화
- `backend/app/services/claude_runner.py` - aiolimiter 레이트 리미터 적용
- `backend/pyproject.toml` - aiolimiter 의존성 추가, requires-python 3.11+

## 상세 변경 내용

### 1. asyncio.TaskGroup 전환 (Phase 4-1)

- `lifespan()`의 개별 `create_task` 3개를 `asyncio.TaskGroup` 기반 `_run_background_tasks()`로 통합
- `shutdown_event` (asyncio.Event)로 graceful 종료 시그널 전달
- 각 배경 태스크가 `shutdown_event.wait()`를 timeout으로 감시하여 종료 시그널 시 깔끔하게 탈출
- `except*` (ExceptionGroup)으로 태스크 그룹 내 예외 로깅
- `requires-python`을 `>=3.10`에서 `>=3.11`로 변경 (Docker 이미지 python:3.11-slim 확인 완료)

### 2. aiolimiter 레이트 리미팅 (Phase 4-2)

- 글로벌 `AsyncLimiter`: 분당 60회 세션 시작 제한 (Claude API rate limit 보호)
- 세션별 `AsyncLimiter`: 분당 20회 프롬프트 제한 (연타 방지)
- 동작 흐름: rate limiter(속도) → semaphore(동시성) → _run_inner(실행)
- 환경변수로 설정 가능: `RATE_LIMIT_GLOBAL_PER_MINUTE`, `RATE_LIMIT_SESSION_PER_MINUTE`

## 관련 커밋

- Phase 1~3은 이전 커밋 (`977ce6c`)에서 완료
- 이번 커밋은 Phase 4 (TaskGroup + aiolimiter)

## 비고

- Redis Pub/Sub (Phase 4-3)은 단일 인스턴스 아키텍처에서 불필요하여 제외
- 수백 세션 이상 또는 HA 필요 시 추후 도입 검토
