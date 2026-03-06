# 작업 이력: 워크플로우 완료 액션 바 재설계

- **날짜**: 2026-03-06
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 사이클 완료 후 액션 버튼을 WorkflowProgressBar 내부에서 ChatInput 위 플로팅 바로 이동하고, "보관"/"삭제" 버튼을 추가했습니다. "새 주제" 버튼의 동작을 기존 `/clear`와 동일한 리셋 방식에서 "현재 세션 보관 → 새 세션 생성 → 자동 이동" 방식으로 변경했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - onNewCycle prop 및 완료 상태 버튼 제거
- `frontend/src/features/workflow/components/WorkflowCompletedActions.tsx` - (신규) 4버튼 플로팅 액션 바 컴포넌트
- `frontend/src/features/chat/components/ChatPanel.tsx` - 콜백 재배선 및 WorkflowCompletedActions 배치

## 상세 변경 내용

### 1. WorkflowProgressBar 정리

- `onNewCycle` prop, `RotateCcw`/`Plus` lucide import, completed 상태 버튼 블록 제거
- 기존 settings gear popover만 유지하여 역할을 단일화

### 2. WorkflowCompletedActions 신규 컴포넌트

- 4개 액션 버튼: "이어서 구현", "새 주제", "보관", "삭제"
- "이어서 구현": 기존 컨텍스트 유지 + Implement 단계로 재진입
- "새 주제": 현재 세션 archive → 동일 workspace/workflow 설정으로 새 세션 생성 → 자동 navigate
- "보관": 세션 아카이브 (기존 useChatSessionActions 재사용)
- "삭제": AlertDialog 확인 다이얼로그 후 세션 삭제

### 3. ChatPanel 재배선

- `handleNewCycle` → `handleContinueImplement` (implement 전용)
- `handleNewTopic` 신규 추가 (archive → createSession 패턴)
- try-catch + toast.error 에러 핸들링 추가
- WorkflowCompletedActions를 ChatInput 바로 위에 배치 (workflow_phase_status === "completed" 시)

## 관련 커밋

- (이 문서와 함께 커밋 예정)

## 테스트 방법

1. 워크플로우 사이클 완료 (Research → Plan → Implement → QA Review 승인)
2. ChatInput 위에 "사이클 완료" 플로팅 바가 표시되는지 확인
3. "이어서 구현" 클릭 → Implement 단계로 재진입, 기존 대화 유지 확인
4. "새 주제" 클릭 → 현재 세션 보관됨 + 새 세션 생성 + 페이지 이동 확인
5. "보관" 클릭 → 세션 아카이브 확인
6. "삭제" 클릭 → 확인 다이얼로그 표시 → 삭제 확인

## 비고

- "새 주제"는 기존 `/clear`와 다름: 현재 세션을 보관하고 새 세션을 생성하므로 기존 대화를 나중에 다시 참조 가능
- archive 성공 후 createSession 실패 시: 세션 목록에서 보관 해제로 복구 가능
