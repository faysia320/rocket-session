"""ccusage를 통한 사용량 조회 서비스."""

import asyncio
import json
import time

from app.core.config import Settings
from app.schemas.usage import BlockUsage, UsageInfo, WeeklyUsage


class UsageService:
    """ccusage CLI를 통해 사용량을 조회합니다."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._cache: UsageInfo | None = None
        self._cache_time: float = 0
        self._cache_ttl: float = 60.0  # 60초 캐시

    async def get_usage(self) -> UsageInfo:
        """캐시된 사용량 정보를 반환합니다."""
        now = time.time()
        if self._cache and (now - self._cache_time) < self._cache_ttl:
            return self._cache

        try:
            block_data, weekly_data = await asyncio.gather(
                self._run_ccusage("blocks"),
                self._run_ccusage("weekly"),
                return_exceptions=True,
            )

            block_5h = BlockUsage()
            if isinstance(block_data, dict):
                data_list = block_data.get("data", [])
                if data_list:
                    # 활성 블록 우선, 없으면 gap이 아닌 마지막 블록
                    latest = next(
                        (b for b in reversed(data_list) if b.get("isActive")),
                        next(
                            (b for b in reversed(data_list) if not b.get("isGap")),
                            data_list[-1],
                        ),
                    )
                    burn = latest.get("burnRate") or {}
                    proj = latest.get("projection") or {}
                    block_5h = BlockUsage(
                        total_tokens=latest.get("totalTokens", 0),
                        cost_usd=latest.get("costUSD", 0.0),
                        is_active=latest.get("isActive", False),
                        time_remaining=f"{proj.get('remainingMinutes', 0)}분" if proj.get("remainingMinutes") else "",
                        burn_rate=round(burn.get("costPerHour", 0), 2) if burn else 0,
                    )

            weekly = WeeklyUsage()
            if isinstance(weekly_data, dict):
                weekly_list = weekly_data.get("weekly", [])
                if weekly_list:
                    latest = weekly_list[-1]  # 마지막 = 현재 주
                    weekly = WeeklyUsage(
                        total_tokens=latest.get("totalTokens", 0),
                        cost_usd=latest.get("totalCost", 0.0),
                        models_used=latest.get("modelsUsed", []),
                    )

            result = UsageInfo(
                plan=self._settings.claude_plan,
                block_5h=block_5h,
                weekly=weekly,
                available=True,
            )
        except Exception as e:
            result = UsageInfo(
                plan=self._settings.claude_plan,
                available=False,
                error=str(e),
            )

        self._cache = result
        self._cache_time = now
        return result

    async def _run_ccusage(self, command: str) -> dict:
        """npx ccusage 명령을 실행하고 JSON을 파싱합니다."""
        proc = await asyncio.create_subprocess_exec(
            "npx",
            "ccusage",
            command,
            "--json",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise TimeoutError(f"ccusage {command} 시간 초과 (15초)")

        if proc.returncode != 0:
            err_msg = (
                stderr.decode().strip() if stderr else f"종료 코드: {proc.returncode}"
            )
            raise RuntimeError(f"ccusage {command} 실패: {err_msg}")

        return json.loads(stdout.decode())
