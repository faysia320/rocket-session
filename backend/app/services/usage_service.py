"""Anthropic OAuth API를 통한 사용량 조회 서비스."""

import asyncio
import json
import logging
import time
from pathlib import Path

import httpx

from app.core.constants import (
    USAGE_CACHE_ERROR_TTL,
    USAGE_CACHE_RATE_LIMIT_TTL,
    USAGE_CACHE_TTL,
    USAGE_HTTP_TIMEOUT,
)
from app.schemas.usage import PeriodUsage, UsageInfo

logger = logging.getLogger(__name__)

_API_URL = "https://api.anthropic.com/api/oauth/usage"
_TIMEOUT = USAGE_HTTP_TIMEOUT
_CACHE_TTL = USAGE_CACHE_TTL


def _find_credentials_path() -> Path | None:
    """OAuth 자격증명 파일 경로를 찾습니다."""
    candidates = [
        Path.home() / ".claude" / ".credentials.json",
        Path("/root/.claude/.credentials.json"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


class UsageService:
    """Anthropic OAuth API를 통해 사용량을 조회합니다."""

    def __init__(self, **_kwargs) -> None:
        self._cache: UsageInfo | None = None
        self._cache_time: float = 0
        # 재사용 가능한 HTTP 클라이언트 (연결 풀링)
        self._client: httpx.AsyncClient | None = None
        # inflight dedup: 동시 요청을 하나의 fetch로 통합
        self._inflight_event: asyncio.Event | None = None
        self._inflight_result: UsageInfo | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """재사용 가능한 HTTP 클라이언트 반환."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=_TIMEOUT)
        return self._client

    async def close(self) -> None:
        """HTTP 클라이언트 정리."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def warmup(self) -> None:
        """서버 시작 시 백그라운드에서 캐시를 워밍업합니다."""
        logger.info("사용량 캐시 워밍업 시작")
        try:
            await self.get_usage()
            logger.info("사용량 캐시 워밍업 완료")
        except Exception as e:
            logger.warning("사용량 캐시 워밍업 실패: %s", e)

    async def get_usage(self) -> UsageInfo:
        """캐시된 사용량 정보를 반환합니다 (inflight dedup 패턴).

        첫 번째 호출만 실제 fetch를 수행하고,
        동시 호출들은 Event.wait()로 결과를 공유합니다.
        """
        now = time.time()
        if self._cache and (now - self._cache_time) < _CACHE_TTL:
            return self._cache

        # 이미 누군가 fetch 중이면 결과를 기다림
        if self._inflight_event is not None:
            await self._inflight_event.wait()
            if self._inflight_result is not None:
                return self._inflight_result
            # fallback: inflight 결과가 없으면 캐시 반환
            if self._cache:
                return self._cache

        # 이 코루틴이 fetch 담당
        self._inflight_event = asyncio.Event()
        self._inflight_result = None
        try:
            # Double-check: Event 설정 사이에 다른 코루틴이 캐시를 갱신했을 수 있음
            now = time.time()
            if self._cache and (now - self._cache_time) < _CACHE_TTL:
                return self._cache

            result = await self._fetch_usage()
            self._cache = result
            if result.available:
                self._cache_time = now
            elif result.retry_after is not None:
                # 429 Rate Limit: Retry-After 값만큼 캐싱
                self._cache_time = now - _CACHE_TTL + result.retry_after
            else:
                self._cache_time = now - _CACHE_TTL + USAGE_CACHE_ERROR_TTL
            self._inflight_result = result
            return result
        finally:
            event = self._inflight_event
            self._inflight_event = None
            if event:
                event.set()

    async def _fetch_usage(self) -> UsageInfo:
        """Anthropic OAuth API에서 사용량을 조회합니다."""
        # 블로킹 파일 I/O를 이벤트 루프 외부에서 실행
        token = await asyncio.to_thread(self._read_access_token)
        if not token:
            return UsageInfo(
                available=False,
                error="OAuth 자격증명을 찾을 수 없습니다 (~/.claude/.credentials.json)",
            )

        try:
            # 재사용 가능한 HTTP 클라이언트로 연결 풀링 활용
            client = await self._get_client()
            resp = await client.get(
                _API_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "anthropic-beta": "oauth-2025-04-20",
                    "User-Agent": "claude-code/2.0.32",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            five_hour_raw = data.get("five_hour", {})
            seven_day_raw = data.get("seven_day", {})

            return UsageInfo(
                five_hour=PeriodUsage(
                    utilization=five_hour_raw.get("utilization", 0.0),
                    resets_at=five_hour_raw.get("resets_at"),
                ),
                seven_day=PeriodUsage(
                    utilization=seven_day_raw.get("utilization", 0.0),
                    resets_at=seven_day_raw.get("resets_at"),
                ),
                available=True,
            )
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            logger.error(
                "OAuth API HTTP 오류: %d %s",
                status,
                e.response.text[:200],
            )
            if status == 429:
                retry_after = self._parse_retry_after(
                    e.response.headers.get("retry-after"),
                )
                logger.warning(
                    "Rate limited – retry_after=%.0f초", retry_after,
                )
                return UsageInfo(
                    available=False,
                    error="Rate limited",
                    retry_after=retry_after,
                )
            return UsageInfo(
                available=False, error=f"API 오류: {status}"
            )
        except httpx.TimeoutException:
            logger.error("OAuth API 타임아웃 (%s초)", _TIMEOUT)
            return UsageInfo(available=False, error="API 타임아웃")
        except Exception as e:
            logger.error("OAuth API 호출 실패: %s", e)
            return UsageInfo(available=False, error=str(e))

    @staticmethod
    def _parse_retry_after(header_value: str | None) -> float:
        """Retry-After 헤더를 파싱하여 대기 시간(초)을 반환합니다."""
        if not header_value:
            return USAGE_CACHE_RATE_LIMIT_TTL
        try:
            seconds = float(header_value)
            # 최소 10초, 최대 600초(10분)로 클램핑
            return max(10.0, min(seconds, 600.0))
        except (ValueError, TypeError):
            return USAGE_CACHE_RATE_LIMIT_TTL

    @staticmethod
    def _read_access_token() -> str | None:
        """~/.claude/.credentials.json에서 OAuth accessToken을 읽습니다."""
        cred_path = _find_credentials_path()
        if not cred_path:
            logger.warning("자격증명 파일을 찾을 수 없습니다")
            return None
        try:
            cred = json.loads(cred_path.read_text(encoding="utf-8"))
            token = cred.get("claudeAiOauth", {}).get("accessToken")
            if not token:
                logger.warning("accessToken이 자격증명 파일에 없습니다")
            return token
        except Exception as e:
            logger.error("자격증명 파일 읽기 실패: %s", e)
            return None
