# 작업 이력: Stall 감지 오감지(False Positive) 개선

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Stall 감지 기능이 정상적인 Claude CLI 작업(extended thinking, 빌드/테스트 실행 등) 중에도 오감지하여 프로세스를 강제 종료하는 문제를 개선했습니다. 타임아웃 상향, 프로세스 활동 체크 기반 소프트/하드 2단계 판정, 연속 stall 조기 중단 로직을 도입했습니다.

## 변경 파일 목록

### Backend

- `backend/app/core/config.py` - stall_timeout_seconds 기본값 120초→300초 상향
- `backend/app/services/claude_runner.py` - _is_process_active 메서드 추가, _stall_watcher 2단계 판정 도입, _run_inner 연속 stall 조기 중단

## 상세 변경 내용

### 1. 타임아웃 기본값 상향 (120초→300초)

- `stall_timeout_seconds` 기본값을 300초(5분)로 변경
- Extended thinking, 빌드/테스트 등 120초를 초과하는 정상 작업 커버
- 환경변수 `STALL_TIMEOUT_SECONDS`로 오버라이드 가능

### 2. 프로세스 활동 체크 (`_is_process_active`)

- `/proc/<pid>/stat`에서 CPU 시간(utime+stime)을 1초 간격으로 2회 읽어 증가 여부로 활동 판단
- Linux/Docker 환경 전용, 예외 발생 시 안전하게 True 반환(오감지 방지 우선)

### 3. 소프트/하드 2단계 stall 판정

- **소프트 타임아웃 (300초)**: stdout 무출력 + 프로세스 비활동 → stall 판정. 프로세스 활동 중이면 유예
- **하드 타임아웃 (900초, ×3)**: 프로세스 상태와 무관하게 무조건 stall 판정 (무한 유예 방지)

### 4. 연속 stall 조기 중단

- 첫 번째 재시도도 stall이면 같은 프롬프트로 반복해도 동일 결과 가능성 높음
- "연속 무응답으로 재시도를 중단합니다" 메시지와 함께 즉시 중단
- 기존 STALL_DETECTED 이벤트 타입 재활용 → 프론트엔드 변경 불필요

## 테스트 방법

1. Docker 재빌드 후 긴 프롬프트(예: 대규모 코드 리팩토링)로 5분 이상 작업 실행 → stall 오감지 없이 정상 완료 확인
2. 로그에서 `stall 유예`, `stall 감지`, `연속 stall` 메시지로 동작 확인

## 비고

- 프론트엔드 변경 없음 (기존 stall_detected/retry_attempt 이벤트 핸들러 호환)
- 기존 테스트 모두 통과 (96 passed)
