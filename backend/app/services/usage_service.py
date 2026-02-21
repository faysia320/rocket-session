"""Anthropic OAuth API를 통한 사용량 조회 서비스."""

import asyncio
import json
import logging
import time
from pathlib import Path

import httpx

from app.schemas.usage import PeriodUsage, UsageInfo

logger = logging.getLogger(__name__)

_API_URL = "https://api.anthropic.com/api/oauth/usage"
_TIMEOUT = 10.0
_CACHE_TTL = 60.0  # 60초 캐시


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
        # 캐시 스탬피드 방지용 락
        self._lock = asyncio.Lock()

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
        """캐시된 사용량 정보를 반환합니다 (스탬피드 방지)."""
        now = time.time()
        if self._cache and (now - self._cache_time) < _CACHE_TTL:
            return self._cache

        async with self._lock:
            # Double-check: lock 획득 사이에 다른 코루틴이 캐시를 갱신했을 수 있음
            now = time.time()
            if self._cache and (now - self._cache_time) < _CACHE_TTL:
                return self._cache

            result = await self._fetch_usage()
            self._cache = result
            # 에러 응답은 짧은 TTL(5초)로 캐싱하여 빠른 재시도 허용
            self._cache_time = now if result.available else now - _CACHE_TTL + 5.0
            return result

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
            logger.error(
                "OAuth API HTTP 오류: %d %s",
                e.response.status_code,
                e.response.text[:200],
            )
            return UsageInfo(
                available=False, error=f"API 오류: {e.response.status_code}"
            )
        except httpx.TimeoutException:
            logger.error("OAuth API 타임아웃 (%s초)", _TIMEOUT)
            return UsageInfo(available=False, error="API 타임아웃")
        except Exception as e:
            logger.error("OAuth API 호출 실패: %s", e)
            return UsageInfo(available=False, error=str(e))

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
