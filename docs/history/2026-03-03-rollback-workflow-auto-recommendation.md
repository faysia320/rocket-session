# 작업 이력: 워크플로우 자동 추천 롤백 + 수동 선택 잠금

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

AI 기반 워크플로우 자동 추천 기능을 전면 롤백하고, 사용자가 ChatPanel 상단 WorkflowProgressBar에서 수동으로 워크플로우를 선택/변경하되 첫 메시지 전송 후에는 워크플로우가 잠금되도록 변경했습니다. 새 세션 생성 또는 `/clear` 시에만 재선택이 가능합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/workflow_recommender_service.py` - **삭제**: AI 자동 추천 서비스 전체 제거
- `backend/app/api/dependencies.py` - WorkflowRecommenderService DI 등록 제거 (import, 속성, 초기화, getter 4곳)
- `backend/app/api/v1/endpoints/ws.py` - 자동 추천 블록(50줄) 제거, `workflow_original_prompt` 저장만 유지
- `backend/tests/test_workflow_gate.py` - 추천 관련 mock/patch 제거 (2개 테스트)

### Frontend

- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - `isLocked` prop 추가, Settings2 버튼 잠금 로직
- `frontend/src/features/chat/components/ChatPanel.tsx` - `hasUserMessages` 계산 + `isLocked` prop 전달
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - toast 문구에서 "AI가" 제거
- `frontend/src/features/git-monitor/components/CommitDialog.tsx` - "AI 자동 선택" → "기본 워크플로우 적용" 문구 변경

## 상세 변경 내용

### 1. AI 워크플로우 자동 추천 전면 롤백

- `WorkflowRecommenderService` 파일 삭제 (Claude CLI subprocess 호출로 추천하던 로직)
- `ws.py`의 첫 메시지 감지 → AI 추천 → 워크플로우 전환 → `workflow_changed` 브로드캐스트 블록 제거
- `workflow_original_prompt` 저장 로직은 유지 (`build_phase_context`에서 `{user_prompt}` 템플릿에 사용)

### 2. 워크플로우 수동 선택 잠금 메커니즘

- `WorkflowProgressBar`에 `isLocked` prop 추가: `disabled={isRunning || isLocked}`
- `ChatPanel`에서 `hasUserMessages = messages.some(m => m.type === "user_message")` 계산
- 첫 user 메시지 전송 후 Settings2 버튼 비활성화 (잠금)
- `/clear` 시 messages 배열이 비워져 자동으로 잠금 해제

## 테스트 방법

1. 새 세션 생성 → default 워크플로우 표시, Settings2 버튼 활성화
2. Settings2 클릭 → 워크플로우 변경 가능
3. 첫 메시지 전송 → Settings2 버튼 비활성화 (tooltip: "대화 시작 후 워크플로우를 변경할 수 없습니다")
4. `/clear` 입력 → Settings2 버튼 다시 활성화
5. 페이지 새로고침 → 대화 있으면 잠금 유지

## 비고

- 세션 생성 시 default 워크플로우 자동 할당 로직(sessions.py)은 현행 유지
- "선택안함" 옵션은 없음 (항상 워크플로우가 선택된 상태)
- `workflow_changed` WS 이벤트 핸들러는 프론트엔드에 남아있으나, 백엔드에서 더 이상 발생하지 않음 (dead code, 무해)
