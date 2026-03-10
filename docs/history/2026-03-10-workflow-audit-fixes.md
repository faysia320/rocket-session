# 작업 이력: 워크플로우 전수 검사 결과 수정

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 3단계 개편 후 전수 검사에서 발견된 4건의 문제를 수정했습니다.
마지막 단계(QA) 아티팩트 상태 불일치(HIGH) 2건과 레거시 코드 잔존(LOW) 2건을 해결합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - 마지막 단계 완료 시 review_required 분기 추가, validation 실패 시 approve_phase 제거
- `backend/app/core/constants.py` - 주석에서 구식 "research/plan" 표현 수정

### Frontend

- `frontend/src/features/chat/components/ChatPanel.tsx` - SessionState에 없는 id 참조 제거, null→undefined 변환
- `frontend/src/features/chat/components/MessageBubble.test.tsx` - WorkflowStepConfig 필수 필드 추가
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - phaseLabels에서 레거시 plan 항목 제거
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` - 미사용 phase 변수 제거

## 상세 변경 내용

### 1. 마지막 단계 아티팩트 approved 처리 (HIGH)

- **문제**: 마지막 단계(QA) 완료 시 아티팩트가 "review" 상태로 유지됨
- **원인**: `if not next_phase` 블록이 review_required 여부와 무관하게 무조건 completed로 설정
- **수정**: `not next_phase and not review_required` → approve_phase() + completed, `not next_phase` → awaiting_approval (사용자 승인 대기)

### 2. Validation 실패 시 approve_phase 호출 제거 (HIGH)

- **문제**: Implement→QA 진입 검증 실패 시 approve_phase() 호출로 아티팩트가 잘못 approved됨
- **수정**: approve_phase() 대신 update_settings()로 현재 phase(implement)를 유지한 채 재실행

### 3. 프론트엔드 레거시 코드 정리 및 타입 에러 수정 (LOW)

- phaseLabels에서 삭제된 plan 단계 레이블 제거
- constants.py 주석에서 "research/plan" → "research" 수정
- ChatPanel.tsx: SessionState.id 참조 제거, null→undefined 변환
- MessageBubble.test.tsx: WorkflowStepConfig 필수 필드 누락 보완
- PhaseApprovalBar.tsx: 미사용 phase destructure 제거

## 관련 커밋

- (이 문서와 함께 커밋됨)

## 테스트 방법

1. `cd backend && uv run pytest tests/test_workflow_service.py -v` — 46건 통과
2. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` — 에러 0건
3. `cd frontend && pnpm build` — 빌드 성공
