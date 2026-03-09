# 작업 이력: 워크플로우 완료 플로팅 바에 커밋 버튼 추가

- **날짜**: 2026-03-09
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 사이클 완료 시 표시되는 플로팅 액션 바("사이클 완료 | 이어서 구현 | 새 주제 | 보관 | 삭제")에 **커밋 버튼**을 추가했습니다. ChatHeader의 Git 메뉴 커밋 버튼과 동일하게 `/git-commit` 프롬프트를 WebSocket으로 전송합니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/components/WorkflowCompletedActions.tsx` - 커밋 버튼 UI 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - 커밋 핸들러 및 props 연결

## 상세 변경 내용

### 1. WorkflowCompletedActions 컴포넌트에 커밋 버튼 추가

- `onCommit?: () => void`, `showCommit?: boolean` props 추가
- `GitCommitHorizontal` 아이콘(lucide-react) import
- "새 주제" 버튼 오른쪽, 구분선 왼쪽에 커밋 버튼 배치
- `bg-success/10 text-success` 스타일로 Git 커밋 아이콘 색상과 통일
- `showCommit` 조건으로 git 변경사항이 있을 때만 표시

### 2. ChatPanel에서 커밋 핸들러 연결

- `handleCommit` 콜백 추가: `handleSendPrompt("/git-commit")` 호출
- `showCommit={gitInfo?.is_dirty || gitInfo?.has_untracked || false}` 조건 전달
- GitDropdownMenu(`:43-47`)와 완전히 동일한 패턴 사용

## 테스트 방법

1. 워크플로우 사이클을 완료 상태로 만듦
2. Git 변경사항이 있는 상태에서 플로팅 바에 "커밋" 버튼이 표시되는지 확인
3. 버튼 클릭 시 `/git-commit` 프롬프트가 전송되는지 확인
4. Git 변경사항이 없을 때 버튼이 숨겨지는지 확인
