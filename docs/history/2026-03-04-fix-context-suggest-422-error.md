# 작업 이력: Context Suggest API 422 에러 수정

- **날짜**: 2026-03-04
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

채팅 입력란에 1000자 이상의 긴 텍스트를 입력할 때 `/api/workspaces/{id}/context/suggest` 엔드포인트에서 반복 발생하던 422 (Unprocessable Content) 에러를 수정했습니다. 프론트엔드 API 클라이언트에서 prompt를 백엔드 제한(1000자)에 맞게 truncate하여 전송합니다.

## 변경 파일 목록

### Frontend

- `frontend/src/lib/api/context.api.ts` - prompt 길이 제한 truncation 추가

## 상세 변경 내용

### 1. 근본 원인

- 백엔드 `context.py`에서 `prompt` 파라미터에 `Query(max_length=1000)` 검증 존재
- 프론트엔드에서 ChatInput의 실시간 입력을 500ms debounce 후 그대로 GET 쿼리 파라미터로 전송
- 1000자 초과 시 FastAPI/Pydantic이 자동으로 422 반환

### 2. 수정 내용

- `MAX_PROMPT_LENGTH = 1000` 상수 추가 (백엔드 `_MAX_PROMPT_LENGTH`와 동일)
- `suggest()` 함수: `prompt?.slice(0, MAX_PROMPT_LENGTH)` 적용
- `suggestFiles()` 함수: `prompt.slice(0, MAX_PROMPT_LENGTH)` 적용
- Context suggestion은 키워드 추출 용도이므로 전체 프롬프트가 불필요, truncation이 기능에 영향 없음

## 테스트 방법

1. 채팅 입력란에 1000자 이상의 긴 텍스트 입력
2. 브라우저 개발자 도구 Network 탭에서 422 에러가 발생하지 않는지 확인
3. Context suggestion이 정상 동작하는지 확인

## 비고

- 백엔드의 `_MAX_PROMPT_LENGTH = 1000` 제한은 의도된 보호 장치로 유지
- 클라이언트 측 truncation은 방어적 이중 보호 역할
