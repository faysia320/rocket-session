"""Anthropic OAuth API를 통한 사용량 조회 서비스."""

import asyncio
import functools
import json
import logging
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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
_TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
_TIMEOUT = USAGE_HTTP_TIMEOUT
_CACHE_TTL = USAGE_CACHE_TTL
_FALLBACK_VERSION = "2.1.51"

# 토큰 만료 전 갱신 여유 시간 (초)
_TOKEN_REFRESH_MARGIN = 300


@functools.lru_cache(maxsize=1)
def _detect_claude_code_version() -> str:
    """설치된 Claude Code 버전을 감지합니다 (1회만 실행, 캐시)."""
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            for part in result.stdout.strip().split():
                if part and part[0].isdigit():
                    return part
    except Exception:
        pass
    return _FALLBACK_VERSION


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
        # 연속 429 카운터 (지수 백오프에 사용)
        self._consecutive_429: int = 0

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
            result = await self.get_usage()
            if result.available:
                logger.info("사용량 캐시 워밍업 완료")
            else:
                logger.warning(
                    "사용량 캐시 워밍업 완료 (에러 상태: %s)", result.error,
                )
        except Exception as e:
            logger.warning("사용량 캐시 워밍업 실패: %s", e)

    async def get_usage(self) -> UsageInfo:
        """캐시된 사용량 정보를 반환합니다 (inflight dedup 패턴).

        첫 번째 호출만 실제 fetch를 수행하고,
        동시 호출들은 Event.wait()로 결과를 공유합니다.
        """
        now = time.time()
        if self._cache and (now - self._cache_time) < _CACHE_TTL:
            if not self._cache.available:
                logger.debug(
                    "캐시된 에러 상태 반환: %s (남은 TTL=%.0f초)",
                    self._cache.error,
                    _CACHE_TTL - (now - self._cache_time),
                )
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
            if result.available:
                self._cache = result
                self._cache_time = now
                self._consecutive_429 = 0
            elif result.retry_after is not None:
                # 429 Rate Limit: 지수 백오프 적용
                self._consecutive_429 += 1
                backoff_multiplier = min(
                    2 ** (self._consecutive_429 - 1), 8,
                )
                effective_retry = min(
                    result.retry_after * backoff_multiplier, 600.0,
                )
                logger.warning(
                    "Rate limit 지수 백오프: consecutive=%d, "
                    "base=%.0f초, effective=%.0f초",
                    self._consecutive_429,
                    result.retry_after,
                    effective_retry,
                )
                self._cache = result.model_copy(
                    update={"retry_after": effective_retry},
                )
                self._cache_time = now - _CACHE_TTL + effective_retry
            else:
                self._cache = result
                self._cache_time = now - _CACHE_TTL + USAGE_CACHE_ERROR_TTL
            self._inflight_result = self._cache
            return self._cache
        finally:
            event = self._inflight_event
            self._inflight_event = None
            if event:
                event.set()

    async def _fetch_usage(self) -> UsageInfo:
        """Anthropic OAuth API에서 사용량을 조회합니다."""
        # 블로킹 파일 I/O를 이벤트 루프 외부에서 실행
        creds = await asyncio.to_thread(self._read_credentials)
        if not creds:
            return UsageInfo(
                available=False,
                error="OAuth 자격증명을 찾을 수 없습니다 (~/.claude/.credentials.json)",
            )

        token = creds.get("accessToken")
        if not token:
            return UsageInfo(
                available=False,
                error="accessToken이 자격증명 파일에 없습니다",
            )

        # 토큰 만료 체크 + 자동 갱신
        token = await self._ensure_valid_token(creds, token)
        if not token:
            return UsageInfo(
                available=False,
                error="OAuth 토큰 갱신 실패",
            )

        try:
            # 재사용 가능한 HTTP 클라이언트로 연결 풀링 활용
            client = await self._get_client()
            version = _detect_claude_code_version()
            resp = await client.get(
                _API_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "anthropic-beta": "oauth-2025-04-20",
                    "User-Agent": f"claude-code/{version}",
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
                body_hint = e.response.text[:100].strip()
                logger.warning(
                    "Rate limited – retry_after=%.0f초, body=%s",
                    retry_after,
                    body_hint,
                )
                error_msg = "Rate limited"
                if body_hint:
                    error_msg = f"Rate limited: {body_hint}"
                return UsageInfo(
                    available=False,
                    error=error_msg,
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

    async def _ensure_valid_token(
        self,
        creds: dict[str, Any],
        current_token: str,
    ) -> str | None:
        """토큰 만료 여부를 확인하고, 만료 시 자동 갱신합니다.

        Returns:
            유효한 access token 또는 갱신 실패 시 None.
        """
        expires_at = creds.get("expiresAt")
        if not expires_at:
            # expiresAt 필드가 없으면 갱신 불가, 현재 토큰으로 시도
            return current_token

        try:
            if isinstance(expires_at, str):
                expiry = datetime.fromisoformat(
                    expires_at.replace("Z", "+00:00"),
                )
            else:
                # epoch milliseconds
                expiry = datetime.fromtimestamp(
                    expires_at / 1000, tz=timezone.utc,
                )

            remaining = (expiry - datetime.now(timezone.utc)).total_seconds()
            if remaining > _TOKEN_REFRESH_MARGIN:
                return current_token  # 아직 유효

            logger.info(
                "OAuth 토큰 만료 임박 (%.0f초 남음), 갱신 시도", remaining,
            )
        except (ValueError, TypeError, OSError) as e:
            logger.warning("expiresAt 파싱 실패 (%s), 현재 토큰으로 시도", e)
            return current_token

        # 갱신 시도
        refresh_token = creds.get("refreshToken")
        client_id = creds.get("clientId")
        if not refresh_token or not client_id:
            logger.warning(
                "refreshToken 또는 clientId 없음, 토큰 갱신 불가 "
                "(refreshToken=%s, clientId=%s)",
                "있음" if refresh_token else "없음",
                "있음" if client_id else "없음",
            )
            return current_token

        return await self._refresh_token(creds, refresh_token, client_id)

    async def _refresh_token(
        self,
        creds: dict[str, Any],
        refresh_token: str,
        client_id: str,
    ) -> str | None:
        """OAuth refresh_token을 사용하여 새 access_token을 발급받습니다."""
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
        }

        try:
            client = await self._get_client()
            resp = await client.post(
                _TOKEN_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

            new_access_token = data.get("access_token")
            new_refresh_token = data.get("refresh_token", refresh_token)
            expires_in = data.get("expires_in", 3600)

            if not new_access_token:
                logger.error("토큰 갱신 응답에 access_token 없음")
                return None

            # 자격증명 파일 업데이트
            new_expires_at = datetime.fromtimestamp(
                time.time() + expires_in, tz=timezone.utc,
            ).isoformat()

            await asyncio.to_thread(
                self._update_credentials,
                creds,
                new_access_token,
                new_refresh_token,
                new_expires_at,
            )

            logger.info(
                "OAuth 토큰 갱신 성공 (expires_in=%d초)", expires_in,
            )
            return new_access_token

        except httpx.HTTPStatusError as e:
            logger.error(
                "토큰 갱신 HTTP 오류: %d %s",
                e.response.status_code,
                e.response.text[:200],
            )
            return None
        except Exception as e:
            logger.error("토큰 갱신 실패: %s", e)
            return None

    @staticmethod
    def _update_credentials(
        creds: dict[str, Any],
        access_token: str,
        refresh_token: str,
        expires_at: str,
    ) -> None:
        """자격증명 파일에 갱신된 토큰을 저장합니다."""
        cred_path = _find_credentials_path()
        if not cred_path:
            logger.warning("자격증명 파일을 찾을 수 없어 토큰 저장 불가")
            return
        try:
            full_cred = json.loads(cred_path.read_text(encoding="utf-8"))
            oauth_data = full_cred.get("claudeAiOauth", {})
            oauth_data["accessToken"] = access_token
            oauth_data["refreshToken"] = refresh_token
            oauth_data["expiresAt"] = expires_at
            full_cred["claudeAiOauth"] = oauth_data
            cred_path.write_text(
                json.dumps(full_cred, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            logger.debug("자격증명 파일 업데이트 완료")
        except Exception as e:
            logger.error("자격증명 파일 저장 실패: %s", e)

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
    def _read_credentials() -> dict[str, Any] | None:
        """~/.claude/.credentials.json에서 OAuth 자격증명을 읽습니다."""
        cred_path = _find_credentials_path()
        if not cred_path:
            logger.warning("자격증명 파일을 찾을 수 없습니다")
            return None
        try:
            cred = json.loads(cred_path.read_text(encoding="utf-8"))
            oauth = cred.get("claudeAiOauth", {})
            if not oauth:
                logger.warning("claudeAiOauth 섹션이 자격증명 파일에 없습니다")
                return None
            return oauth
        except Exception as e:
            logger.error("자격증명 파일 읽기 실패: %s", e)
            return None
