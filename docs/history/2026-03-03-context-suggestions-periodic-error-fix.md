# 작업 이력: Context Suggestions 주기적 오류 수정

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Context Suggestions 패널에서 "컨텍스트 제안을 불러올 수 없습니다" 오류가 주기적으로 발생하는 문제를 수정했습니다. 백엔드에서 `asyncio.gather`의 부분 실패를 graceful하게 처리하고, 프론트엔드에서 불필요한 자동 refetch를 줄였습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/context_builder_service.py` - `asyncio.gather`에 `return_exceptions=True` 추가 및 부분 실패 시 빈 기본값 대체

### Frontend

- `frontend/src/features/context/hooks/useContextSuggestion.ts` - TanStack Query refetch 전략 최적화

## 상세 변경 내용

### 1. 백엔드: asyncio.gather 부분 실패 graceful 처리

- `build_full_context()`에서 3개 병렬 I/O (Memory 파일 읽기, 최근 세션 DB 쿼리, 파일 제안 DB 쿼리)를 `asyncio.gather(return_exceptions=True)`로 실행
- 기존에는 3개 중 하나라도 예외 발생 시 전체 500 에러 반환
- 변경 후: 실패한 항목만 빈 기본값으로 대체하고 성공한 항목은 정상 반환
- 실패 원인은 `logger.warning`으로 서버 로그에 기록

### 2. 프론트엔드: TanStack Query refetch 전략 최적화

| 옵션 | Before | After | 이유 |
|------|--------|-------|------|
| `staleTime` | 30초 | 60초 | 불필요한 refetch 빈도 감소 |
| `gcTime` | (미설정) | 5분 | 명시적 비활성 쿼리 정리 |
| `refetchOnWindowFocus` | true (기본값) | false | 탭 전환 시 자동 refetch 비활성화 |
| `retry` | 2 (글로벌) | 1 | 비핵심 기능, 이전 데이터 유지로 충분 |

## 관련 커밋

- (이 문서와 함께 커밋)

## 테스트 방법

1. Context Suggestions 패널 열기 → 정상 데이터 표시 확인
2. 프롬프트 입력 후 결과 갱신 확인
3. 탭 전환 후 30초 이상 뒤에 복귀 → 에러 없이 이전 데이터 유지 확인
4. 세션 실행 중 파일 변경 → 캐시 무효화 후 재요청 확인

## 비고

- `pnpm build` 통과, `uv run pytest` 404개 전부 통과
- 근본 원인: `asyncio.gather`에서 `return_exceptions=True` 미사용 + 과도한 자동 refetch 트리거
