# 작업 이력: 워크스페이스 auto_push 제거 + 삭제 UI 추가

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크스페이스의 `auto_push` 옵션을 전체 스택에서 제거했습니다. 실제 동작하지 않는 미구현 기능이므로 혼란 방지를 위해 삭제합니다.
또한 Git Monitor 페이지에 워크스페이스 삭제 기능(확인 다이얼로그 포함)을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/workspace.py` - `auto_push` 필드 제거 (Create, Update, Info)
- `backend/app/models/workspace.py` - `auto_push` 컬럼 + `Boolean` import 제거
- `backend/app/services/workspace_service.py` - `auto_push` 파라미터/참조 제거
- `backend/app/api/v1/endpoints/workspaces.py` - `auto_push` 전달 제거
- `backend/migrations/versions/20260225_0014_...` - `auto_push` 컬럼 drop 마이그레이션

### Frontend

- `frontend/src/types/workspace.ts` - `auto_push` 필드 제거
- `frontend/src/features/workspace/components/WorkspaceCreateDialog.tsx` - Auto Push 토글 UI 제거
- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - 워크스페이스 삭제 UI 추가

## 상세 변경 내용

### 1. auto_push 옵션 전체 제거

- DB 컬럼, ORM 모델, Pydantic 스키마, API 엔드포인트, 서비스 로직, 프론트 타입/UI에서 일괄 제거
- Alembic 마이그레이션으로 컬럼 drop 처리

### 2. 워크스페이스 삭제 UI

- Git Monitor 페이지에서 워크스페이스 옵션 메뉴(DropdownMenu) 추가
- 삭제 확인 AlertDialog로 안전한 삭제 UX 제공
