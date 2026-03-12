# 작업 이력: 메시지 배치 저장 실패 ("2건 드롭") 버그 수정

- **날짜**: 2026-03-12
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

커밋 `5e8a7f1` (스트림 처리 성능 최적화)에서 도입된 메시지 배치 큐 시스템에서,
세션 삭제 시 큐에 남은 메시지를 정리하지 않아 FK 위반(IntegrityError)이 발생하는 버그를 수정했습니다.
Grafana/GlitchTip에 "메시지 배치 저장 최종 실패 — 2건 드롭" 에러가 대량 발생하던 문제를 해결합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/session_manager.py` - 배치 flush 로직 전면 개선 (5건)
- `backend/app/repositories/session_repo.py` - `existing_ids()` 경량 쿼리 추가

## 상세 변경 내용

### 1. 세션 삭제 시 큐 드레인 (근본 원인 제거)

- `_drain_session_from_queue()` 메서드 추가
- `delete()` 호출 시 DB 삭제 전에 해당 session_id의 메시지/파일변경을 큐에서 제거
- 메시지 큐, 재시도 배치, 파일 변경 큐 모두 드레인

### 2. 배치 INSERT 전 세션 존재 검증 (안전망)

- `_filter_orphaned_messages()` 메서드 추가
- `SessionRepository.existing_ids()` 경량 쿼리로 삭제된 세션 메시지 사전 필터링
- drain과 flush 간 race condition 방어

### 3. 배치 실패 시 세션별 분할 재시도 (배치 중독 방지)

- `_retry_by_session()` 메서드 추가
- 실패 배치를 session_id별로 분할하여 개별 재시도
- 세션 A의 FK 위반이 세션 B의 정상 메시지를 연쇄 실패시키지 않음

### 4. 메시지별 retry 카운터

- 전역 `_message_retry_count` 제거 → 메시지 dict에 `_retry_count` 키로 개별 추적
- `_MAX_MSG_RETRIES` 클래스 상수로 대체
- DB INSERT 전 `_` 접두사 키 자동 strip

### 5. ERROR 로그 진단 개선

- 드롭 시 `exc_info=True` + `session_id` + `message_type` 포함
- Grafana/GlitchTip에서 실제 예외와 컨텍스트 확인 가능

## 테스트 방법

1. 세션 실행 중 도구 호출 시 세션 삭제 → 에러 로그 없이 큐 드레인 확인
2. 정상 세션의 메시지가 다른 세션 삭제에 영향받지 않는지 확인
3. Grafana에서 "메시지 배치 저장 최종 실패" 에러 빈도 0 수렴 모니터링

## 비고

- 근본 원인: 세션 삭제 → CASCADE로 sessions 행 삭제 → 큐의 미저장 메시지 INSERT 시 FK 위반
- "2건 드롭" 패턴: tool_use + tool_result 메시지가 항상 쌍으로 큐잉되기 때문
