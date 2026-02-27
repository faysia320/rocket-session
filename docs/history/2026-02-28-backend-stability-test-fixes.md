# 작업 이력: 백엔드 안정성 수정 후속 — 테스트 전체 통과

- **날짜**: 2026-02-28
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

백엔드 안정성 리뷰(8개 문제점 수정) 이후 발생한 테스트 실패를 전면 수정했습니다.
Alembic migration chain 충돌, WorkflowDefinitionService FK 위반, 테스트 assertion 불일치 등
다수 문제를 해결하여 전체 343건 테스트가 통과합니다.

## 변경 파일 목록

### Backend — 서비스/마이그레이션

- `backend/app/services/workflow_definition_service.py` - fallback 정의를 DB에 자동 생성 (FK 위반 수정)
- `backend/app/services/session_manager.py` - `update_settings`에 `workflow_definition_id` 파라미터 추가
- `backend/app/api/v1/endpoints/insights.py` - 미사용 변수 제거 + 줄바꿈 정규화
- `backend/migrations/versions/20260228_0025_add_workspace_insights.py` - revision 0025→0025b (중복 해소)
- `backend/migrations/versions/20260228_0026_add_qa_workflow_definitions.py` - down_revision 0025→0025b (체인 연결)

### Backend — 테스트

- `backend/tests/test_websocket_manager.py` - fire-and-forget broadcast 대기 헬퍼 추가
- `backend/tests/test_permissions.py` - `trust_level` 필드 추가
- `backend/tests/test_workflow_service.py` - 예외 타입, 완료 상태, 프롬프트 assertion 수정
- `backend/tests/test_workflow_definition_service.py` - fallback ID assertion 수정

## 상세 변경 내용

### 1. Alembic migration chain 충돌 해소

- 기존 0024→**0025**(workspace_insights)→0025(global_settings) 체인에서 revision ID "0025" 중복 발생
- workspace_insights를 "0025b"로 변경하여 0024→0025→**0025b**→0026 선형 체인 확보

### 2. WorkflowDefinitionService fallback FK 위반 수정

- `get_or_default(None)`이 `id="fallback"` 하드코딩 객체를 반환하지만 DB에 없어 FK 위반
- fallback을 `id=f"default-{uuid}"` 형식으로 DB에 자동 생성(INSERT + COMMIT) 후 반환하도록 변경

### 3. SessionManager `update_settings` 확장

- `workflow_definition_id` 파라미터가 누락되어 세션 생성 시 워크플로우 정의 연결 불가
- `maybe_fields` dict에 `workflow_definition_id` 추가

### 4. 테스트 수정 (5개 파일)

| 테스트 파일 | 수정 내용 |
|---|---|
| `test_websocket_manager.py` | `_drain_broadcasts()` 헬퍼로 fire-and-forget 태스크 완료 대기 (3건) |
| `test_permissions.py` | `broadcast_event` 호출에 `trust_level: "once"` 필드 추가 (1건) |
| `test_workflow_service.py` | `ValueError` → `NotFoundError`/`ValidationError`, 완료 상태 assertion 수정 |
| `test_workflow_definition_service.py` | fallback ID `"fallback"` → `startswith("default-")` |

## 관련 커밋

- `4928c53` - Fix: 백엔드 안정성 리뷰 8개 문제점 수정
- `65467e4` - Test: Fix 테스트 실패 수정 (DI 오버라이드, fixture, status_code)

## 테스트 방법

```bash
cd backend && uv run pytest tests/ -x -q
# 결과: 343 passed, 0 failed
```

## 비고

- `insights.py`, `workflow_definition_service.py`에 CRLF→LF 줄바꿈 정규화 포함
- 테스트 실패는 이번 안정성 수정과 무관한 기존 이슈가 대부분 (DI 패턴 불일치, assertion 부정확)
