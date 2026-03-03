# 작업 이력: Context Suggestions 초기 접힘 & Workflow Select 2줄 표시

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. Context Suggestions 패널이 세션 시작 시 접힌 상태로 시작하도록 auto-expand 로직 제거
2. Workflow 설정 Select를 Radix Select에서 버튼 리스트로 전환하여 이름/설명 2줄 표시 구현

## 변경 파일 목록

### Frontend

- `frontend/src/features/context/components/ContextSuggestionPanel.tsx` - auto-expand 로직 삭제 (ref 1개, useEffect 2개)
- `frontend/src/features/workflow/components/WorkflowDefinitionSelector.tsx` - Radix Select → 버튼 리스트 전면 리라이트

## 상세 변경 내용

### 1. Context Suggestions 접힌 상태로 시작

- `hasAutoExpandedRef` 선언 삭제
- 콘텐츠 로드 시 자동 펼침하던 `useEffect` 삭제
- workspace 변경 시 auto-expand 리셋하던 `useEffect` 삭제
- `expanded`의 초기값 `false`가 그대로 유지되어 항상 접힌 상태로 시작
- 헤더의 "N items" 뱃지로 접힌 상태에서도 콘텐츠 존재 확인 가능
- `hasContent` 변수는 JSX 빈 상태 렌더링 조건에서 사용되므로 유지

### 2. Workflow Select → 2줄 버튼 리스트

- Radix Select(`Select`, `SelectTrigger`, `SelectContent`, `SelectItem`) → 단순 `<button>` 리스트로 교체
- 각 항목: 1줄 = 이름 + (N단계) + 체크마크, 2줄 = 설명 (있을 때만)
- Popover 내 Select 중첩 제거 → 1클릭으로 바로 항목 표시 (UX 개선)
- 컴포넌트 인터페이스(`value`/`onSelect`) 불변 → 부모 `WorkflowProgressBar` 변경 없음
- 공유 컴포넌트 `select.tsx` 변경 없음

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. 새 세션 시작 → Context Suggestions 패널이 접혀있는지 확인
2. 클릭으로 수동 펼침/접기 동작 확인
3. 워크플로우 진행바의 톱니바퀴 클릭 → 리스트가 즉시 보이는지 확인
4. 각 항목이 2줄(이름+단계 / 설명)로 표시되는지 확인
5. 워크플로우 선택 시 변경 API 호출 및 Popover 닫힘 확인
