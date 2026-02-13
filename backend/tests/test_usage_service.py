"""Tests for UsageService."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.usage import BlockUsage, UsageInfo, WeeklyUsage
from app.services.usage_service import UsageService


@pytest.mark.asyncio
class TestUsageService:
    """Test suite for UsageService."""

    async def test_get_usage_success(self, usage_service):
        """Test get_usage with successful blocks and weekly responses."""
        blocks_response = {
            "blocks": [
                {
                    "totalTokens": 10000,
                    "costUSD": 0.5,
                    "isActive": True,
                    "isGap": False,
                    "burnRate": {"costPerHour": 1.2},
                    "projection": {"remainingMinutes": 180},
                }
            ]
        }
        weekly_response = {
            "weekly": [
                {
                    "totalTokens": 50000,
                    "totalCost": 2.5,
                    "modelsUsed": ["claude-3-5-sonnet-20241022"],
                }
            ]
        }

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        assert result.available is True
        assert result.error is None
        assert result.plan == "Max"
        assert result.account_id == "test-account"
        assert result.block_5h.total_tokens == 10000
        assert result.block_5h.cost_usd == 0.5
        assert result.block_5h.is_active is True
        assert result.block_5h.time_remaining == "180분"
        assert result.block_5h.burn_rate == 1.2
        assert result.weekly.total_tokens == 50000
        assert result.weekly.cost_usd == 2.5
        assert result.weekly.models_used == ["claude-3-5-sonnet-20241022"]

        assert mock_run.call_count == 2

    async def test_get_usage_cache_hit(self, usage_service):
        """Test get_usage returns cached result within TTL."""
        blocks_response = {"blocks": [{"totalTokens": 1000, "costUSD": 0.1}]}
        weekly_response = {"weekly": [{"totalTokens": 5000, "totalCost": 0.5}]}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            # First call - should execute ccusage
            result1 = await usage_service.get_usage()
            # Second call - should return cache
            result2 = await usage_service.get_usage()

        assert result1 == result2
        assert mock_run.call_count == 2  # Only called once (first time)

    async def test_get_usage_cache_expired(self, usage_service):
        """Test get_usage re-fetches after cache TTL expires."""
        blocks_response1 = {"blocks": [{"totalTokens": 1000, "costUSD": 0.1}]}
        weekly_response1 = {"weekly": [{"totalTokens": 5000, "totalCost": 0.5}]}
        blocks_response2 = {"blocks": [{"totalTokens": 2000, "costUSD": 0.2}]}
        weekly_response2 = {"weekly": [{"totalTokens": 6000, "totalCost": 0.6}]}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [
                blocks_response1,
                weekly_response1,
                blocks_response2,
                weekly_response2,
            ]

            # First call
            result1 = await usage_service.get_usage()
            # Expire cache
            usage_service._cache_time = time.time() - 100
            # Second call - should re-fetch
            result2 = await usage_service.get_usage()

        assert result1.block_5h.total_tokens == 1000
        assert result2.block_5h.total_tokens == 2000
        assert mock_run.call_count == 4

    async def test_get_usage_active_block(self, usage_service):
        """Test get_usage finds active block correctly."""
        blocks_response = {
            "blocks": [
                {"totalTokens": 1000, "costUSD": 0.1, "isActive": False},
                {"totalTokens": 2000, "costUSD": 0.2, "isActive": True},
                {"totalTokens": 3000, "costUSD": 0.3, "isActive": False},
            ]
        }
        weekly_response = {"weekly": []}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        # Should pick the active block (2000 tokens)
        assert result.block_5h.total_tokens == 2000
        assert result.block_5h.is_active is True

    async def test_get_usage_no_active_block_last_non_gap(self, usage_service):
        """Test get_usage falls back to last non-gap block when no active block."""
        blocks_response = {
            "blocks": [
                {"totalTokens": 1000, "costUSD": 0.1, "isActive": False, "isGap": False},
                {"totalTokens": 2000, "costUSD": 0.2, "isActive": False, "isGap": False},
                {"totalTokens": 0, "costUSD": 0.0, "isActive": False, "isGap": True},
            ]
        }
        weekly_response = {"weekly": []}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        # Should pick the last non-gap block (2000 tokens)
        assert result.block_5h.total_tokens == 2000
        assert result.block_5h.is_active is False

    async def test_get_usage_empty_blocks_data(self, usage_service):
        """Test get_usage handles empty blocks data array."""
        blocks_response = {"blocks": []}
        weekly_response = {"weekly": [{"totalTokens": 5000, "totalCost": 0.5}]}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        assert result.available is True
        assert result.block_5h.total_tokens == 0
        assert result.block_5h.cost_usd == 0.0
        assert result.weekly.total_tokens == 5000

    async def test_get_usage_weekly_last_item(self, usage_service):
        """Test get_usage correctly picks the last item from weekly array."""
        blocks_response = {"blocks": []}
        weekly_response = {
            "weekly": [
                {"totalTokens": 10000, "totalCost": 1.0, "modelsUsed": ["model-1"]},
                {"totalTokens": 20000, "totalCost": 2.0, "modelsUsed": ["model-2"]},
                {"totalTokens": 30000, "totalCost": 3.0, "modelsUsed": ["model-3"]},
            ]
        }

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        # Should pick the last weekly item
        assert result.weekly.total_tokens == 30000
        assert result.weekly.cost_usd == 3.0
        assert result.weekly.models_used == ["model-3"]

    async def test_get_usage_empty_weekly_array(self, usage_service):
        """Test get_usage handles empty weekly array."""
        blocks_response = {"blocks": [{"totalTokens": 1000, "costUSD": 0.1}]}
        weekly_response = {"weekly": []}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        assert result.available is True
        assert result.block_5h.total_tokens == 1000
        assert result.weekly.total_tokens == 0
        assert result.weekly.cost_usd == 0.0
        assert result.weekly.models_used == []

    async def test_get_usage_blocks_failure_weekly_success(self, usage_service):
        """Test get_usage handles partial failure (blocks fail, weekly succeeds)."""
        blocks_error = RuntimeError("blocks command failed")
        weekly_response = {"weekly": [{"totalTokens": 5000, "totalCost": 0.5}]}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_error, weekly_response]

            result = await usage_service.get_usage()

        # Should still return partial data with weekly info
        assert result.block_5h.total_tokens == 0  # Default values
        assert result.weekly.total_tokens == 5000

    async def test_get_usage_exception_available_false(self, usage_service):
        """Test get_usage sets available=False on unexpected exception."""
        # asyncio.gather 자체가 실패하도록 만듦
        with patch("asyncio.gather", new_callable=AsyncMock, side_effect=Exception("unexpected error")):
            result = await usage_service.get_usage()

        assert result.available is False
        assert "unexpected error" in result.error
        assert result.plan == "Max"
        assert result.account_id == "test-account"

    async def test_get_usage_plan_account_id_from_settings(self, settings):
        """Test get_usage returns plan and account_id from settings."""
        service = UsageService(settings)
        blocks_response = {"blocks": []}
        weekly_response = {"weekly": []}

        with patch.object(service, "_run_ccusage", new_callable=AsyncMock) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await service.get_usage()

        assert result.plan == "Max"
        assert result.account_id == "test-account"

    async def test_run_ccusage_timeout(self, usage_service):
        """Test _run_ccusage raises TimeoutError on timeout."""
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(
            side_effect=[asyncio.TimeoutError(), (b"", b"")]
        )
        mock_proc.kill = MagicMock()

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_proc
        ):
            with pytest.raises(TimeoutError) as exc_info:
                await usage_service._run_ccusage("blocks")

            assert "시간 초과" in str(exc_info.value) or "시간" in str(exc_info.value)
            mock_proc.kill.assert_called_once()

    async def test_run_ccusage_non_zero_exit_code(self, usage_service):
        """Test _run_ccusage raises RuntimeError on non-zero exit code."""
        mock_proc = AsyncMock()
        mock_proc.returncode = 1
        mock_proc.communicate = AsyncMock(return_value=(b"", b"command not found"))

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_proc
        ) as mock_create:
            with pytest.raises(RuntimeError) as exc_info:
                await usage_service._run_ccusage("blocks")

            assert "실패" in str(exc_info.value)
            assert "command not found" in str(exc_info.value)

    async def test_run_ccusage_success(self, usage_service):
        """Test _run_ccusage successfully parses JSON response."""
        expected_data = {"blocks": [{"totalTokens": 1000}]}
        mock_proc = AsyncMock()
        mock_proc.returncode = 0
        mock_proc.communicate = AsyncMock(
            return_value=(b'{"blocks": [{"totalTokens": 1000}]}', b"")
        )

        with patch(
            "asyncio.create_subprocess_exec", return_value=mock_proc
        ) as mock_create:
            result = await usage_service._run_ccusage("blocks")

        assert result == expected_data
        mock_create.assert_called_once_with(
            "npx",
            "ccusage",
            "blocks",
            "--json",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

    async def test_get_usage_burn_rate_rounding(self, usage_service):
        """Test burn_rate is rounded correctly."""
        blocks_response = {
            "blocks": [
                {
                    "totalTokens": 1000,
                    "costUSD": 0.1,
                    "isActive": True,
                    "burnRate": {"costPerHour": 1.2567},
                }
            ]
        }
        weekly_response = {"weekly": []}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        assert result.block_5h.burn_rate == 1.26  # Rounded to 2 decimals

    async def test_get_usage_missing_burn_rate(self, usage_service):
        """Test get_usage handles missing burnRate field."""
        blocks_response = {
            "blocks": [
                {
                    "totalTokens": 1000,
                    "costUSD": 0.1,
                    "isActive": True,
                    # No burnRate field
                }
            ]
        }
        weekly_response = {"weekly": []}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        assert result.block_5h.burn_rate == 0

    async def test_get_usage_missing_projection(self, usage_service):
        """Test get_usage handles missing projection field."""
        blocks_response = {
            "blocks": [
                {
                    "totalTokens": 1000,
                    "costUSD": 0.1,
                    "isActive": True,
                    # No projection field
                }
            ]
        }
        weekly_response = {"weekly": []}

        with patch.object(
            usage_service, "_run_ccusage", new_callable=AsyncMock
        ) as mock_run:
            mock_run.side_effect = [blocks_response, weekly_response]

            result = await usage_service.get_usage()

        assert result.block_5h.time_remaining == ""
