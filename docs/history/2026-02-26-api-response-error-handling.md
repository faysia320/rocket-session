# 작업 이력: 백엔드 API 응답 및 에러 처리 구조 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

백엔드 API의 응답 형식과 에러 처리 방식을 통일하여 일관성, 안전성, 유지보수성을 개선했습니다.
도메인 예외 계층을 도입하고, 글로벌 예외 핸들러를 등록하며, DELETE/액션 응답에 공통 스키마를 적용했습니다.

## 변경 파일 목록

### Backend (신규)

- `backend/app/core/exceptions.py` - 도메인 예외 계층 (AppError, NotFoundError, ConflictError, ValidationError, ForbiddenError)
- `backend/app/schemas/common.py` - 공통 응답 스키마 (StatusResponse, MarkReadResponse)

### Backend (수정)

- `backend/app/main.py` - 글로벌 예외 핸들러 2개 등록 (AppError, unhandled Exception)
- `backend/app/services/tag_service.py` - create_tag에 중복 이름 체크 추가 (ConflictError)
- `backend/app/services/workspace_service.py` - RebaseConflictError가 ConflictError 상속
- `backend/app/api/v1/endpoints/tags.py` - try/except 제거, DELETE response_model 추가
- `backend/app/api/v1/endpoints/sessions.py` - POST 201, GET/DELETE/액션 response_model 추가
- `backend/app/api/v1/endpoints/mcp.py` - DELETE response_model 추가
- `backend/app/api/v1/endpoints/filesystem.py` - worktree DELETE 응답 통일
- `backend/app/api/v1/endpoints/workspaces.py` - DELETE response_model 추가
- `backend/app/api/v1/endpoints/teams.py` - DELETE/reorder/mark-read response_model 추가
- `backend/app/api/v1/endpoints/workflow_definitions.py` - DELETE response_model 추가

### Frontend

- `frontend/src/lib/api/filesystem.api.ts` - removeWorktree 반환 타입 수정

## 상세 변경 내용

### 1. 도메인 예외 계층 생성

서비스/리포지토리 계층에서 HTTP 관심사 없이 도메인 예외를 발생시킬 수 있도록 AppError 기반 예외 계층을 도입했습니다:
- AppError (base, 500)
- NotFoundError (404)
- ConflictError (409)
- ValidationError (400)
- ForbiddenError (403)

### 2. 글로벌 예외 핸들러

- `AppError` → `{"detail": "..."}` 응답 (프론트엔드 ApiError 호환)
- 미처리 `Exception` → 로깅 후 안전한 500 메시지 반환 (스택 트레이스 미노출)

### 3. P0 버그 수정: tags UNIQUE 제약

- 기존: `"UNIQUE constraint" in str(e)` — PostgreSQL asyncpg에서 동작하지 않는 패턴
- 수정: 서비스 계층에서 `repo.get_by_name()` 사전 체크 → `ConflictError` 발생

### 4. RebaseConflictError 상속 변경

- `Exception` → `ConflictError` 상속으로 변경하여 글로벌 핸들러가 자동 처리 가능

### 5. DELETE/액션 응답 통일

- 모든 DELETE/액션 엔드포인트에 `response_model=StatusResponse` 추가
- dict 리터럴 대신 `StatusResponse(status="...")` 반환
- worktree DELETE: `{"ok": true}` → `StatusResponse(status="deleted")`
- unarchive: `{"status": "idle"}` → `StatusResponse(status="unarchived")`

### 6. response_model / status_code 보완

- POST /sessions/ 및 /sessions/{id}/fork: status_code=201 추가
- GET /sessions/, /sessions/{id}: response_model=SessionInfo 추가

## 테스트 방법

```bash
cd backend && uv run python -c "from app.main import app; print('OK')"
cd frontend && pnpm build
```

## 비고

- 프론트엔드 변경 최소화: `{"detail": "..."}` 형식 유지로 기존 `ApiError` 처리와 호환
- 기존 TS 타입 오류 1건(useWorkflowActions.ts)은 이번 변경과 무관한 기존 이슈
