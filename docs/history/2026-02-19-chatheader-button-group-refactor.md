# 작업 이력: ChatHeader 우측 버튼 3그룹 리팩토링

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

ChatHeader 우측에 개별 나열되던 4개 버튼(내보내기, 설정, 파일변경)과 ChatInput 위에 플로팅으로 존재하던 Git 액션 버튼들을 3개 논리 그룹(Git DropdownMenu, Session DropdownMenu, File Changes)으로 통합했습니다. shadcn/ui DropdownMenu + ButtonGroup을 도입하여 UI 일관성을 개선했습니다.

## 변경 파일 목록

### Frontend - 신규

- `src/components/ui/dropdown-menu.tsx` - shadcn/ui DropdownMenu 컴포넌트
- `src/components/ui/button-group.tsx` - ButtonGroup 컴포넌트 (border-radius 병합)
- `src/features/chat/components/GitDropdownMenu.tsx` - Git 액션 드롭다운 메뉴 (Commit, PR, Rebase, 워크트리 삭제)
- `src/features/chat/components/SessionDropdownMenu.tsx` - 세션 드롭다운 메뉴 (대화 내보내기, 세션 설정)
- `src/features/chat/components/TodoWriteMessage.tsx` - TodoWrite 도구 전용 메시지 렌더러

### Frontend - 수정

- `src/features/chat/components/ChatHeader.tsx` - 3그룹 레이아웃 적용, props 추가
- `src/features/chat/components/ChatPanel.tsx` - GitActionsBar 제거, ChatHeader에 props 전달
- `src/features/session/components/SessionSettings.tsx` - SheetTrigger 제거, controlled-only 패턴
- `src/features/chat/components/MessageBubble.tsx` - TodoWrite 도구 분기 추가
- `src/features/chat/utils/chatComputations.ts` - ask_user_question estimateSize 추가
- `src/features/session/components/SessionStatsBar.tsx` - 누적 비용 표시 제거
- `src/routes/__root.tsx` - split view 포커스 테두리 개선
- `src/components/ui/sheet.tsx` - Sheet 스코핑 개선 (container 외부 클릭 방지)
- `package.json` - @radix-ui/react-dropdown-menu 추가

### Frontend - 삭제

- `src/features/chat/components/GitActionsBar.tsx` - 로직이 GitDropdownMenu로 이전

## 상세 변경 내용

### 1. ChatHeader 3그룹 레이아웃

- Git DropdownMenu: git repo인 경우 조건부 표시 (Commit, PR, Rebase, 워크트리 삭제)
- ButtonGroup[Session DropdownMenu + File Changes]: 대화 내보내기/세션 설정 + 파일 변경 패널
- SessionSettings는 controlled Sheet로 분리 (SheetTrigger 제거)

### 2. TodoWriteMessage 컴포넌트

- tool_use 이벤트에서 TodoWrite 도구를 별도 렌더러로 분기
- 진행 상태 아이콘 (완료/진행중/대기) + 진행률 표시

### 3. UI 개선

- SessionStatsBar에서 누적 비용 표시 제거 (불필요)
- Split view 포커스 테두리를 outline에서 border로 변경 (레이아웃 안정성)
- Sheet container 스코핑 개선 (container 외부 클릭 시 닫히지 않도록)

## 테스트 방법

1. Git repo 세션에서 GitDropdownMenu 표시 확인 (Commit/PR/Rebase 조건부)
2. 비-Git 세션에서 GitDropdownMenu 미표시 확인
3. Session DropdownMenu에서 "대화 내보내기" 클릭 → Markdown 다운로드
4. Session DropdownMenu에서 "세션 설정" 클릭 → Settings Sheet 열림
5. File Changes 버튼 Badge + Sheet 열림/닫힘
6. Split View에서 양쪽 패널 독립 동작 확인
