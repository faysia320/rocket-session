# 작업 이력: 백엔드 코드 단순화 4단계 리팩토링

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

백엔드(~16,000 LOC)에 누적된 보일러플레이트와 중복 코드를 4단계에 걸쳐 단순화하여 ~400 LOC를 감소시킴.
동작 변경 없이 유지보수성을 향상시키는 것이 목표.

## 변경 파일 목록

### Backend - 신규 파일

- `backend/app/core/utils.py` - `utc_now()`, `utc_now_iso()` 중앙 유틸리티
- `backend/app/services/base.py` - `DBService` 베이스 클래스 (`_session_scope` 컨텍스트 매니저)

### Backend - Repositories

- `backend/app/repositories/base.py` - `get_all_ordered()`, `update_by_id()` 공통 메서드 추가
- `backend/app/repositories/session_repo.py` - `_counts_query()` 헬퍼 추출, `_session_to_dict` 단순화
- `backend/app/repositories/tag_repo.py` - 중복 `list_all()`, `update_tag()` 제거
- `backend/app/repositories/mcp_server_repo.py` - 중복 `list_all()`, `update_server()` 제거
- `backend/app/repositories/workspace_repo.py` - 중복 `list_all()`, `update_workspace()` 제거
- `backend/app/repositories/team_repo.py` - 중복 `update_team()` 제거
- `backend/app/repositories/team_task_repo.py` - `utc_now()` import 교체

### Backend - Schemas

- `backend/app/schemas/tag.py` - `ConfigDict(from_attributes=True)` 추가
- `backend/app/schemas/mcp.py` - `ConfigDict(from_attributes=True)` 추가
- `backend/app/schemas/session.py` - `ConfigDict(from_attributes=True)` 추가
- `backend/app/schemas/workflow_definition.py` - `ConfigDict(from_attributes=True)` + `@field_validator("steps")` 추가

### Backend - Services (13개 마이그레이션)

- `backend/app/services/session_manager.py` - DBService 상속, 도메인 예외, `to_info` 단순화, `utc_now()` 교체
- `backend/app/services/tag_service.py` - DBService 상속, 도메인 예외, `_entity_to_info` 제거
- `backend/app/services/mcp_service.py` - DBService 상속, 도메인 예외, `_entity_to_info` 제거
- `backend/app/services/workspace_service.py` - DBService 상속, 도메인 예외
- `backend/app/services/team_service.py` - DBService 상속, 도메인 예외
- `backend/app/services/team_task_service.py` - DBService 상속, 도메인 예외
- `backend/app/services/team_message_service.py` - DBService 상속
- `backend/app/services/workflow_service.py` - 도메인 예외, `utc_now()` 교체
- `backend/app/services/workflow_definition_service.py` - DBService 상속, 도메인 예외, `_entity_to_info` 제거
- `backend/app/services/settings_service.py` - DBService 상속
- `backend/app/services/analytics_service.py` - DBService 상속
- `backend/app/services/search_service.py` - DBService 상속, `_to_info` 제거
- `backend/app/services/local_session_scanner.py` - DBService 상속
- `backend/app/services/websocket_manager.py` - DBService 상속 (지연 주입 패턴 유지)
- `backend/app/services/event_handler.py` - `utc_now` 재export로 변경
- `backend/app/services/claude_runner.py` - `utc_now()` 교체
- `backend/app/services/filesystem_service.py` - 도메인 예외
- `backend/app/services/git_service.py` - 도메인 예외
- `backend/app/services/jsonl_watcher.py` - `utc_now()` 교체
- `backend/app/services/team_coordinator.py` - `utc_now()` 교체

### Backend - Endpoints (11개)

- `backend/app/api/v1/endpoints/sessions.py` - HTTPException null 체크 제거 (-25건)
- `backend/app/api/v1/endpoints/teams.py` - HTTPException null 체크 제거 (-20건)
- `backend/app/api/v1/endpoints/workflow.py` - HTTPException null 체크 제거
- `backend/app/api/v1/endpoints/workflow_definitions.py` - HTTPException null 체크 제거
- `backend/app/api/v1/endpoints/tags.py` - HTTPException null 체크 제거
- `backend/app/api/v1/endpoints/mcp.py` - HTTPException null 체크 제거
- `backend/app/api/v1/endpoints/workspaces.py` - HTTPException null 체크 제거
- `backend/app/api/v1/endpoints/filesystem.py` - HTTPException try/except 제거 (-28건)
- `backend/app/api/v1/endpoints/files.py` - HTTPException null 체크 제거
- `backend/app/api/v1/endpoints/local_sessions.py` - HTTPException null 체크 제거
- `backend/app/api/v1/endpoints/health.py` - `utc_now()` 교체
- `backend/app/api/v1/endpoints/ws.py` - `utc_now()` 교체, 미사용 import 제거

### Backend - Tests (7개)

- `backend/tests/test_session_manager.py` - 도메인 예외 assertion 수정
- `backend/tests/test_tag_service.py` - 도메인 예외 assertion 수정
- `backend/tests/test_mcp_service.py` - 도메인 예외 assertion 수정
- `backend/tests/test_workspace_service.py` - 도메인 예외 assertion 수정
- `backend/tests/test_team_service.py` - 도메인 예외 assertion 수정
- `backend/tests/test_workflow_definition_service.py` - 도메인 예외 assertion 수정
- `backend/tests/test_filesystem_service.py` - 도메인 예외 assertion 수정

### Frontend (이전 세션 미커밋 변경)

- `frontend/src/features/chat/components/ChatInput.tsx` - Array→Set 최적화
- `frontend/src/features/chat/components/ChatMessageList.tsx` - useMemo 검색 매치 Set
- `frontend/src/features/chat/components/MessageBubble.tsx` - Array→Set 최적화
- `frontend/src/features/chat/components/PermissionDialog.tsx` - Array→Set 최적화
- `frontend/src/features/chat/utils/chatComputations.ts` - Array→Set 최적화
- `frontend/src/routes/team/$teamId.tsx` - lazy loading 적용
- `frontend/src/routes/team/index.tsx` - lazy loading 적용
- `frontend/vite.config.ts` - recharts, dnd-kit 번들 분리
- `frontend/src/types/shared-fields.ts` - 공유 필드 타입 (신규)

## 상세 변경 내용

### Phase 1: 기반 유틸리티

- `utc_now()` 중앙화: 18개 파일에서 `datetime.now(timezone.utc)` 패턴을 `utc_now()` 호출로 교체
- `BaseRepository` 확장: `get_all_ordered()`, `update_by_id()` 추가, 4개 repo에서 중복 메서드 제거
- `SessionRepository` 서브쿼리 중복 제거: `_counts_query()` 헬퍼로 추출

### Phase 2: 도메인 예외 활용

- 11개 서비스에서 `None` 반환 대신 `NotFoundError`, `ValidationError`, `ForbiddenError` 직접 발생
- 11개 엔드포인트에서 HTTPException null 체크 + try/except 블록 제거
- 글로벌 에러 핸들러 `_app_error_handler`가 도메인 예외를 자동으로 HTTP 응답으로 변환

### Phase 3: ORM→Schema 변환 단순화

- 4개 스키마에 `ConfigDict(from_attributes=True)` 추가
- `_entity_to_info`, `_dict_to_info`, `_to_info` 수동 매핑 메서드 제거
- `SessionInfo.model_validate(session_dict)`로 단순 변환

### Phase 4: DBService 베이스 클래스

- `DBService` 베이스 클래스 생성: `_session_scope(*repo_classes)` 컨텍스트 매니저
- 13개 서비스 마이그레이션: `__init__` + DB 세션 보일러플레이트 제거

## 관련 커밋

- (아래에서 커밋 후 업데이트)

## 테스트 결과

- 관련 테스트: 179 passed (모두 통과)
- 전체 테스트: 265 passed, 5 failed (기존 이슈), 51 errors (기존 workflow_service import 이슈)
- 빌드: `from app.main import app` → OK
- 린트: ruff check → 0 errors

## 비고

- **-400 LOC 감소** (1,095 삭제, 699 추가), 58개 파일 수정
- HTTP 응답 형식은 글로벌 에러 핸들러를 통해 동일하게 유지됨
- `WebSocketManager`는 지연 DB 주입 패턴이 있어 `__init__`에서 `self._db = None` 직접 설정
- `WorkflowDefinitionInfo.steps`는 JSONB 파싱/정렬 로직을 `@field_validator`로 이동
