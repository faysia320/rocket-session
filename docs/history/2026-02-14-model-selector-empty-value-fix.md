# 작업 이력: ModelSelector Select.Item 빈 value 에러 수정

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

ModelSelector 컴포넌트에서 Radix UI `<Select.Item />`의 빈 문자열 value 제약으로 인한 런타임 에러를 수정했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/ModelSelector.tsx` - Default 항목의 value를 빈 문자열에서 'default'로 변경

## 상세 변경 내용

### 1. Radix UI Select.Item 빈 value 에러 수정

- **문제**: `MODELS` 배열의 Default 항목이 `value: ''`로 설정되어 있어 Radix UI가 런타임 에러 발생
  - `Uncaught Error: A <Select.Item /> must have a value prop that is not an empty string.`
- **원인**: Radix UI는 빈 문자열을 selection 초기화에 사용하므로 `<Select.Item />`의 value로 허용하지 않음
- **수정**:
  1. `MODELS` 배열의 Default value를 `''` → `'default'`로 변경
  2. `useState`/`useEffect` 초기값을 `''` → `'default'`로 변경
  3. `handleChange`에서 API 전송 시 `'default'` 값을 `null`로 변환하여 백엔드 호환성 유지

## 관련 커밋

- (이 문서와 함께 커밋)

## 테스트 방법

1. 세션 페이지에서 ModelSelector 드롭다운이 에러 없이 렌더링되는지 확인
2. "Default" 선택 시 API에 `model: null`이 전송되는지 확인
3. 다른 모델 선택 후 다시 "Default"로 돌아올 수 있는지 확인
