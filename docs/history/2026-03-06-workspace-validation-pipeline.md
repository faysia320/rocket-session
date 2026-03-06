# 작업 이력: 워크스페이스 검증 파이프라인

- **날짜**: 2026-03-06
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Channel.io의 AI-Native DDD 아티클에서 영감을 받아 "규칙을 문서가 아닌 코드로 강제한다"는 원칙을 RocketSession에 적용했습니다.
워크스페이스별로 lint/test/build 등 검증 명령을 설정하고, 워크플로우 단계 승인 시 자동으로 실행하는 **Validation Pipeline** 기능을 구현했습니다.

## 변경 파일 목록

### Backend (신규)

- `backend/app/services/validation_service.py` - ValidationService (subprocess 기반 명령 실행, 타임아웃, 결과 수집)
- `backend/migrations/versions/20260306_f2b87f65794b_add_validation_commands_to_workspaces.py` - workspaces 테이블에 validation_commands JSONB 컬럼 추가

### Backend (수정)

- `backend/app/models/workspace.py` - validation_commands JSONB 필드 추가
- `backend/app/schemas/workspace.py` - ValidationCommand, ValidationCommandResult, ValidationResult 스키마 추가
- `backend/app/schemas/workflow_definition.py` - WorkflowStepConfig에 run_validation 필드 추가
- `backend/app/schemas/workflow.py` - ApprovePhaseRequest에 force, RequestRevisionRequest에 validation_summary 추가
- `backend/app/services/workflow_service.py` - build_revision_context()에 validation_summary 파라미터 추가
- `backend/app/services/workflow_definition_service.py` - 기본 워크플로우 implement 단계에 run_validation=True
- `backend/app/api/dependencies.py` - ValidationService DI 등록
- `backend/app/api/v1/endpoints/workflow.py` - approve_phase에 검증 파이프라인 통합, /validate 수동 실행 엔드포인트

### Frontend (수정)

- `frontend/src/types/workflow.ts` - ValidationCommandResult, ValidationResult 타입 추가
- `frontend/src/types/workspace.ts` - ValidationCommand 타입 추가
- `frontend/src/lib/api/workflow.api.ts` - runValidation API 메서드 추가
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` - 검증 실패 배너, 강제 승인 다이얼로그
- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - run_validation 체크박스
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - validationResult prop 연결
- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - lastValidationResult 상태 관리
- `frontend/src/features/chat/components/ChatPanel.tsx` - lastValidationResult를 ArtifactViewer에 전달

## 상세 변경 내용

### 1. 워크스페이스 검증 명령 설정

- Workspace 모델에 `validation_commands` JSONB 필드 추가
- 각 명령은 name, command, run_on (트리거 시점), timeout_seconds를 설정 가능
- 워크스페이스 업데이트 API를 통해 설정 가능

### 2. ValidationService

- `asyncio.create_subprocess_shell`로 셸 명령 실행
- 타임아웃 초과 시 프로세스 kill 처리
- 출력 2000자 트런케이트, 결과별 pass/fail 판정
- Claude용 요약 텍스트 자동 생성 (`_build_summary`)

### 3. 워크플로우 통합

- WorkflowStepConfig에 `run_validation` 플래그 추가
- approve_phase 엔드포인트에서 해당 플래그가 true인 단계 승인 시 자동 검증 실행
- 검증 실패 → `{ validation_failed: true, validation_result }` 응답 반환
- `force=true` 파라미터로 검증 무시 가능

### 4. Claude 자동 수정 루프

- 검증 실패 시 "수정 요청 (검증 결과 포함)" 버튼으로 validation_summary를 Claude에 전달
- build_revision_context()가 검증 실패 결과를 컨텍스트에 포함
- Claude가 에러를 보고 자동으로 수정

### 5. 프론트엔드 UI

- PhaseApprovalBar: 검증 실패 배너 (명령별 pass/fail, exit code, 에러 출력)
- 강제 승인 확인 다이얼로그
- WorkflowStepEditor: run_validation 체크박스 + "검증" 뱃지

## 핵심 흐름

```
워크플로우 단계 승인 → run_validation=True? → ValidationService 실행
  → 통과: 다음 단계로 전환
  → 실패: 검증 결과 프론트엔드 반환 → 실패 배너 표시
    → "수정 요청": Claude에 검증 에러 전달 → 자동 수정
    → "강제 승인": 검증 무시하고 진행
```

## QA에서 발견·수정한 버그

1. `build_revision_context()`에 `validation_summary` 파라미터 누락 → 추가
2. 프론트엔드 revision 요청 시 validation_summary가 feedback으로 잘못 전달 → 별도 인자로 분리
3. 타임아웃 시 프로세스 미종료 → `proc.kill()` + `await proc.wait()` 추가

## 테스트 결과

- `uv run ruff check app/`: All checks passed
- `pnpm build`: 성공 (22.52s)
- `uv run pytest tests/`: 414 passed (31.49s)

## 비고

- Channel.io AI-Native DDD 아티클 참고: https://channel.io/ko/team/blog/articles/ai-native-ddd-refactoring-98c23cdb
- 기존 워크플로우의 implement 단계는 기본적으로 run_validation=True로 설정됨
- validation_commands가 설정되지 않은 워크스페이스에서는 검증이 자동 스킵 (passed=true)
