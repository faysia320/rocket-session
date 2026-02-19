# 작업 이력: UI 디자인 개선 (Split View, 커맨드 팔레트, 입력창, Dropdown, Switch)

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Split View 포커스/세션 전환, 커맨드 팔레트 중복 항목, 입력창 컴팩트화, DropdownMenu 호버 가독성, Button 호버 외곽선, Switch 가시성 등 다양한 UI 디자인 이슈를 수정했습니다.

## 변경 파일 목록

### Frontend

- `src/routes/__root.tsx` - Split View 포커스 외곽선 두께 증가, 사이드바/패널 클릭 시 포커스+URL 동기화
- `src/features/command-palette/hooks/useCommandPalette.ts` - 최근 사용 항목 중복 제거
- `src/features/chat/components/ChatInput.tsx` - 입력창 높이 컴팩트화, Send 버튼 중앙 정렬
- `src/features/chat/components/ChatHeader.tsx` - Tooltip을 shadcn/ui로 교체, 브랜치 truncate 추가
- `src/features/chat/components/GitDropdownMenu.tsx` - 워크트리 삭제/Rebase 호버 색상 개선
- `src/components/ui/button.tsx` - outline variant hover 시 border 색상 추가
- `src/components/ui/switch.tsx` - 비활성 상태 외곽선 추가로 가시성 개선
- `src/components/ui/sheet.tsx` - X 닫기 버튼 세로 정렬 조정
- `src/features/files/components/FileViewer.tsx` - 전체보기 Dialog 스크롤바/높이 수정

## 상세 변경 내용

### 1. Split View 포커스 및 세션 전환

- 포커스 외곽선: `border` → `border-2`, `primary/40` → `primary/50`
- 사이드바 세션 클릭 시 `focusedSessionId` 동기화
- 패널 클릭 시 URL도 해당 세션으로 navigate

### 2. 커맨드 팔레트 중복 제거

- "최근 사용"에 있는 항목을 카테고리 그룹에서 제외
- cmdk의 동일 value 충돌로 인한 키보드 탐색 오류 해결

### 3. ChatInput 컴팩트화 및 정렬

- 외부 패딩 `py-3` → `py-2`, Textarea `min-h-11` → `min-h-9`
- Send 버튼 `items-end` → `items-center`, `pb-1` 제거

### 4. DropdownMenu 호버 가독성

- 워크트리 삭제: `focus:bg-destructive/10` 추가 (Dark/Light 공통)
- Rebase 아이콘: `group-focus:text-accent-foreground`로 호버 시 색상 전환

### 5. Button/Switch 가시성

- Button outline variant: `hover:border-accent` 추가 (Light 하얀 외곽선 제거)
- Switch: `border-transparent` → 상태별 `border-primary`/`border-border-bright`

## 테스트 방법

1. Split View 진입 → 사이드바/패널 클릭 시 포커스+URL 동기화 확인
2. Ctrl+K → 최근 사용 항목 중복 없이 키보드 탐색 정상 동작 확인
3. 채팅 입력창 1줄 시 Send 버튼 중앙 정렬 확인
4. Dark/Light 모드에서 DropdownMenu 호버 가독성 확인
5. New Session 화면에서 Git Worktree Switch 가시성 확인
