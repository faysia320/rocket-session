# 작업 이력: 세션 라이프사이클 구조화 로깅 + AI 피드백 루프

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 라이프사이클 전 단계를 추적할 수 있는 구조화 로깅(structlog)을 도입하고,
AI가 세션 데이터를 분석하여 자동 인사이트를 생성하는 피드백 루프를 구현했습니다.

## 변경 파일 목록

### Backend (구조화 로깅)

- `backend/app/api/v1/endpoints/ws.py` - WebSocket 핸들러에 structlog + turn_id 생성 + 7개 로그 포인트 추가
- `backend/app/services/claude_runner.py` - CLI 프로세스 실행/스트림 파싱에 structlog + 7개 로그 포인트 + 분석 트리거 추가
- `backend/app/services/workflow_service.py` - 워크플로우 서비스 structlog 전환 + 6개 구조화 로그
- `backend/app/services/session_manager.py` - 세션 매니저 structlog 전환 + 3개 구조화 로그

### Backend (AI 피드백 루프)

- `backend/app/services/session_analysis_service.py` - **신규** 세션 분석 서비스 (요약 생성 + 자동 인사이트)
- `backend/app/schemas/session_analysis.py` - **신규** SessionSummary/TokenSummary Pydantic 스키마
- `backend/app/api/dependencies.py` - SessionAnalysisService DI 등록
- `backend/app/api/v1/endpoints/sessions.py` - GET /{session_id}/summary API 추가
- `backend/app/services/insight_service.py` - session_analysis/performance 카테고리 라벨 추가
- `backend/app/schemas/workspace_insight.py` - InsightCategory에 session_analysis/performance 추가

### Observability

- `observability/loki/loki-config.yml` - 보존 기간 168h → 720h (30일)
- `observability/promtail/promtail-config.yml` - component/operation/turn_id/workflow_phase JSON 추출 + 라벨 추가
- `observability/grafana/dashboards/session-lifecycle.json` - **신규** 세션 라이프사이클 대시보드 (6 패널)
- `observability/grafana/dashboards/sessions-overview.json` - **신규** 세션 전체 개요 대시보드 (7 패널)

## 상세 변경 내용

### 1. 구조화 로깅 (Part A)

4개 핵심 서비스에 structlog을 도입하여 세션 라이프사이클 전 단계를 추적합니다.

**Component/Operation 분류 체계**:
- `ws`: connect, disconnect, message_receive, stop
- `context`: kb_inject, insights_inject
- `runner`: turn_start, process_start, tool_invocation, ask_user_question, result_received, turn_end
- `workflow`: start, approve, completed, revision, reset, gate_block, phase_completed, auto_chain
- `session`: create, status_change, delete

**turn_id**: `uuid4().hex[:12]` — 프롬프트-응답 사이클을 그룹핑하는 고유 ID.
`bind_contextvars`로 자동 전파되어 모든 하위 로그에 포함됩니다.

**Loki 라벨 카디널리티 관리**:
- `component` (6값), `operation` (~25값)만 Loki 라벨로 설정
- `session_id`, `turn_id`, `workflow_phase`는 JSON 필드로만 추출 (카디널리티 폭발 방지)

### 2. AI 피드백 루프 (Part B)

세션 완료 시 이벤트 DB를 분석하여 자동으로 WorkspaceInsight를 생성하는 파이프라인입니다.

**데이터 흐름**:
1. 세션 이벤트 → `SessionAnalysisService.generate_auto_insights()`
2. 규칙 기반 분석 → `WorkspaceInsight` 테이블에 `is_auto_generated=True`로 저장
3. 다음 세션 시작 시 → `InsightService.build_insight_context()` → AI 시스템 프롬프트 자동 주입

**트리거 조건**:
- 워크플로우 완료 시: `claude_runner.py` 워크플로우 종료 지점
- 비워크플로우 턴 완료 시: 에러가 아닌 정상 결과 수신 시

**자동 인사이트 규칙** (5종):
- 에러 발생 세션 → `session_analysis` 카테고리
- Stall/재시도 빈번 세션 → `performance` 카테고리
- 고비용 세션 (>$1.0) → `performance` 카테고리
- 워크플로우 완료 세션 → `session_analysis` 카테고리
- 도구 과다 사용 (>50회) → `performance` 카테고리

**과잉 생성 방지**: 워크스페이스당 최대 20개, 초과 시 오래된 것부터 아카이브

### 3. Grafana 대시보드 (2개)

- **session-lifecycle.json**: 개별 세션 심층 분석 (타임라인, 턴 메트릭, 토큰, 도구, 워크플로우)
- **sessions-overview.json**: 전체 세션 트렌드 (시간대별, 에러율, 비용, 컴포넌트 분포)

## 관련 커밋

- (커밋 후 업데이트 예정)

## 테스트 방법

1. 세션 생성 및 메시지 전송 → Grafana에서 구조화 로그 확인
2. `GET /api/v1/sessions/{session_id}/summary` 호출 → 세션 요약 확인
3. 워크플로우 완료 후 → 자동 인사이트 생성 확인 (DB 또는 인사이트 API)

## 검증 결과

- `uv run pytest` → 370건 통과 (1건 기존 실패 — test_usage_service.py)
- `uv run ruff check` → 모든 변경 파일 통과
- QA 코드 리뷰 → 4/4 APPROVE (2건 비기능 WARN만 존재)

## 비고

- `insight_service.py`는 `import logging` 유지 (structlog 전환은 스코프 밖, 향후 일괄 전환 권장)
- fire-and-forget 분석 태스크는 참조 미추적 (향후 태스크 레지스트리 도입 권장)
