# 작업 이력: QA 마지막 단계 "커밋 요청" 버튼

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

QA Review 아티팩트에서 "승인 → 다음 단계" 버튼이 마지막 단계임에도 표시되던 어색한 UX를 개선했습니다.
QA가 마지막 단계일 때 "커밋 요청" 버튼을 표시하고, 승인 시 워크플로우 완료 후 `/git-commit` 스킬을 자동 실행합니다.

## 변경 파일 목록

### Frontend (신규)

- `frontend/src/features/workflow/utils/parseQaChecklist.ts` - QA 아티팩트 체크리스트 파싱 유틸리티 (백엔드 로직 TypeScript 포팅)

### Frontend (수정)

- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - `isLastPhase` 계산 + 마지막 단계 승인 시 `/git-commit` 자동 전송
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` - "커밋 요청" 버튼 + QA FAIL AlertDialog 경고
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - `isLastPhase` prop 전달
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - 인라인 카드에서도 "커밋 요청" 버튼 표시
- `frontend/src/features/chat/components/ChatPanel.tsx` - `isLastPhase` prop 연결 + workflowKeys 정규화
- `frontend/src/features/chat/components/MessageBubble.tsx` - 로컬 `isLastPhase` 계산 (workflowSteps 기반)

## 상세 변경 내용

### 1. QA 체크리스트 파싱 유틸리티 (parseQaChecklist.ts)

- 백엔드 `WorkflowService.parse_qa_checklist()` 와 동일한 로직을 TypeScript로 포팅
- 마크다운 체크박스 (`- [x]`/`- [ ]`) 및 `[PASS]/[FAIL]/[WARN]` 태그 패턴 지원
- 파싱 실패 시 안전한 fallback (warn 항목 1건)
- PhaseApprovalBar에서 FAIL 항목 존재 시 AlertDialog 경고에 활용

### 2. isLastPhase 판별 및 자동 /git-commit (useWorkflowActions.ts)

- `useMemo`로 `isLastPhase` 계산: `workflowSteps`를 `order_index` 정렬하여 마지막 단계 == 현재 단계 여부 확인
- `handleAdvancePhase`에서 `nextPhase === null && _sendPrompt` 조건으로 `/git-commit` 자동 실행
- 기존에 미사용이던 `sendPrompt` 파라미터를 활성화
- `isLastPhase`를 반환값에 추가하여 UI 컴포넌트에서 활용

### 3. PhaseApprovalBar 커밋 요청 버튼 + QA FAIL 경고

- `isLastPhase=true` → GitCommit 아이콘 + "커밋 요청" 버튼 표시
- `isLastPhase=false` → 기존 Check 아이콘 + "승인 → 다음 단계" 유지
- 커밋 클릭 시 `artifactContent`에서 QA 체크리스트 파싱 → FAIL 존재 시 AlertDialog 경고
- AlertDialog에서 "그래도 커밋" 선택 시 승인 진행 (경고 후 허용 정책)

### 4. Prop threading (ArtifactViewer, ChatPanel, MessageBubble, WorkflowPhaseCard)

- `isLastPhase` prop을 useWorkflowActions → ChatPanel → ArtifactViewer → PhaseApprovalBar 체인으로 전달
- MessageBubble에서는 `workflowSteps` prop으로 로컬 계산 (ChatMessageList 변경 불필요)
- WorkflowPhaseCard에서도 동일한 조건 분기 적용

### 5. ChatPanel workflowKeys 정규화

- 하드코딩 `["workflow-status", sessionId]` → `workflowKeys.status(sessionId)` 으로 3곳 통일
- `workflow_changed` 이벤트 시 워크플로우 상태(steps) 쿼리도 갱신 추가

## 관련 커밋

- `f0c19d4` - Feat: Add QA 마지막 단계 커밋 요청 핵심 로직
- `2732ac3` - Feat: Add QA 커밋 요청 UI (버튼, AlertDialog, prop 연결)

## 테스트 방법

1. 워크플로우가 있는 세션에서 QA 단계까지 진행
2. QA 아티팩트 열기 → "커밋 요청" 버튼이 표시되는지 확인
3. FAIL 항목이 있는 경우 경고 AlertDialog가 표시되는지 확인
4. "커밋 요청" 클릭 → 워크플로우 완료 → `/git-commit` 자동 실행 확인
5. 인라인 WorkflowPhaseCard에서도 "커밋 요청" 버튼이 표시되는지 확인

## 비고

- 백엔드 변경 없음 (기존 `approve_phase()` API의 `nextPhase=null` 반환 로직 활용)
- `isLastPhase`는 `order_index` 기반 동적 계산 (QA 이름 하드코딩 아님)
