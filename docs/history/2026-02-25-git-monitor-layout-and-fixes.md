# 작업 이력: Git Monitor 레이아웃 변경 + JSONL Watcher 수정 + 워크플로우 주석 리팩터

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor 페이지의 레이아웃을 Status|Commits 좌우 2분할로 변경하고, PR은 뱃지 클릭 → Dialog 모달로 접근하도록 수정했습니다. JSONL Watcher의 RUNNING 상태 전환 타이밍을 실제 데이터 감지 시점으로 지연시켰습니다. 워크플로우 아티팩트 주석을 별도 패널에서 인라인 카드 방식으로 리팩터했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/jsonl_watcher.py` - RUNNING 상태 전환을 실제 새 데이터 감지 시점으로 지연

### Frontend

- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - Status|Commits 2분할 + PR 뱃지/Dialog 모달
- `frontend/src/features/workflow/components/ArtifactAnnotationPanel.tsx` - 삭제 (인라인 카드로 대체)
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - 인라인 주석 카드 + 주석 팝오버 통합
- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - 수정 요청 성공 시 아티팩트 뷰어 자동 닫기

## 상세 변경 내용

### 1. Git Monitor 레이아웃 변경

- Status/Commits 탭 전환 → 좌우 2분할로 동시 표시
- PR을 독립 패널에서 제거, 액션 바에 PR 뱃지(open PR 수) 추가
- PR 뱃지 클릭 시 Dialog 모달로 GitHubPRTab 렌더링
- Tabs import 제거, Dialog + useGhStatus/useGitHubPRs 추가

### 2. JSONL Watcher RUNNING 상태 전환 지연

- 기존: 감시 시작 시 즉시 IDLE→RUNNING 전환
- 변경: 실제 새 데이터가 감지된 첫 순간에만 RUNNING 전환
- `activated_running` 플래그로 1회만 전환되도록 보장

### 3. 워크플로우 주석 인라인 리팩터

- ArtifactAnnotationPanel (우측 패널) 삭제
- ArtifactViewer 내부에 InlineAnnotationCard 컴포넌트 추가
- 코드 라인 바로 아래에 주석 카드가 인라인으로 표시
- 주석 아이콘과 추가 팝오버를 단일 Popover로 통합
- scrollToLine 함수 제거 (인라인 표시로 불필요)
- 수정 요청 성공 시 아티팩트 뷰어 자동 닫기 추가

## 테스트 방법

1. Git Monitor: 워크스페이스 선택 → Status/Commits 좌우 동시 표시 확인 → PR 뱃지 클릭 → Dialog 모달 확인
2. JSONL Watcher: 세션 시작 후 실제 출력이 나올 때까지 IDLE 유지되는지 확인
3. 워크플로우: 아티팩트 소스 뷰에서 주석이 코드 라인 아래 인라인으로 표시되는지 확인
