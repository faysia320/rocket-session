# 작업 이력: React Compiler 호환성 수정

- **날짜**: 2026-02-28
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

React Compiler(infer 모드) 도입 후 기존 코드에서 발견된 React Rules of React 위반 패턴을 수정하고, 중복된 `formatRelativeTime` 유틸리티 함수를 통합했습니다.

## 변경 파일 목록

### Frontend - React Rules 수정

- `frontend/src/features/chat/components/ChatPanel.tsx` - 렌더 중 ref 쓰기 2곳(`messagesRef`, `cmdPaletteRef`)을 useEffect로 이동
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - useMemo 내 Date.now() 제거, formatRelativeTime 통합
- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - useState lazy initializer 적용
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - useState lazy initializer 적용
- `frontend/src/features/session/components/ImportLocalDialog.tsx` - useState lazy initializer 적용

### Frontend - 유틸리티 통합

- `frontend/src/lib/utils.ts` - formatRelativeTime 공통 함수 추가
- `frontend/src/features/git-monitor/components/GitCommitItem.tsx` - 로컬 함수 제거, import 교체
- `frontend/src/features/git-monitor/components/GitHubPRTab.tsx` - 로컬 함수 제거, import 교체
- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - 로컬 함수 제거, import 추가

## 상세 변경 내용

### 1. ChatPanel 렌더 중 ref 쓰기 수정

- `messagesRef.current = messages` (line 74) → `useEffect`로 이동
- `cmdPaletteRef.current = { ... }` (line 332-337) → `useEffect`로 이동
- Compiler의 purity 규칙 호환성 확보
- MemoBlockEditor, useECharts와 동일 패턴 적용

### 2. formatRelativeTime 4중 중복 제거

- 4개 파일에 각각 정의된 거의 동일한 함수를 `lib/utils.ts`로 통합
- `string | number | null` 통합 시그니처로 모든 호출처 호환
- GitMonitorPage의 "초" 단위 표시는 "방금 전"으로 통일

### 3. SessionDashboardCard useMemo 내 Date.now() 수정

- 비결정적 값(`Date.now()`)을 포함한 `useMemo`를 일반 계산식으로 변경
- `useMemo` import 제거

### 4. useState lazy initializer 적용

- 3개 파일의 `useState(new Set())` → `useState(() => new Set())`
- 매 렌더마다 불필요한 Set 생성 방지

## 검증 결과

- **타입체크**: `tsc --noEmit` 통과
- **빌드**: `vite build` 성공 (17.24s)
- **테스트**: 151/151 전체 통과
- **린트**: 0 errors, 25 warnings (변경 전과 동일)
