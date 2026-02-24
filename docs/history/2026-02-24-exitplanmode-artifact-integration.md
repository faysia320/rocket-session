# 작업 이력: ExitPlanMode 상세 플랜을 Plan 아티팩트에 통합

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Workflow Plan 단계 완료 시 ExitPlanMode 도구의 상세 플랜이 raw JSON 카드로 표시되던 문제를 수정했습니다.
ExitPlanMode의 `input.plan`을 캡처하여 Plan 아티팩트에 저장하고, 불필요한 도구 카드를 숨기도록 처리했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - ExitPlanMode 감지/캡처 + tool_result 필터링 + 아티팩트 저장 우선순위 변경

### Frontend

- `frontend/src/features/chat/components/MessageBubble.tsx` - ExitPlanMode tool_use 메시지 숨김 (방어적 처리)

## 상세 변경 내용

### 1. ExitPlanMode tool_use 감지 및 플랜 캡처 (claude_runner.py:427-436)

- AskUserQuestion과 동일한 패턴으로 ExitPlanMode을 특별 처리
- `tool_input.plan`(상세 플랜)과 `allowedPrompts`를 `turn_state`에 저장
- `continue`로 일반 tool_use 브로드캐스트를 건너뜀 → 프론트엔드에 raw JSON 카드 미표시

### 2. ExitPlanMode tool_result 필터링 (claude_runner.py:543-546)

- AskUserQuestion의 tool_result 필터와 동일한 패턴 적용
- `exit_plan_tool_id`와 매칭하여 프론트엔드 전송 차단

### 3. Plan 아티팩트 저장 시 상세 플랜 우선 사용 (claude_runner.py:976-981)

- `exit_plan_content` (상세 플랜) → `result_text` (간략 요약) → `text` 순서로 폴백
- 아티팩트에 상세 플랜이 저장되어 "아티팩트 열기"에서 전체 플랜 확인 가능

### 4. 프론트엔드 방어적 숨김 (MessageBubble.tsx:100)

- 히스토리 로딩 시 DB에 저장된 ExitPlanMode 레코드가 렌더링되지 않도록 `return null` 처리

## 테스트 방법

1. Workflow 활성화된 세션에서 Plan 단계 실행
2. Claude가 ExitPlanMode 호출 시 raw JSON 카드가 표시되지 않는지 확인
3. "Plan 완료" WorkflowPhaseCard만 표시되는지 확인
4. "아티팩트 열기" 클릭 시 상세 플랜이 표시되는지 확인

## 비고

- AskUserQuestion 처리 패턴을 참조하여 동일한 구조로 구현
- Backend에서 브로드캐스트를 차단하므로 Frontend 변경은 안전장치 역할
