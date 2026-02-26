# 작업 이력: File Changes 패널 diff hover card UX 전면 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

다양한 개선 사항을 일괄 적용: Git Force Pull 기능, 프론트엔드 코드 품질 개선, 백엔드 코드 포매팅 정리.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/workspaces.py` - Force pull 409 에러 핸들링 추가
- `backend/app/schemas/workspace.py` - `force` 필드 추가
- `backend/app/services/workspace_service.py` - `RebaseConflictError` 예외 + force pull 로직
- `backend/app/services/git_service.py` - Smart pull (rebase 시도 → abort → 결과 분류) + `reset_to_remote`
- 기타 50+ 파일 - ruff 포매터 적용 (라인 래핑, import 정리)

### Frontend

- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - Force Pull 다이얼로그 + 핸들러 추가
- `frontend/src/types/workspace.ts` - `WorkspaceSyncRequest`에 `force` 옵션 추가
- `frontend/src/features/chat/components/MessageBubble.tsx` - `useMemo` 최적화
- `frontend/src/features/chat/utils/chatComputations.ts` - `assistant_text` 뒤 tight 간격 적용
- `frontend/src/features/chat/components/ChatInput.tsx` - useCallback deps 수정
- `frontend/src/features/chat/components/ChatPanel.tsx` - 미사용 import 제거
- `frontend/eslint.config.js` - 테스트 파일 `as any` 허용 규칙 추가
- `frontend/src/components/ui/MarkdownRenderer.tsx` - eslint disable 주석 추가
- 기타 테스트 파일 수정

## 상세 변경 내용

### 1. Git Force Pull 기능

- rebase 충돌 시 409 에러로 응답하여 프론트엔드에서 Force Pull 다이얼로그 표시
- Force Pull 실행 시 `git reset --hard origin/<branch>`로 원격 브랜치 상태로 리셋
- `RebaseConflictError` 커스텀 예외로 충돌 상태 명확하게 전달

### 2. 코드 품질 개선

- `ToolUseMessage`의 `input` 변수를 `useMemo`로 감싸 불필요한 재렌더링 방지
- `chatComputations`에서 `assistant_text` → `tool_use` 간 tight 간격 적용
- `ChatInput`의 useCallback deps에서 `status` → `isEffectivelyRunning`으로 정확한 의존성 사용
- ESLint 설정에서 테스트 파일의 `@typescript-eslint/no-explicit-any` 비활성화

### 3. 백엔드 코드 포매팅

- ruff 포매터 적용으로 전체 백엔드 코드 일관성 확보

## 관련 커밋

- `{hash}` - Feat: Add Git Force Pull 기능 (rebase 충돌 대응)
- `{hash}` - Refactor: 프론트엔드 코드 품질 개선
- `{hash}` - style: 백엔드 ruff 포매팅 적용

## 테스트 방법

1. Git Monitor에서 워크스페이스 Pull 시 rebase 충돌 발생하면 Force Pull 다이얼로그 확인
2. Force Pull 클릭 후 원격 브랜치로 정상 리셋 확인
