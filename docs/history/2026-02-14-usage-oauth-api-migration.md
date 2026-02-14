# 작업 이력: 사용량 조회 ccusage CLI → Anthropic OAuth API 전환

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

사용량 조회 방식을 ccusage CLI subprocess 호출에서 Anthropic OAuth API 직접 호출로 전환했습니다.
Docker 환경에서 ~47초 소요되던 조회가 ~1초 이내로 개선됩니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/usage.py` - BlockUsage/WeeklyUsage → PeriodUsage(utilization, resets_at) 스키마 교체
- `backend/app/services/usage_service.py` - ccusage subprocess → httpx OAuth API 호출로 전면 재작성
- `backend/app/api/dependencies.py` - UsageService 생성자 호출 변경 (settings 파라미터 제거)
- `backend/app/main.py` - 사용량 캐시 워밍업 호출 추가
- `backend/tests/conftest.py` - usage_service fixture 업데이트
- `backend/tests/test_usage_service.py` - OAuth API 기반 테스트 9개로 재작성

### Frontend

- `frontend/src/types/usage.ts` - PeriodUsage + 새 UsageInfo 타입 정의
- `frontend/src/types/index.ts` - export 타입 업데이트
- `frontend/src/features/usage/components/UsageFooter.tsx` - utilization % + 리셋 카운트다운 UI
- `frontend/src/features/usage/hooks/useUsage.ts` - refetchInterval 300초 → 60초

## 상세 변경 내용

### 1. Anthropic OAuth API 연동

- `https://api.anthropic.com/api/oauth/usage` 엔드포인트 직접 호출
- `~/.claude/.credentials.json`에서 OAuth accessToken 자동 읽기
- 캐시 TTL 60초, 타임아웃 10초
- HTTP 오류/타임아웃/토큰 부재 등 모든 에러 케이스 graceful 처리

### 2. 스키마 단순화

- 기존: BlockUsage(total_tokens, cost_usd, is_active, time_remaining, burn_rate) + WeeklyUsage(total_tokens, cost_usd, models_used)
- 변경: PeriodUsage(utilization: float 0-100, resets_at: ISO datetime string)
- API 응답의 five_hour, seven_day 구조를 그대로 매핑

### 3. UsageFooter UI 개선

- utilization 퍼센트 표시 + 리셋까지 남은 시간 카운트다운
- 색상 구간: 초록(<50%) → 노랑(50-80%) → 빨강(>80%)
- 불필요한 formatTokens, Flame 아이콘 제거

## 테스트 방법

1. 백엔드: `cd backend && uv run pytest tests/test_usage_service.py -v` (9/9 통과)
2. 프론트엔드: `cd frontend && pnpm build` (빌드 성공)
3. API 응답: `curl -s http://localhost:8100/api/usage/` (~1초 이내)
4. 브라우저: footer에서 5h/wk utilization 확인

## 비고

- ccusage CLI 의존성이 완전히 제거됨 (Dockerfile에서도 이미 제거됨)
- OAuth 토큰은 Claude Code CLI 로그인 시 자동 생성되므로 별도 설정 불필요
