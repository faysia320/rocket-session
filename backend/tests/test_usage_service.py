"""Tests for UsageService (Anthropic OAuth API)."""

import time
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest

from app.schemas.usage import PeriodUsage, UsageInfo
from app.services.usage_service import UsageService


@pytest.mark.asyncio
class TestUsageService:
    """Test suite for UsageService."""

    async def test_get_usage_success(self, usage_service):
        """Test get_usage with successful OAuth API response."""
        api_response = {
            "five_hour": {"utilization": 13.0, "resets_at": "2026-02-14T12:00:00Z"},
            "seven_day": {"utilization": 30.0, "resets_at": "2026-02-20T04:00:00Z"},
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = api_response
        mock_resp.raise_for_status = MagicMock()

        with patch.object(usage_service, "_read_access_token", return_value="test-token"):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
                result = await usage_service.get_usage()

        assert result.available is True
        assert result.error is None
        assert result.five_hour.utilization == 13.0
        assert result.five_hour.resets_at == "2026-02-14T12:00:00Z"
        assert result.seven_day.utilization == 30.0
        assert result.seven_day.resets_at == "2026-02-20T04:00:00Z"

    async def test_get_usage_cache_hit(self, usage_service):
        """Test get_usage returns cached result within TTL."""
        api_response = {
            "five_hour": {"utilization": 10.0, "resets_at": None},
            "seven_day": {"utilization": 20.0, "resets_at": None},
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = api_response
        mock_resp.raise_for_status = MagicMock()

        with patch.object(usage_service, "_read_access_token", return_value="test-token"):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp) as mock_get:
                result1 = await usage_service.get_usage()
                result2 = await usage_service.get_usage()

        assert result1 == result2
        assert mock_get.call_count == 1  # Only called once

    async def test_get_usage_cache_expired(self, usage_service):
        """Test get_usage re-fetches after cache TTL expires."""
        resp1_data = {
            "five_hour": {"utilization": 10.0, "resets_at": None},
            "seven_day": {"utilization": 20.0, "resets_at": None},
        }
        resp2_data = {
            "five_hour": {"utilization": 50.0, "resets_at": None},
            "seven_day": {"utilization": 60.0, "resets_at": None},
        }

        mock_resp1 = MagicMock()
        mock_resp1.status_code = 200
        mock_resp1.json.return_value = resp1_data
        mock_resp1.raise_for_status = MagicMock()

        mock_resp2 = MagicMock()
        mock_resp2.status_code = 200
        mock_resp2.json.return_value = resp2_data
        mock_resp2.raise_for_status = MagicMock()

        with patch.object(usage_service, "_read_access_token", return_value="test-token"):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=[mock_resp1, mock_resp2]):
                result1 = await usage_service.get_usage()
                usage_service._cache_time = time.time() - 100
                result2 = await usage_service.get_usage()

        assert result1.five_hour.utilization == 10.0
        assert result2.five_hour.utilization == 50.0

    async def test_get_usage_no_token(self, usage_service):
        """Test get_usage returns unavailable when no token found."""
        with patch.object(usage_service, "_read_access_token", return_value=None):
            result = await usage_service.get_usage()

        assert result.available is False
        assert result.error is not None

    async def test_get_usage_http_error(self, usage_service):
        """Test get_usage handles HTTP errors gracefully."""
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized"
        http_error = httpx.HTTPStatusError("", request=MagicMock(), response=mock_resp)

        with patch.object(usage_service, "_read_access_token", return_value="test-token"):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=http_error):
                result = await usage_service.get_usage()

        assert result.available is False
        assert "401" in result.error

    async def test_get_usage_timeout(self, usage_service):
        """Test get_usage handles timeout gracefully."""
        with patch.object(usage_service, "_read_access_token", return_value="test-token"):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=httpx.TimeoutException("")):
                result = await usage_service.get_usage()

        assert result.available is False

    async def test_get_usage_missing_fields(self, usage_service):
        """Test get_usage handles missing fields in API response."""
        api_response = {}  # Empty response

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = api_response
        mock_resp.raise_for_status = MagicMock()

        with patch.object(usage_service, "_read_access_token", return_value="test-token"):
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
                result = await usage_service.get_usage()

        assert result.available is True
        assert result.five_hour.utilization == 0.0
        assert result.seven_day.utilization == 0.0

    async def test_warmup(self, usage_service):
        """Test warmup calls get_usage."""
        with patch.object(usage_service, "get_usage", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = UsageInfo()
            await usage_service.warmup()
            mock_get.assert_called_once()

    async def test_warmup_failure(self, usage_service):
        """Test warmup handles failure gracefully."""
        with patch.object(usage_service, "get_usage", new_callable=AsyncMock, side_effect=Exception("fail")):
            # Should not raise
            await usage_service.warmup()
