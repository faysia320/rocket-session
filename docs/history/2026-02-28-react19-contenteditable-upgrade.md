# 작업 이력: React 19 업그레이드, Memo 에디터 contentEditable 전환, UI 개선

- **날짜**: 2026-02-28
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Python 3.14 업그레이드, React 19 마이그레이션, Memo 에디터를 CodeMirror에서 경량 contentEditable로 전환, native select를 Radix Select로 교체, 워크플로우 반응형 UI 개선 등 전반적인 의존성 업그레이드와 UI 품질 향상을 수행했습니다.

## 변경 파일 목록

### Backend

- `backend/Dockerfile` - Python 3.11→3.14 베이스 이미지 업그레이드
- `backend/pyproject.toml` - Python 3.14 요구사항, pydantic 버전 범위 변경
- `backend/uv.lock` - 의존성 lock 파일 업데이트
- `backend/tests/test_workflow_gate.py` - resolve_workflow_state 기반 테스트 리팩토링

### Frontend

- `frontend/package.json` - React 18→19, CodeMirror 의존성 제거
- `frontend/pnpm-lock.yaml` - lock 파일 업데이트
- `frontend/src/features/memo/components/MemoBlockEditor.tsx` - CodeMirror→contentEditable 전환
- `frontend/src/features/memo/components/MemoBlockItem.tsx` - useRef 초기값 수정
- `frontend/src/features/memo/components/MemoBlockList.tsx` - EditorView API→DOM API 전환
- `frontend/src/features/memo/extensions/liveMarkdownPreview.ts` - 삭제 (CodeMirror 확장 제거)
- `frontend/src/features/memo/hooks/useMemoEditorRegistry.ts` - EditorView→HTMLDivElement 레지스트리
- `frontend/src/features/chat/components/ChatMessageList.tsx` - React 19 RefObject 타입 수정
- `frontend/src/features/chat/hooks/claudeSocketReducer.test.ts` - 테스트 데이터 보정
- `frontend/src/features/context/components/ContextSuggestionPanel.tsx` - useRef 초기값 수정
- `frontend/src/features/files/components/FilePanel.tsx` - 뷰모드 전환 시 hover 초기화
- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - useRef 초기값 수정
- `frontend/src/features/notification/components/NotificationSettingsPanel.tsx` - Radix Select 전환
- `frontend/src/features/session/components/SessionSettings.tsx` - Radix Select, ScrollArea 수정
- `frontend/src/features/session/components/Sidebar.tsx` - 커맨드 팔레트 rename 이벤트 지원
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - Radix Select, ScrollArea 수정
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` - text-sm 제거
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - text-sm 제거
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 반응형 레이아웃
- `frontend/src/index.css` - contentEditable placeholder CSS

## 상세 변경 내용

### 1. Python 3.14 업그레이드

- Dockerfile 베이스 이미지를 python:3.11-slim에서 python:3.14-slim으로 변경
- pyproject.toml의 requires-python, tool.ty.environment python-version 업데이트
- pydantic 버전을 고정값에서 범위 지정(>=2.12.0,<3.0)으로 변경

### 2. Workflow Gate 테스트 리팩토링

- `_make_mock_def_service` 헬퍼 함수 제거
- 모든 테스트에서 `get_workflow_definition_service` mock 대신 `resolve_workflow_state` mock 사용
- 게이트 진입 조건과 자동 복구 로직에 맞춰 테스트 시나리오 재작성
- `merge_session_with_globals` mock 추가

### 3. Memo 에디터 CodeMirror → contentEditable 전환

- MemoBlockEditor: CodeMirror EditorView를 contentEditable div로 대체
- 470줄 규모의 liveMarkdownPreview.ts 확장 파일 삭제
- useMemoEditorRegistry: EditorView 기반 API를 HTMLDivElement/DOM API 기반으로 전환
- MemoBlockList: CM6 dispatch API를 DOM 기반 content 조작으로 변경
- CSS placeholder를 :empty::before 의사 요소로 구현

### 4. React 19 마이그레이션

- react, react-dom 18.3→19.2 업그레이드
- @codemirror/* 6개 패키지 의존성 제거
- RefObject<T> → RefObject<T | null> 타입 수정 (React 19 breaking change)
- useRef() 초기값 undefined 명시 (strict mode 호환)

### 5. Native Select → Radix Select 교체

- NotificationSettingsPanel, SessionSettings, GlobalSettingsDialog에서 HTML select를 shadcn Select로 교체
- 빈 값("") 처리를 위한 sentinel value("__default__") 패턴 적용

### 6. UI 개선

- WorkflowProgressBar: 모바일 반응형 레이아웃 (gap, padding, truncate 처리)
- ScrollArea: min-h-0 추가로 flex 레이아웃 오버플로우 수정
- FilePanel: 뷰모드 전환 시 hover 상태 초기화
- Sidebar: command-palette:rename-session 커스텀 이벤트 리스너 추가
- Textarea: 불필요한 text-sm 클래스 제거

## 관련 커밋

- `(TBD)` - Chore: Upgrade Python 3.11→3.14 and update dependencies
- `(TBD)` - Refactor: Update workflow gate tests for resolve_workflow_state
- `(TBD)` - Refactor: Replace CodeMirror memo editor with contentEditable
- `(TBD)` - Refactor: Migrate to React 19 and replace native select with Radix Select
- `(TBD)` - Design: Improve workflow responsive layout and UI polish

## 테스트 방법

1. Backend: `pytest backend/tests/test_workflow_gate.py` 실행하여 테스트 통과 확인
2. Frontend: `pnpm build` 성공 확인
3. Memo 에디터에서 텍스트 입력, Ctrl+Enter 블록 생성, Backspace 병합 동작 확인
4. Settings 다이얼로그에서 Select 컴포넌트 동작 확인
5. 모바일 뷰에서 WorkflowProgressBar 반응형 레이아웃 확인
