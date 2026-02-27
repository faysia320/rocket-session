# 작업 이력: 백엔드 안정성 리뷰 — 8개 문제점 수정

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

4개 커밋(c7a24bb, 977ce6c, 3a46e50, 7774744) 이후 백엔드 서비스의 안정성 리뷰를 수행하여
총 8개 문제점(P1 4건, P2 3건, P3 1건)을 발견하고 수정했습니다.
추가로 테스트 실패 원인(DI 패턴 위반, fixture 누락)도 함께 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/websocket_manager.py` - COPY fallback 중복 저장 방지, 재시도 배치 크기 상한, 이중 시작 방지
- `backend/app/services/session_manager.py` - 메시지 배치 재시도 메커니즘 추가, 로그 메시지 정확성 수정
- `backend/app/services/claude_runner.py` - 세션 limiter 메모리 누수 수정
- `backend/app/api/v1/endpoints/sessions.py` - DI 패턴 수정(Depends 전환), limiter 정리 호출 추가
- `backend/app/main.py` - 지연 import를 함수 레벨로 이동

### Tests

- `backend/tests/test_api_endpoints.py` - WorkflowDefinitionService DI 오버라이드 추가, 기본 워크플로우 정의 삽입, status_code 201 수정
- `backend/tests/test_workflow_service.py` - WorkflowService fixture에 definition_service 인자 추가

## 상세 변경 내용

### 1. P1-1: _flush_events COPY → INSERT fallback 중복 저장 방지

- COPY 성공 시 `return`으로 즉시 반환하여 INSERT fallback 도달 방지
- 기존: COPY 성공 후 예외 발생 시 INSERT가 재실행되어 중복 저장 가능

### 2. P1-2: 재시도 배치 크기 무한 증가 방지

- `_retry_batch` 크기 상한(`_event_batch_max_size * 2`) 추가
- 초과 시 오래된 이벤트부터 드롭하여 메모리 보호

### 3. P1-3: _flush_messages 배치 메시지 손실 방지

- `_message_retry_batch` 재시도 메커니즘 추가 (websocket_manager와 동일 패턴)
- 3회 재시도 후 드롭하여 무한 루프 방지

### 4. P1-4: _session_limiters 메모리 누수 수정

- `ClaudeRunner.cleanup_session_limiter()` 메서드 추가
- 세션 삭제 엔드포인트에서 호출하여 limiter 정리

### 5. P2-6: start_background_tasks 이중 시작 방지

- `_flush_task`가 이미 실행 중이면 early return

### 6. P2-7: queue_message 로그 메시지 수정

- `"드롭"` → `"동기 저장으로 폴백"` (실제 동작과 일치)
- 로그 레벨 `warning` → `debug`

### 7. P3-8: main.py 지연 import 정리

- `_guarded_cleanup`, `_guarded_mv_refresh` 내부의 지연 import를 `_run_background_tasks` 시작부로 이동

### 8. 테스트 실패 수정

- `create_session` 엔드포인트에서 `get_workflow_definition_service()`를 `Depends()`로 전환 (DI 패턴 준수)
- 테스트 fixture에 `WorkflowDefinitionService` 오버라이드 + 기본 워크플로우 정의 DB 삽입 추가
- `POST /api/sessions/` status_code `200` → `201` 수정 (엔드포인트 정의와 일치)

## 테스트 방법

```bash
cd backend
uv run python -c "from app.main import app; print('OK')"
uv run pytest tests/test_api_endpoints.py -q  # 22 passed
```

## 비고

- 기존 테스트 실패 4건(`test_websocket_manager` 3건, `test_permissions` 1건)은 fire-and-forget `create_task` 타이밍 문제로 이번 변경과 무관
- `test_workflow_service.py` ERROR 51건 중 fixture 인자 누락은 수정했으나, `SessionManager.update_settings()` 미지원 키워드 인자 이슈는 별도 수정 필요
