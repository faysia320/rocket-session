# 작업 이력: System Workflow 마이그레이션 데이터 정리

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

System Workflow를 생성/수정/삭제하던 마이그레이션 데이터 코드를 정리하여, 처음부터 Workflow 1 (Research→Implement→QA) 1개만 생성되도록 단순화했습니다. 스키마 변경은 모두 보존하고 데이터 조작 코드만 제거했습니다.

## 변경 파일 목록

### Backend

- `backend/migrations/versions/20260225_0017_add_workflow_definitions.py` - DEFAULT_STEPS를 최종 상태(Research→Implement→QA)로 교체, name/description 업데이트
- `backend/migrations/versions/20260226_0024_add_system_workflows.py` - SYSTEM_WORKFLOWS 상수 및 WF2/3 UPSERT 코드 제거, sort_order 스키마 변경만 유지
- `backend/migrations/versions/20260228_0026_add_qa_workflow_definitions.py` - 빈 마이그레이션으로 변환 (WF4 INSERT 제거)
- `backend/migrations/versions/20260302_0028_modify_workflow_qa.py` - 빈 마이그레이션으로 변환 (WF1/2 steps 업데이트 + WF4 삭제 코드 제거)
- `backend/migrations/versions/20260306_0030_refine_implement_qa_prompts.py` - 빈 마이그레이션으로 변환 (프롬프트 업데이트 코드 제거)
- `backend/migrations/versions/20260309_0031_merge_workflows.py` - 빈 마이그레이션으로 변환 (WF 병합/삭제/이름변경 코드 제거)

## 상세 변경 내용

### 1. 0017: INSERT 데이터를 최종 상태로 교체

- 구버전 `DEFAULT_STEPS` (Research→Plan→Implement)를 최종 3단계(Research→Implement→QA)로 교체
- 0031에서 정의된 최종 프롬프트 텍스트 적용
- name: 'Workflow 1', description: 'Research > Implement > QA'

### 2. 0024: 워크플로우 데이터 코드 제거

- `SYSTEM_WORKFLOWS` 상수 (200줄+) 전체 삭제
- Workflow 2/3 UPSERT for 루프 제거
- sort_order 컬럼 추가 스키마 + default-workflow sort_order 설정만 유지

### 3. 0026/0028/0030/0031: 빈 마이그레이션으로 변환

- 데이터 전용 마이그레이션 4개의 upgrade/downgrade를 `pass`로 변환
- Revision 체인은 그대로 유지하여 마이그레이션 순서 보존
- Docstring에 "(정리됨)" 표기로 이력 추적 가능

## 테스트 방법

1. DB 볼륨 삭제 후 컨테이너 재시작하여 마이그레이션 재실행
2. `SELECT id, name, is_builtin, sort_order FROM workflow_definitions;` — Workflow 1 1행만 존재 확인
3. 워크플로우 테스트 90건 통과 확인

## 비고

- 총 1,064줄 삭제, 71줄 변경으로 마이그레이션 코드 대폭 단순화
- `WorkflowDefinitionService.get_or_default()` fallback 로직은 변경 불필요 (현재 상태와 일관)
