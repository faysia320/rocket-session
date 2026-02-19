# 작업 이력: Split View 포커스 개선 및 세션 설정 Drawer 닫힘 버그 수정

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Split View에서 포커스된 세션의 시각적 표시 방식을 상단 바 형태로 변경하고, 사이드바에서 세션 선택 시 포커스도 연동되도록 개선했습니다. 또한 세션 설정 Drawer가 열리자마자 닫히는 버그를 수정했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/routes/__root.tsx` - Split View 포커스 표시를 상단 바 방식으로 변경, 사이드바 선택 시 포커스 연동
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - 최근 사용 명령이 카테고리 그룹에 중복 표시되는 문제 수정
- `frontend/src/features/chat/components/SessionDropdownMenu.tsx` - DropdownMenu → Sheet 전환 시 setTimeout 적용
- `frontend/src/features/session/components/SessionSettings.tsx` - Sheet의 외부 포커스/클릭으로 인한 자동 닫힘 방지

## 상세 변경 내용

### 1. Split View 포커스 표시 방식 변경 (`__root.tsx`)

- 기존: `border` 색상 전환 방식 (전체 둘레 외곽선) → 자식 요소에 의해 가려지는 문제 발생
- 변경: 각 패널 상단에 2px 높이의 색상 바(`bg-primary`)로 포커스 표시
- 사이드바에서 세션 선택 시 `setFocusedSessionId`도 같이 호출되도록 `handleSelect`에 연동
- 패널 클릭 시 `navigate()`로 URL도 업데이트되도록 변경

### 2. 최근 명령 중복 표시 수정 (`useCommandPalette.ts`)

- 최근 사용 명령(recentCommands)이 카테고리 그룹에도 중복 표시되는 문제 수정
- `recentIdSet`을 만들어 카테고리 그룹에서 최근 명령을 제외

### 3. 세션 설정 Drawer 닫힘 버그 수정

**원인**: Radix UI DropdownMenu가 닫힐 때 포커스를 트리거 버튼에 복원 → Sheet(`modal={false}`)가 `focusOutside` 이벤트를 감지 → 자동 닫힘

**수정**:
- `SessionDropdownMenu.tsx`: `requestAnimationFrame` → `setTimeout(0)`으로 변경하여 DropdownMenu 닫힘 완료 후 Sheet 열기
- `SessionSettings.tsx`: `onOpenAutoFocus`, `onInteractOutside`, `onFocusOutside`에 `preventDefault` 적용하여 외부 이벤트로 인한 자동 닫힘 방지

## 관련 커밋

- Split View 포커스 개선 + 최근 명령 중복 제거
- 세션 설정 Drawer 닫힘 버그 수정

## 비고

- Sheet는 overlay 클릭, X 버튼, Escape 키로만 닫히도록 제한됨
- Radix UI DropdownMenu → Dialog/Sheet 전환은 알려진 포커스 충돌 패턴
