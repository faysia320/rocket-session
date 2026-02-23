# 작업 이력: 채팅 UI 디자인 개선

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Plan Result 카드, Git 드롭다운 메뉴, 활동 상태바, 채팅 입력 영역의 UI를 개선했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/PlanResultCard.tsx` - Execute Plan 버튼을 첫 번째 위치로 이동 + primary 스타일 적용
- `frontend/src/features/chat/components/GitDropdownMenu.tsx` - 워크트리 삭제만 표시될 때 불필요한 분할선 숨김
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - "Claude가 처리 중…" → "Reasoning…" 문구 변경
- `frontend/src/features/chat/components/ChatInput.tsx` - 입력 영역 좌우 패딩 축소 (px-4 → px-2)

## 상세 변경 내용

### 1. PlanResultCard - Execute Plan 버튼 우선 배치

- Execute Plan 버튼을 첫 번째(primary) 위치로 이동
- Continue 버튼을 두 번째(secondary outline) 위치로 변경
- 사용 빈도가 높은 액션을 우선 노출

### 2. GitDropdownMenu - 조건부 분할선

- Commit/PR/Rebase 항목이 없고 "워크트리 삭제"만 단독 표시될 때 분할선 미표시
- `showCommit || showPR || showRebase` 조건으로 분할선 렌더링 제어

### 3. ActivityStatusBar - 상태 문구 변경

- "Claude가 처리 중…" → "Reasoning…"으로 변경
- 엔지니어링 느낌의 세련된 영문 표현 적용

### 4. ChatInput - 패딩 조정

- 채팅 입력 컨테이너 좌우 패딩을 px-4에서 px-2로 축소
