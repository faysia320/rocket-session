# 작업 이력: 워크플로우 인라인 커밋 기능 제거

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 완료 시 File Changes 패널에 자동으로 표시되던 인라인 커밋 UI(CommitSection)를 전체 제거하고, 기존의 Git Monitor `/git-commit` 스킬 방식으로 롤백했다.

제거된 기능:
- 워크플로우 완료 시 자동 커밋 메시지 생성 (`generate_commit_suggestion`)
- File Changes Drawer 내 인라인 커밋 폼 (`CommitSection` 컴포넌트)
- REST API를 통한 stage + commit + push 엔드포인트 (`/workflow/commit`, `/workflow/commit-suggestion`)
- WebSocket 재연결 시 `commit_suggestion` 재생성 로직

유지된 기능:
- Git Monitor의 `/git-commit` 스킬 버튼 + `pendingPrompt` 메커니즘
- File Changes 패널 자체 (파일 변경 추적 기능)

## 변경 파일 목록

### Backend (5개)

- `backend/app/api/v1/endpoints/workflow.py` - `get_commit_suggestion`, `commit_workflow` 엔드포인트 + 관련 import 제거
- `backend/app/schemas/workflow.py` - `WorkflowCommitSuggestion`, `WorkflowCommitRequest`, `WorkflowCommitResponse` 스키마 제거
- `backend/app/services/workflow_service.py` - `generate_commit_suggestion` 메서드 + 헬퍼 함수 3개 + 상수 제거
- `backend/app/services/claude_runner.py` - implement 완료 시 commit_suggestion 생성/전송 로직 제거
- `backend/app/api/v1/endpoints/ws.py` - 연결/재연결 시 commit_suggestion 재생성 로직 제거

### Frontend (9개)

- `frontend/src/features/files/components/CommitSection.tsx` - **파일 삭제**
- `frontend/src/features/files/components/FilePanel.tsx` - CommitSection import/props/렌더링 제거
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - commitSuggestion 상태/액션/리듀서 제거
- `frontend/src/features/chat/hooks/claudeSocketReducer.test.ts` - commitSuggestion 참조 제거
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - commitSuggestion 관련 반환값/함수 제거
- `frontend/src/features/chat/components/ChatPanel.tsx` - commit 관련 destructuring/콜백/props 제거
- `frontend/src/features/chat/components/ChatHeader.tsx` - commit 관련 props 제거
- `frontend/src/types/workflow.ts` - `WorkflowCommitSuggestion`, `WorkflowCommitResponse` 타입 제거
- `frontend/src/lib/api/workflow.api.ts` - `getCommitSuggestion`, `commit` API 메서드 제거

## 상세 변경 내용

### 1. 인라인 커밋 UI 제거

- `CommitSection.tsx` 컴포넌트 파일 삭제 (99줄)
- `FilePanel`에서 CommitSection 관련 props와 렌더링 블록 제거
- `ChatHeader`에서 commit 관련 props 3개 제거
- `ChatPanel`에서 `handleCommitSuccess` 콜백, 자동 Drawer 열기 useEffect 제거

### 2. WebSocket 상태 관리에서 commitSuggestion 제거

- `ClaudeSocketState`에서 `commitSuggestion` 필드 제거
- `WS_WORKFLOW_COMPLETED` 액션에서 `commitSuggestion` 프로퍼티 제거
- `CLEAR_COMMIT_SUGGESTION` 액션 타입 전체 제거
- `useClaudeSocket`에서 `clearCommitSuggestion` 함수와 반환값 제거

### 3. 백엔드 API 엔드포인트 제거

- `GET /workflow/commit-suggestion` 엔드포인트 제거
- `POST /workflow/commit` 엔드포인트 제거 (stage + commit + push)
- 관련 Pydantic 스키마 3개 제거

### 4. 커밋 메시지 자동 생성 로직 제거

- `WorkflowService.generate_commit_suggestion()` 메서드 제거
- `_detect_commit_type()`, `_extract_plan_title()`, `_extract_plan_bullets()` 헬퍼 함수 제거
- `_COMMIT_TYPE_KEYWORDS` 상수 제거
- `claude_runner.py`의 implement 완료 후 자동 생성 로직 제거
- `ws.py`의 연결/재연결 시 재생성 로직 제거

## 테스트 방법

1. TypeScript 타입 체크 통과 확인: `cd frontend && npx tsc --noEmit`
2. 프론트엔드 빌드 성공 확인: `npm run build`
3. 기존 테스트 통과 확인: `npx vitest run` (기존 실패 21개 유지, 추가 실패 0)
4. 백엔드 import 검증: `python -c "from app.api.v1.endpoints.workflow import router"`
5. 워크플로우 완료 후 CommitSection이 표시되지 않는지 확인
6. Git Monitor에서 커밋 버튼 클릭 시 `/git-commit` 스킬이 정상 실행되는지 확인

## 비고

- `event_types.py`의 `WORKFLOW_COMMIT_COMPLETED` 상수는 사용처가 없어졌지만, 이벤트 타입 열거형이라 무해하므로 유지
- `git_service.py`의 `stage_files()`, `commit()`, `push()` 메서드는 다른 곳에서 사용될 수 있으므로 유지
