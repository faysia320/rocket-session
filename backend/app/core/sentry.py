"""Sentry 호환 에러 추적 초기화 (GlitchTip 대상)."""

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
import structlog


def setup_sentry(dsn: str, environment: str) -> None:
    """Sentry SDK 초기화 (GlitchTip 호환). dsn이 비어있으면 아무것도 하지 않음."""
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            AsyncioIntegration(),
        ],
        send_default_pii=False,
        before_send=_enrich_event,
        # GlitchTip은 트레이싱을 지원하지 않으므로 비활성화
        traces_sample_rate=0,
    )


def _enrich_event(event, hint):
    """structlog contextvars에서 session_id, request_id를 Sentry 태그로 주입."""
    ctx = structlog.contextvars.get_contextvars()
    tags = event.setdefault("tags", {})
    for key in ("session_id", "request_id"):
        if key in ctx:
            tags[key] = ctx[key]
    return event
