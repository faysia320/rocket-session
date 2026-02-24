# 작업 이력: 워크플로우 완료 후 메시지 입력 불가 버그 수정

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 Implement 단계 완료 후 메시지 입력이 불가능해지는 버그를 수정했습니다.
근본 원인은 워크플로우 "완료" 상태와 "미시작" 상태를 동일하게 `null`로 표현하여 구분이 불가능했던 것입니다.

## 변경 파일 목록

### Backend

- `backend/app/services/workflow_service.py` - implement 완료 시 상태를 null 대신 "completed"로 설정
- `backend/app/api/v1/endpoints/ws.py` - 완료 상태 게이트 스킵 로직 추가

### Frontend

- `frontend/src/types/workflow.ts` - WorkflowPhaseStatus 타입에 "completed" 추가
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - WS_WORKFLOW_COMPLETED 핸들러 수정
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 완료 상태 UI 처리

## 상세 변경 내용

### 1. 버그 원인 분석

워크플로우 완료 시 상태 전이 흐름:

```
Implement 승인 → workflow_phase=null, workflow_phase_status=null (기존)
                → ws.py 게이트: "if not workflow_phase" → True
                → "워크플로우가 시작되지 않았습니다" 오류 발생
```

"미시작"과 "완료"를 동일한 null 값으로 표현했기 때문에, 완료된 세션에서 메시지를 보낼 수 없었습니다.

### 2. 백엔드 수정 (workflow_service.py)

- `approve_phase()` 메서드에서 implement 완료 시:
  - 기존: `workflow_phase=None, workflow_phase_status=None`
  - 수정: `workflow_phase="implement", workflow_phase_status="completed"`

### 3. 백엔드 수정 (ws.py)

- 워크플로우 게이트에 완료 상태 분기 추가:
  - `workflow_phase_status == "completed"` 감지 시 `workflow_phase = None`으로 로컬 리셋
  - 게이트 체크 + 컨텍스트 빌드를 모두 스킵하여 일반 메시지로 처리

### 4. 프론트엔드 수정

- `WorkflowPhaseStatus` 타입에 `"completed"` 리터럴 추가
- `claudeSocketReducer`: WS_WORKFLOW_COMPLETED 이벤트 시 `phase="implement"`, `status="completed"` 설정
- `WorkflowProgressBar`: completed 상태에서 모든 단계를 "done"으로 표시 + "완료됨" 라벨

## 수정 후 동작 흐름

```
Implement 승인
  → workflow_phase="implement", workflow_phase_status="completed" 저장
  → WS_WORKFLOW_COMPLETED 이벤트 브로드캐스트
  → 프론트엔드: 3단계 모두 "done" + "완료됨" 라벨
  → 사용자 메시지 입력
  → ws.py: completed 감지 → 게이트 스킵 → 일반 메시지로 처리
```

## 테스트 방법

1. 워크플로우 활성화된 세션 생성
2. Research → Plan → Implement 3단계 순서대로 진행
3. Implement 단계 승인 후 워크플로우 완료
4. 완료 후 메시지 입력 시 정상 전송 확인
5. ProgressBar에 "완료됨" 상태 표시 확인
