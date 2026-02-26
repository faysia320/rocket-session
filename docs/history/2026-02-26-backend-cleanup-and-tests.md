# 작업 이력: 백엔드 코드 정리 및 테스트 최신화

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

백엔드 코드를 4가지 영역에서 개선했습니다:
1. 미사용 코드/함수 정리
2. 코드 구조 개선 (잘못된 모듈 위치 수정)
3. 테스트 코드 최신화 (6개 서비스 신규 테스트 137건 추가)
4. README.md 및 CLAUDE.md 문서 최신화

## 변경 파일 목록

### Backend - 미사용 코드 정리

- `backend/app/repositories/artifact_repo.py` - 미사용 `list_by_artifact()` 메서드 제거
- `backend/app/repositories/team_task_repo.py` - 미사용 `get_dependent_tasks()` 메서드 제거
- `backend/app/models/__init__.py` - `WorkflowDefinition` import/export 추가
- `backend/app/repositories/__init__.py` - 누락된 8개 Repository export 추가

### Backend - 코드 구조 개선

- `backend/app/services/pending_questions.py` - 신규 (endpoints/에서 이동)
- `backend/app/api/v1/endpoints/pending_questions.py` - 삭제 (services/로 이동)
- `backend/app/main.py` - import 경로 변경
- `backend/app/api/v1/endpoints/sessions.py` - import 경로 변경
- `backend/app/api/v1/endpoints/ws.py` - import 경로 변경
- `backend/app/services/claude_runner.py` - import 경로 변경

### Backend - 테스트 코드

- `backend/tests/conftest.py` - TRUNCATE 테이블 6건 + 서비스 fixture 6건 추가
- `backend/tests/test_tag_service.py` - 신규 (21 tests)
- `backend/tests/test_team_service.py` - 신규 (30 tests)
- `backend/tests/test_mcp_service.py` - 신규 (23 tests)
- `backend/tests/test_workspace_service.py` - 신규 (15 tests)
- `backend/tests/test_analytics_service.py` - 신규 (17 tests)
- `backend/tests/test_workflow_definition_service.py` - 신규 (31 tests)

### 문서

- `README.md` - 삭제된 template 참조 제거, workflow_definitions/token_snapshots 추가
- `claude.md` - 최종 수정일 업데이트, 신규 파일/서비스/DB 스키마 추가

## 상세 변경 내용

### 1. 미사용 코드 정리

- `ArtifactAnnotationRepository.list_by_artifact()`: `list_pending()`이 상위 기능을 제공하며, 호출처 없음
- `TeamTaskRepository.get_dependent_tasks()`: `TeamTask.depends_on_task_id` 컬럼이 모델에 없어 실행 불가, 호출처 없음
- `models/__init__.py`에 `WorkflowDefinition` 누락 → Alembic autogenerate 시 테이블 미감지 가능
- `repositories/__init__.py`에 8개 Repository 누락 → 중앙 집중 export 패턴 불완전

### 2. pending_questions.py 이동

- `pending_questions.py`는 라우터가 아닌 인메모리 상태 관리 모듈 (module-level dict)
- `endpoints/` 디렉토리에 있을 이유 없음 → `services/`로 이동
- 4개 파일의 import 경로 일괄 변경

### 3. 테스트 코드 최신화

- 기존에 테스트가 없던 6개 서비스에 대한 테스트 추가
- 실제 PostgreSQL DB를 사용하는 통합 테스트 패턴 적용
- conftest.py에 team/token/workflow 관련 TRUNCATE 테이블 추가로 테스트 격리 보장

### 4. 문서 최신화

- 삭제된 template 모듈 참조를 문서에서 제거
- 신규 추가된 workflow_definitions, token_snapshots 테이블 반영
- 누락된 API 엔드포인트 (MCP system-servers, workflow-definitions) 추가

## 관련 커밋

- 커밋 후 업데이트 예정

## 테스트 방법

```bash
cd backend
uv run pytest tests/test_tag_service.py tests/test_team_service.py tests/test_mcp_service.py tests/test_workspace_service.py tests/test_analytics_service.py tests/test_workflow_definition_service.py -v
# 137 passed in ~13s
```
