# 작업 이력: 워크플로우 상태 불변식 강제 + 자동 복구

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

`workflow_enabled=true`인 세션에서 `workflow_phase`가 `null`인 상태가 발생하면 사용자가 막다른 길에 빠지는 버그를 3계층 방어로 수정했습니다.

**불변식**: `workflow_enabled=true`이면 반드시 `workflow_phase != null`이어야 한다.

## 변경 파일 목록

### Backend

- `backend/app/services/session_manager.py` - `update_settings()` 불변식 체크 + `fork()` phase 초기화
- `backend/app/api/v1/endpoints/ws.py` - 게이트 에러 → 자동 복구

## 상세 변경 내용

### 1. `update_settings()` 중앙 불변식 (session_manager.py)

- `workflow_enabled=True`가 설정될 때 `workflow_phase`가 명시적으로 전달되지 않은 경우(`_UNSET`), DB의 현재 값을 확인
- `workflow_phase`가 null이면 자동으로 `"research"` / `"in_progress"` 주입
- PATCH API 등 모든 경로에서 불변식 보장

### 2. `fork()` 진입점 방어 (session_manager.py)

- 포크 시 `workflow_enabled`가 true면 `workflow_phase="research"`, `workflow_phase_status="in_progress"` 자동 설정
- 기존에는 `workflow_enabled`만 복사하고 phase는 미설정 → null 상태 발생

### 3. WebSocket 게이트 자동 복구 (ws.py)

- 기존: `workflow_enabled=True, phase=None` 상태에서 에러 메시지 반환 + return (복구 불가)
- 변경: 경고 로그 출력 후 `update_settings()`로 `research/in_progress` 자동 복구, 이후 정상 워크플로우 진행

### 3계층 방어 요약

| 계층 | 위치 | 역할 |
|------|------|------|
| 진입점 | `fork()` | 포크 시 phase 누락 원천 방지 |
| 중앙 | `update_settings()` | PATCH 등으로 enabled 토글 시 불변식 보장 |
| 런타임 | `ws.py` 게이트 | 어떤 경로로든 깨진 상태가 되었을 때 자동 복구 |

## 관련 커밋

- `(이후 기입)` - Fix: 워크플로우 상태 불변식 강제 + 자동 복구

## 테스트 방법

1. 워크플로우 세션 포크 → 포크된 세션에서 메시지 전송 가능 확인
2. 워크플로우 세션 PATCH로 `workflow_enabled` 토글 → 에러 없이 동작 확인
3. `workflow_enabled=true, phase=null` 상태에서 메시지 전송 → 자동 복구 확인
