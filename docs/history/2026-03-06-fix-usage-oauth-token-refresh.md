# 작업 이력: Usage API OAuth 토큰 자동 갱신 구현

- **날짜**: 2026-03-06
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Top Bar 사용량 표시가 "Rate limited" 에러로 동작하지 않는 문제를 수정했습니다.
근본 원인은 OAuth access token이 만료되었으나 자동 갱신 로직이 없어 만료된 토큰으로 계속 요청하여 Anthropic API가 429를 반환하는 것이었습니다.
Claude Code CLI 소스(`cli.js`)를 역분석하여 동일한 토큰 갱신 프로토콜을 구현했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/usage_service.py` - OAuth 토큰 자동 갱신, User-Agent 동적 감지, 에러 가시성 개선
- `backend/tests/test_usage_service.py` - 새 API에 맞춘 테스트 업데이트 + 토큰 갱신 테스트 2개 추가

## 상세 변경 내용

### 1. OAuth 토큰 자동 갱신

- `_ensure_valid_token()`: `expiresAt` 필드를 확인하여 만료 5분 전에 자동 갱신 트리거
- `_refresh_token()`: `https://platform.claude.com/v1/oauth/token`에 `grant_type=refresh_token` 요청
- `_update_credentials()`: 갱신된 토큰을 `~/.claude/.credentials.json`에 저장 (CLI 호환)
- `_read_credentials()`: 기존 `_read_access_token()`을 대체, OAuth 자격증명 전체를 dict로 반환

### 2. User-Agent 동적 감지

- `_detect_claude_code_version()`: `claude --version` 실행하여 실제 설치된 버전 감지 (lru_cache)
- 하드코딩 `"claude-code/2.0.32"` → 동적 `f"claude-code/{version}"` (fallback: 2.1.51)
- `Content-Type: application/json` 헤더 추가 (CLI와 동일)

### 3. 에러 가시성 개선

- `warmup()`: `result.available` 체크 → 에러 상태이면 `logger.warning()` 출력 (기존: 429여도 "완료")
- `get_usage()` 캐시 히트: `available=False` 반환 시 `logger.debug()` 추가 (남은 TTL 포함)
- 429 에러: 응답 본문 일부를 `error` 필드에 포함하여 UI에서 원인 즉시 확인 가능

## 테스트 방법

1. 백엔드: `cd backend && uv run pytest tests/test_usage_service.py -v` (11/11 통과)
2. Docker 재빌드 후 Top Bar 사용량 표시 정상 작동 확인
3. 서버 시작 로그에서 `"OAuth 토큰 만료 임박... 갱신 시도"` → `"OAuth 토큰 갱신 성공"` 확인

## 비고

- CLI 소스 역분석: TOKEN_URL, grant_type, client_id, scopes 모두 CLI(`cli.js`)에서 추출
- CLI의 OAuth scopes: `user:profile`, `user:inference`, `user:sessions:claude_code`, `user:mcp_servers`
- `anthropic-beta: oauth-2025-04-20` 헤더는 CLI 2.1.51과 동일한 값으로 유지
