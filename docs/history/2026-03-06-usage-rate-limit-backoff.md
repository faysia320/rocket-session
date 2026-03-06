# 작업 이력: Usage Rate Limit 지수 백오프 및 UI 개선

- **날짜**: 2026-03-06
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Top bar 사용량 표시에서 Anthropic OAuth Usage API 429 Rate Limit 에러가 반복 발생하는 문제를 해결.
폴링 간격을 120초로 조정하고, 연속 429 시 지수 백오프(최대 10분)를 적용하며,
탭 전환 시 불필요한 refetch를 차단하고, 에러 UI를 사용자 친화적으로 개선.

## 변경 파일 목록

### Backend

- `backend/app/core/constants.py` - 캐시 TTL 상수 3개 조정 (60→120, 5→30, 60→120)
- `backend/app/services/usage_service.py` - 연속 429 카운터 + 지수 백오프 로직 추가

### Frontend

- `frontend/src/features/usage/hooks/useUsage.ts` - staleTime/refetchInterval 120초, refetchOnWindowFocus 비활성화
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Rate limit 시 Clock 아이콘 + 한국어 메시지 표시

## 상세 변경 내용

### 1. 캐시 TTL 상수 조정

- `USAGE_CACHE_TTL`: 60초 → 120초 (폴링 빈도 절반 감소)
- `USAGE_CACHE_ERROR_TTL`: 5초 → 30초 (에러 시 재시도 간격 증가)
- `USAGE_CACHE_RATE_LIMIT_TTL`: 60초 → 120초 (429 기본 대기 증가)

### 2. 지수 백오프 구현

- `_consecutive_429` 카운터 추가
- 연속 429 시: 120초 → 240초 → 480초 → 600초(상한)로 대기 증가
- 성공 시 카운터 리셋
- `model_copy()`로 백오프 적용된 retry_after를 프론트에 전달

### 3. 프론트엔드 폴링 최적화

- `refetchOnWindowFocus: false` 추가 (탭 전환 시 추가 요청 차단)
- staleTime, refetchInterval을 백엔드 TTL과 동기화 (120초)

### 4. 에러 UI 개선

- Rate limit: Clock 아이콘 + "사용량 조회 제한됨 (N분 후 재시도)"
- 기타 에러: "사용량 정보를 일시적으로 가져올 수 없습니다"
- raw JSON 에러 메시지 더 이상 노출하지 않음

## 테스트 방법

1. Docker 재빌드 후 컨테이너 재시작
2. Top bar 사용량 표시 정상 작동 확인
3. 429 발생 시 Clock 아이콘 + 한국어 메시지 표시 확인
4. 백엔드 로그에서 "Rate limit 지수 백오프" 메시지로 백오프 동작 확인
5. 탭 전환 시 추가 요청 발생하지 않음 확인
