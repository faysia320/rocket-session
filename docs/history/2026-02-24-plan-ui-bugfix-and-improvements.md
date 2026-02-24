# 작업 이력: Plan UI 버그 수정 + Office/Worktree/UI 개선

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Workflow 자동 체이닝 후 발생한 두 가지 Plan UI 버그를 수정하고, Office 페이지 라우트 추가, Worktree 타임아웃 처리 개선, ChatInput/ActivityStatusBar 간격 축소 등 UI 개선을 수행했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - result_text를 turn_state에 저장하여 finally 블록에서 활용, implement 완료 처리 추가
- `backend/app/services/git_service.py` - worktree 생성/삭제 타임아웃 처리 개선

### Frontend

- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - handleOpenArtifact를 phase 기반 조회로 변경
- `frontend/src/features/chat/components/MessageBubble.tsx` - onOpenArtifact prop 타입 및 호출부 변경
- `frontend/src/features/chat/components/ChatMessageList.tsx` - onOpenArtifact prop 타입 일치
- `frontend/src/features/chat/components/ChatPanel.tsx` - ActivityStatusBar 위치 이동
- `frontend/src/features/chat/components/ChatInput.tsx` - 간격 축소
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - 간격 축소
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Office 네비게이션 추가
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 워크트리 생성 중 문구
- `frontend/src/lib/api/client.ts` - timeout 파라미터 지원
- `frontend/src/lib/api/sessions.api.ts` - 워크트리 관련 API 타임아웃 설정
- `frontend/src/routeTree.gen.ts` - Office 라우트 자동 생성
- `frontend/src/routes/__root.tsx` - Office 레이아웃 추가
- `frontend/src/routes/office.tsx` - Office 페이지 라우트 (신규)
- `frontend/src/features/office/` - Office 기능 컴포넌트 (신규)

## 상세 변경 내용

### 1. Plan 완료 카드 빈 내용 버그 수정

- `_handle_result_event`에서 `extract_result_data()`가 계산한 `result_text`를 `turn_state["result_text"]`에 저장
- `finally` 블록에서 `turn_state.get("result_text")`를 우선 사용, 없으면 `turn_state.get("text", "")`로 폴백
- CLI가 최종 텍스트를 result 이벤트의 result 필드로만 보낼 때 `turn_state["text"]`가 빈 값이 되는 문제 해결

### 2. "아티팩트 열기" 버튼 동작 수정

- `handleOpenArtifact(artifactId: number)` → `handleOpenArtifact(phase: string)` 시그니처 변경
- API로 해당 phase의 최신 아티팩트를 조회하여 ID를 설정
- `onOpenArtifact(0)` → `onOpenArtifact(message.workflow_phase ?? "plan")`으로 변경

### 3. Office 페이지 라우트 추가

- 새 Office 기능 페이지 라우트 및 레이아웃 추가
- GlobalTopBar에 Office 네비게이션 항목 추가

### 4. Worktree 타임아웃 처리 개선

- git_service.py: 워크트리 생성 120초, 삭제 60초 타임아웃 설정
- ApiClient: post/put/patch/delete에 timeoutMs 파라미터 추가
- sessions.api: 워크트리 관련 API에 150초 타임아웃 적용

### 5. UI 간격 축소

- ChatInput: 패딩, 버튼 크기, 텍스트 크기 축소
- ActivityStatusBar: 수직 패딩 축소
- ChatPanel: ActivityStatusBar를 ChatInput 아래로 이동

## 테스트 방법

1. 워크플로우 시작 → Research → Plan 자동 체이닝
2. Plan 완료 시 카드에 계획 텍스트가 표시되는지 확인
3. "아티팩트 열기" 클릭 → ArtifactViewer에 Plan 내용 표시 확인
