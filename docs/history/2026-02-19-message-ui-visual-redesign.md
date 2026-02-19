# 작업 이력: 메시지 UI 비주얼 리디자인

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

채팅 메시지 UI를 3-Tier 계층 체계(Primary/Secondary/Tertiary)로 재설계하여 시각적 다양성과 세련됨을 개선했습니다. 도구별 아이콘/색상 매핑, 차별화된 메타데이터 배지, 턴 그룹핑 여백 체계를 적용했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/MessageBubble.tsx` - 전체 메시지 타입(13종) 스타일 리디자인
- `frontend/src/features/chat/components/ChatPanel.tsx` - turn-start 간격 타입 지원
- `frontend/src/features/chat/utils/chatComputations.ts` - turn-start 간격 계산 로직 추가

## 상세 변경 내용

### 1. Phase 1 - Primary 메시지 개선

- **UserMessage**: `font-mono` → `font-sans`, `rounded-xl` → `rounded-lg`, `shadow-sm` 추가, "You" 라벨 제거, Re-send 버튼에 `hover:underline` 추가
- **ResultMessage**: 좌측 테두리 `border-primary/40` → `border-info/60`, 헤더 `◆` 색상 `text-info`로 변경, 메타데이터 배지 색상 차별화 (모델=info, 입력토큰=success, 출력토큰=primary), cost 배지 제거

### 2. Phase 2 - Secondary 메시지 개선

- **ToolUseMessage**: 도구별 아이콘 매핑 (`Read`→`FileText`, `Write/Edit`→`Pencil`, `Bash`→`Terminal`, `Grep/Glob`→`Search`, `WebFetch`→`Globe`, `Task`→`GitBranch`), 도구별 색상 (읽기=info, 쓰기=primary, 실행=warning, 웹=success), 컨테이너 `bg-secondary` → `bg-card`, `rounded-sm` → `rounded-md`, 유니코드 화살표 → `ChevronRight`/`ChevronDown` 아이콘
- **ThinkingMessage**: Brain 아이콘 크기 `h-3.5 w-3.5`, 펼쳤을 때 `italic` 적용, Chevron 아이콘 적용
- **PermissionRequestMessage**: `ShieldAlert` 아이콘 추가, `rounded-md`, 도구명에 `bg-warning/10` 배경

### 3. Phase 3 - Alert 메시지 개선

- **AssistantText (streaming)**: 좌측 테두리 `border-info/50`, `◆` → 깜빡이는 dot (`w-2 h-2 rounded-full bg-info animate-pulse`), `<pre>` → `<div>` + `leading-relaxed`
- **ErrorMessage**: `⚠` 유니코드 → `AlertTriangle` 아이콘, `border-l-[3px] border-l-destructive` 추가, 재시도 버튼 filled 스타일

### 4. Phase 4 - Tertiary 메시지 + 턴 그룹핑

- **StderrMessage**: `text-2xs text-warning/60`, 좌측 `border-l border-warning/20`
- **SystemMessage**: 수평선 + 가운데 텍스트 패턴 (`── system message ──`)
- **EventMessage**: `Zap` 아이콘 추가, Chevron 아이콘 적용
- **FileChangeMessage**: `📝` 이모지 → `FileEdit` 아이콘
- **턴 그룹핑**: `computeMessageGaps`에 `turn-start` 타입 추가, user_message 직전 `pb-4` 여백

## 관련 커밋

- (이 커밋에서 생성)

## 비고

- 13종 메시지 타입 모두 리디자인
- lucide-react 아이콘 14개 추가 사용 (AlertTriangle, ShieldAlert, FileText, Pencil, Terminal, Search, Globe, GitBranch, ChevronRight, ChevronDown, Zap, FileEdit, LucideIcon 타입)
- 다크(Deep Space) / 라이트(Catppuccin Latte) 양 테마 호환 (info/success/warning 시맨틱 색상 사용)
