# 작업 이력: 호버 가독성 개선 및 아이콘 버튼 전환

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Command Palette(Ctrl+K)와 SlashCommandPopup(/ 입력)의 선택 항목 가독성을 라이트/다크 모드 모두에서 개선하고, ChatInput의 Send/Stop 버튼을 텍스트 없는 아이콘 버튼으로 변경했습니다. ChatHeader 레이아웃 2줄 구조 변경 및 /clear 명령어 CLI 전달 기능도 포함됩니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/command-palette/components/CommandPalette.tsx` - 선택 항목 아이콘/설명/단축키 색상 개선
- `frontend/src/features/chat/components/SlashCommandPopup.tsx` - 활성 항목 아이콘/설명/배지 색상 개선
- `frontend/src/features/chat/components/ChatInput.tsx` - Send/Stop 텍스트 라벨 제거, 아이콘 버튼으로 전환
- `frontend/src/features/chat/components/ChatHeader.tsx` - 헤더 레이아웃 2줄 구조로 변경
- `frontend/src/features/chat/components/ChatPanel.tsx` - /clear 명령어 CLI 전달 추가

## 상세 변경 내용

### 1. Command Palette 호버 가독성 개선

- CommandItem에 `group` 클래스 추가
- 선택 시 아이콘: `group-data-[selected=true]:text-accent-foreground/70`
- 선택 시 설명: `group-data-[selected=true]:text-accent-foreground/70`
- 선택 시 단축키 뱃지: 배경·테두리·텍스트 모두 accent-foreground 계열로 전환
- 라이트 모드(보라색 bg)와 다크 모드(앰버 bg) 모두에서 가독성 확보

### 2. SlashCommandPopup 호버 가독성 개선

- 활성 항목 아이콘: `text-muted-foreground` → `text-accent-foreground/70`
- 활성 항목 설명: `text-muted-foreground` → `text-accent-foreground/70`
- 활성 항목 skill 뱃지: `text-muted-foreground/60` → `text-accent-foreground/50`

### 3. ChatInput 아이콘 버튼 전환

- Send 버튼: "Send" 텍스트 제거, `size="icon"` + `h-8 w-8`
- Stop 버튼: "Stop" 텍스트 제거, `size="icon"` + `h-8 w-8`
- 두 버튼 모두 Tooltip 래핑 + aria-label 추가 (접근성 유지)

### 4. ChatHeader 2줄 레이아웃

- 수평 1줄 → 수직 2줄 구조 (연결 상태 + 파일/도구 뱃지)

### 5. /clear 명령어 CLI 전달

- `/clear` 실행 시 `sendPrompt("/clear")` 호출 추가
- 도움말 텍스트 "대화 내역 초기화" → "대화 컨텍스트 초기화 (CLI 전달)"

## 비고

- accent 배경 위에서 muted-foreground가 보이지 않는 근본 원인: 라이트 모드에서 accent=보라색, muted-foreground=회색으로 대비 부족
