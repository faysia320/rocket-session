# 작업 이력: Native Tooltip → shadcn/ui Tooltip 전환

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프론트엔드 전체에서 HTML 네이티브 `title` 속성을 사용한 툴팁 20개를 shadcn/ui의 `Tooltip` 컴포넌트(`@radix-ui/react-tooltip` 기반)로 전환했습니다. 기존 `TooltipProvider`(App.tsx)와 `tooltip.tsx` 컴포넌트가 설치되어 있었으나 실제 사용되지 않고 있었으며, 이번 작업으로 14개 파일에서 일관된 스타일 툴팁 UX를 제공합니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/ChatHeader.tsx` - SheetTrigger 버튼 Tooltip 래핑
- `frontend/src/features/chat/components/ChatInput.tsx` - Plan 모드/이미지 첨부 버튼 Tooltip 래핑
- `frontend/src/features/chat/components/GitDropdownMenu.tsx` - DropdownMenuTrigger Tooltip 래핑, 한국어 통일
- `frontend/src/features/chat/components/ModeIndicator.tsx` - Plan Mode 버튼 Tooltip 래핑
- `frontend/src/features/chat/components/SessionDropdownMenu.tsx` - DropdownMenuTrigger Tooltip 래핑
- `frontend/src/features/directory/components/DirectoryBrowser.tsx` - 현재 경로 Tooltip 래핑
- `frontend/src/features/directory/components/GitInfoCard.tsx` - 커밋 메시지 Tooltip 래핑
- `frontend/src/features/directory/components/WorktreePanel.tsx` - 워크트리 경로 Tooltip 래핑
- `frontend/src/features/files/components/FilePanel.tsx` - 전체 보기 버튼/파일 경로 Tooltip 래핑
- `frontend/src/features/files/components/FileViewer.tsx` - DialogTitle/파일 경로 Tooltip 래핑
- `frontend/src/features/git-monitor/components/GitRepoSelector.tsx` - 저장소 선택 버튼 Tooltip 래핑
- `frontend/src/features/session/components/ImportLocalDialog.tsx` - CWD 경로 Tooltip 래핑
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - 세션명/활동/작업 디렉토리 Tooltip 래핑
- `frontend/src/features/session/components/Sidebar.tsx` - 세션명/작업 디렉토리 Tooltip 래핑

## 상세 변경 내용

### 1. 아이콘 버튼 패턴 (7개)

`title` 속성이 아이콘 전용 버튼의 라벨 역할을 하던 곳을 `Tooltip`으로 전환:
- ChatHeader: "File changes" → "파일 변경" (한국어 통일)
- ChatInput: Plan 모드 동적 텍스트, "이미지 첨부"
- SessionDropdownMenu: "세션 메뉴"
- GitDropdownMenu: "Git actions" → "Git 작업" (한국어 통일)
- FilePanel: "전체 보기"
- ModeIndicator: "Plan Mode (Shift+Tab)"

### 2. 잘린 텍스트 패턴 (13개)

CSS `truncate`로 잘린 텍스트의 전체 내용을 `title`로 노출하던 곳을 `Tooltip`으로 전환:
- Sidebar: 세션명, 작업 디렉토리
- SessionDashboardCard: 세션명, 활동 라벨, 작업 디렉토리
- FileViewer: 파일명, 파일 경로
- FilePanel: 파일 경로
- ImportLocalDialog: CWD 경로
- WorktreePanel: 워크트리 경로
- GitInfoCard: 커밋 메시지
- DirectoryBrowser: 현재 경로
- GitRepoSelector: 저장소 경로

### 3. DropdownMenu/Sheet 트리거 조합

DropdownMenuTrigger, SheetTrigger와 TooltipTrigger를 함께 사용하는 패턴:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <DropdownMenuTrigger asChild>
      <Button>...</Button>
    </DropdownMenuTrigger>
  </TooltipTrigger>
  <TooltipContent>...</TooltipContent>
</Tooltip>
```

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. TypeScript 타입 검사: `npx tsc -p tsconfig.app.json --noEmit` ✅ 통과
2. 프로덕션 빌드: `npx vite build` ✅ 통과
3. 잔여 native title= 확인: `.tsx` 파일에서 0개 ✅

## 비고

- `aria-label`은 접근성을 위해 기존 그대로 유지
- 영어로 된 title 값은 프로젝트 규칙에 따라 한국어로 통일 (File changes → 파일 변경, Git actions → Git 작업)
- `TooltipProvider`는 이미 `App.tsx`에서 `delayDuration={300}`으로 래핑되어 있어 추가 설정 불필요
