# 작업 이력: OpenAI Symphony Quick Wins 3가지 구현

- **날짜**: 2026-03-05
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

OpenAI Symphony 리포지토리 분석 후, rocket-session에 즉시 적용 가능한 Quick Win 3가지를 구현했습니다:

1. **Stall Detection + 자동 재시도**: 행(hang) 세션 감지 → 지수 백오프 재시도
2. **Reconciliation Loop**: 비정상 종료 세션 60초 주기 자동 정리
3. **Continuation Turns**: 워크플로우 자동 체이닝 시 토큰 절감

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` — Stall Detection 설정 4개 추가
- `backend/app/models/event_types.py` — STALL_DETECTED, RETRY_ATTEMPT 이벤트 타입 추가
- `backend/app/services/claude_runner.py` — Stall 감지 워처, 재시도 루프, OSError 방어, continuation 지원
- `backend/app/repositories/session_repo.py` — list_running_session_ids() 쿼리 추가
- `backend/app/services/session_process_manager.py` — get_orphaned_sessions() 추가
- `backend/app/services/session_manager.py` — reconcile_stuck_sessions() 메서드 추가
- `backend/app/main.py` — _guarded_reconciliation() 주기적 배경 태스크 추가
- `backend/app/services/workflow_service.py` — build_phase_context() is_continuation 파라미터 추가
- `backend/app/api/v1/endpoints/ws.py` — continuation 플래그 전달

### Frontend

- `frontend/src/types/ws-events.ts` — WsStallDetectedEvent, WsRetryAttemptEvent 인터페이스 추가
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` — stall_detected, retry_attempt 핸들러 추가

## 상세 변경 내용

### 1. Stall Detection + 자동 재시도 (지수 백오프)

**문제**: `_parse_stream()`의 `process.stdout.readline()`이 타임아웃 없이 블로킹됨. Claude 프로세스가 행(hang)되어도 전체 타임아웃까지 감지 불가.

**해결**:
- `_stall_watcher()`: parse_stream과 병렬 실행, `time.monotonic()` 기반 무출력 시간 감지
- 무출력 시간 ≥ `stall_timeout_seconds`(기본 120초) → 프로세스 terminate + WS 알림
- `_run_inner()` 재시도 루프: stall 감지 시 `min(initial * 2^attempt, max_backoff)` 대기 후 재시작
- Exception은 재시도하지 않음 (stall만 재시도)
- `readline()` OSError/BrokenPipeError 방어 (stall_watcher가 kill 후 발생 가능)

### 2. Reconciliation Loop (세션 정합성 점검)

**문제**: Claude 서브프로세스가 OOM kill 등으로 비정상 종료 시, DB는 `running`이지만 프로세스 핸들 소멸. 세션이 running 상태에 영원히 고착.

**해결**:
- `reconcile_stuck_sessions()`: 2단계 정리
  - DB running + 프로세스 없음 → idle로 전환 + WS broadcast
  - 프로세스 등록 + 이미 종료(고아) → clear_process + cancel runner_task
- `_guarded_reconciliation()`: 60초 간격 주기 실행, TaskGroup에 등록
- `list_running_session_ids()`: running 세션 ID 일괄 조회 쿼리

### 3. Continuation Turns (토큰 절감)

**문제**: 워크플로우 자동 체이닝 시 매번 전체 이전 아티팩트를 프롬프트에 포함. `--resume`으로 세션을 이어가면 이미 컨텍스트에 있는 내용을 중복 전송.

**해결**:
- `build_phase_context(is_continuation=True)`: 이전 아티팩트 전체 대신 참조 텍스트만 포함
- `ws.py`: `claude_session_id` 존재 시 `is_continuation=True` 전달
- `claude_runner.py`: 자동 체이닝 시 `has_claude_session` 검사 후 경량 컨텍스트 적용

### 4. QA 검증 및 수정

- **WS broadcast 누락**: reconcile_stuck_sessions()에 ws_manager 파라미터 추가
- **타입 불안전 접근**: retry_attempt 핸들러에서 `(data.X as number) ?? 0` 패턴 적용
- **OSError 방어**: _parse_stream readline()을 try/except로 래핑

## 테스트 방법

1. Stall Detection: 장시간 무응답 Claude 세션 → 자동 감지 및 재시도 확인
2. Reconciliation: 프로세스 강제 kill 후 60초 내 세션 idle 전환 확인
3. Continuation: 워크플로우 자동 체이닝 시 프롬프트 길이 감소 확인

## 비고

- OpenAI Symphony (Elixir/OTP 기반)의 stall detection, reconciliation, continuation 패턴을 Python/asyncio로 적용
- pytest 414 passed, pnpm build 성공, tsc 에러 없음 확인 완료
