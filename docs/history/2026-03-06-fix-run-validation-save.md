# 작업 이력: QA 단계 run_validation 저장 버그 수정

- **날짜**: 2026-03-06
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 설정 UI에서 QA 단계의 "검증실행" 체크박스를 체크하고 저장해도 값이 유지되지 않는 버그를 수정했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - formData 변환 시 `run_validation` 필드 누락 수정 + view 모드 배지 추가

## 상세 변경 내용

### 1. 근본 원인

`WorkflowDefinitionDetail.tsx`에서 서버 응답을 `formData`로 변환하는 `steps.map()` 코드에 `run_validation` 필드가 포함되지 않았습니다.
이로 인해 편집 시작 시 해당 값이 `undefined`로 설정되고, 저장 시에도 누락된 채 서버로 전송되어 값이 항상 초기화되었습니다.

### 2. 수정 내용

- **useEffect 초기화** (줄 72): `run_validation: s.run_validation` 추가
- **handleCancel 리셋** (줄 104): `run_validation: s.run_validation` 추가
- **view 모드 배지** (줄 330-337): `run_validation` 활성 시 "검증" 배지 표시 추가

## 테스트 방법

1. 워크플로우 설정 페이지 접속
2. 워크플로우 정의 선택 → 편집 모드 진입
3. QA 단계의 "검증 실행" 체크박스 체크
4. 저장 클릭
5. 페이지 새로고침 후 해당 값이 유지되는지 확인
6. view 모드에서 "검증" 배지가 표시되는지 확인
