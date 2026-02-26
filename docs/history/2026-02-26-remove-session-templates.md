# 작업 이력: 세션 템플릿 기능 전체 삭제

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 템플릿(Session Templates) 기능을 코드베이스에서 완전히 제거했습니다. 더 이상 사용하지 않는 기능으로, 백엔드(모델/스키마/레포/서비스/API), 프론트엔드(컴포넌트/훅/타입/API), DB 마이그레이션, 테스트, 문서까지 모든 관련 코드를 정리했습니다.

## 변경 파일 목록

### Backend - 삭제

- `backend/app/models/template.py` - SessionTemplate ORM 모델
- `backend/app/schemas/template.py` - Pydantic 스키마 (5개 클래스)
- `backend/app/repositories/template_repo.py` - TemplateRepository
- `backend/app/services/template_service.py` - TemplateService (CRUD + import/export)
- `backend/app/api/v1/endpoints/templates.py` - REST 엔드포인트 8개

### Backend - 수정

- `backend/app/models/__init__.py` - SessionTemplate export 제거
- `backend/app/repositories/__init__.py` - TemplateRepository export 제거
- `backend/app/api/v1/api.py` - templates router 등록 제거
- `backend/app/api/dependencies.py` - TemplateService DI 등록 전체 제거
- `backend/app/schemas/session.py` - CreateSessionRequest.template_id 필드 제거
- `backend/app/api/v1/endpoints/sessions.py` - 템플릿 폴백 로직 제거, req 직접 사용으로 단순화

### Backend - 테스트

- `backend/tests/conftest.py` - session_templates truncate 목록에서 제거
- `backend/tests/test_api_endpoints.py` - TemplateService 의존성 제거

### Backend - 마이그레이션

- `backend/migrations/versions/20260226_0018_drop_session_templates.py` - session_templates 테이블 DROP (신규)

### Frontend - 삭제

- `frontend/src/features/template/` - 디렉토리 전체 (컴포넌트 4 + 훅 2)
- `frontend/src/types/template.ts` - TypeScript 타입 정의
- `frontend/src/lib/api/templates.api.ts` - API 레이어

### Frontend - 수정

- `frontend/src/types/index.ts` - Template type export 제거
- `frontend/src/types/session.ts` - template_id 필드 제거
- `frontend/src/features/session/components/Sidebar.tsx` - TemplateListDialog 버튼 제거
- `frontend/src/features/session/components/SessionSettings.tsx` - SaveAsTemplateDialog 제거
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - TemplateSelector UI/state/handler 제거
- `frontend/src/features/session/hooks/useSessions.ts` - template_id 타입 제거
- `frontend/src/lib/api/sessions.api.ts` - template_id 파라미터 제거

### 문서

- `claude.md` - Templates 관련 언급 14곳 제거

## 상세 변경 내용

### 1. 백엔드 전용 파일 삭제

SessionTemplate ORM 모델, Pydantic 스키마, TemplateRepository, TemplateService, REST 엔드포인트 총 5개 파일을 삭제했습니다.

### 2. 세션 생성 로직 단순화

`sessions.py`의 `create_session()` 에서 템플릿 폴백 로직(~60줄)을 제거하고, `req.*` 값을 직접 `manager.create()`에 전달하도록 단순화했습니다. MCP 서버 로직도 `요청값 > 활성화된 서버` 2단계로 간소화.

### 3. DI 레지스트리 정리

`dependencies.py`에서 TemplateService import, 속성, 초기화, getter 함수를 모두 제거했습니다.

### 4. 프론트엔드 UI 정리

Sidebar의 Templates 버튼, SessionSettings의 "템플릿으로 저장" 버튼, SessionSetupPanel의 Template Selector 섹션을 제거했습니다.

### 5. DB 마이그레이션

`session_templates` 테이블을 DROP하는 Alembic 마이그레이션(0018)을 추가했습니다. downgrade에서 테이블 재생성 가능.

## 비고

- `cli/templates/` (배포용 docker-compose)는 세션 템플릿과 무관하여 삭제하지 않음
- `prompt_template` (WorkflowStepConfig 필드)은 워크플로우 기능 소속으로 삭제하지 않음
- 기존 Alembic 마이그레이션 파일은 히스토리 보존을 위해 수정하지 않음
