# 작업 이력: Usage API 429 Rate Limit 처리 개선

- **날짜**: 2026-03-05
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Anthropic OAuth Usage API에서 429(Rate Limit) 응답을 받았을 때 5초만 캐싱하여 즉시 재요청하는 악순환을 수정했습니다. `Retry-After` 헤더를 파싱하여 서버가 지정한 시간만큼 대기하고, 프론트엔드도 에러 시 폴링 간격을 늘려 불필요한 요청을 차단합니다.

## 변경 파일 목록

### Backend

- `backend/app/core/constants.py` - `USAGE_CACHE_RATE_LIMIT_TTL` 상수 추가 (60초)
- `backend/app/schemas/usage.py` - `UsageInfo`에 `retry_after` 필드 추가
- `backend/app/services/usage_service.py` - 429 분기 처리, Retry-After 파싱, 캐시 TTL 동적 조정

### Frontend

- `frontend/src/types/usage.ts` - `UsageInfo` 타입에 `retry_after` 추가
- `frontend/src/features/usage/hooks/useUsage.ts` - 적응형 폴링 (에러 시 5분, 429 시 서버 지정값)

## 상세 변경 내용

### 1. 429 Rate Limit 특별 처리 (Backend)

- `_fetch_usage()`에서 `HTTPStatusError` 중 429를 별도 분기하여 `Retry-After` 헤더 파싱
- `_parse_retry_after()` 헬퍼 추가: 헤더 없으면 60초, 있으면 10~600초 클램핑
- `get_usage()`에서 `retry_after` 값 기반으로 캐시 TTL 동적 결정
- 기존: 모든 에러 5초 캐싱 → 개선: 429는 Retry-After만큼, 기타 에러는 5초 유지

### 2. 적응형 폴링 (Frontend)

- `refetchInterval`을 고정값(60초)에서 함수형으로 변경
- 정상: 60초 / 429: 서버 지정 `retry_after` / 기타 에러: 5분

## 테스트 방법

1. 컨테이너 재시작 후 사용량 정상 표시 확인
2. 429 에러 발생 시 백엔드 로그에서 `Rate limited – retry_after=N초` 메시지 확인
3. 에러 상태에서 프론트엔드 네트워크 탭의 폴링 간격이 5분으로 변경되는지 확인

## 비고

- 근본 원인: 429 에러 시 5초 캐싱 → 즉시 재요청 → 429 → 5초 → ... 무한 루프
- `Retry-After` 헤더가 없는 경우 기본 60초 대기로 안전하게 처리
