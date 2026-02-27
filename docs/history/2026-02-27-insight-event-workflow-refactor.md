# 작업 이력: Insight 이벤트 타입 추가 + WorkflowService 리팩토링

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

WebSocket 이벤트에 `INSIGHT_EXTRACTED` 타입을 추가하고, WorkflowService에 `parse_qa_checklist` 메서드를 추가했습니다. uv.lock은 Python 3.11 요구사항과 aiolimiter 추가를 반영합니다.

## 변경 파일 목록

### Backend

- `backend/app/models/event_types.py` - `INSIGHT_EXTRACTED` 이벤트 타입 추가
- `backend/app/services/workflow_service.py` - `parse_qa_checklist` 메서드 추가 + 리포맷
- `backend/uv.lock` - Python >=3.11 + aiolimiter 의존성 반영

## 상세 변경 내용

### 1. INSIGHT_EXTRACTED 이벤트 타입

- `WsEventType` 클래스에 `INSIGHT_EXTRACTED = "insight_extracted"` 추가
- Knowledge/Insight 관련 WebSocket 이벤트 지원

### 2. WorkflowService 리팩토링

- `parse_qa_checklist` 정적 메서드 추가 (아티팩트 내용에서 QA 체크리스트 파싱)
- 코드 리포맷 (543줄 → 601줄)

### 3. uv.lock 업데이트

- `requires-python` 3.10 → 3.11 변경 반영
- `aiolimiter` 패키지 추가 반영
- 불필요한 Python 3.10 호환 의존성 제거

## 관련 커밋

- (이 문서와 함께 커밋됨)
