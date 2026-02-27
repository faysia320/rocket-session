"""rocket-session - FastAPI 앱 팩토리."""

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# structlog 구조화 로깅 설정 (기존 logging.basicConfig 대체)
try:
    from app.core.logging import setup_logging

    # ROCKET_LOG_FORMAT=console 이면 개발 모드 (기본: JSON)
    json_format = os.environ.get("ROCKET_LOG_FORMAT", "json") != "console"
    setup_logging(json_format=json_format)
except ImportError:
    # structlog 미설치 시 fallback
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

# Windows에서 asyncio subprocess 지원을 위해 ProactorEventLoop 사용
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from app.core.exceptions import AppError  # noqa: E402
from app.api.dependencies import (  # noqa: E402
    get_database,
    get_settings,
    get_usage_service,
    get_ws_manager,
    init_dependencies,
    shutdown_dependencies,
)
from app.api.v1.api import api_router  # noqa: E402
from app.api.v1.endpoints import ws  # noqa: E402
from app.services.pending_questions import clear_all_pending_questions  # noqa: E402
from app.api.v1.endpoints.permissions import clear_pending  # noqa: E402


async def _periodic_cleanup():
    """1시간마다 오래된 이벤트 정리."""
    from app.repositories.event_repo import EventRepository

    while True:
        await asyncio.sleep(3600)
        try:
            db = get_database()
            async with db.session() as session:
                repo = EventRepository(session)
                deleted = await repo.cleanup_old_events(24)
                await session.commit()
                if deleted:
                    logging.getLogger(__name__).info(
                        "오래된 이벤트 %d건 정리 완료", deleted
                    )
        except Exception as e:
            logging.getLogger(__name__).warning("주기적 이벤트 정리 실패: %s", e)


async def _periodic_mv_refresh():
    """5분마다 분석 Materialized View를 갱신."""
    from app.repositories.analytics_repo import AnalyticsRepository

    while True:
        await asyncio.sleep(300)  # 5분
        try:
            db = get_database()
            async with db.session() as session:
                await AnalyticsRepository.refresh_materialized_view(session)
        except Exception as e:
            logging.getLogger(__name__).warning("MV 갱신 실패: %s", e)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """앱 라이프사이클: DB 초기화 및 정리."""
    await init_dependencies()
    ws_mgr = get_ws_manager()
    await ws_mgr.start_background_tasks()
    cleanup_task = asyncio.create_task(_periodic_cleanup())
    mv_refresh_task = asyncio.create_task(_periodic_mv_refresh())
    # 사용량 캐시 백그라운드 워밍업 (서버 시작 시 미리 로드)
    warmup_task = asyncio.create_task(get_usage_service().warmup())
    warmup_task.add_done_callback(
        lambda t: (
            logging.getLogger(__name__).error(
                "사용량 캐시 워밍업 실패: %s", t.exception()
            )
            if not t.cancelled() and t.exception()
            else None
        )
    )
    yield
    cleanup_task.cancel()
    mv_refresh_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    try:
        await mv_refresh_task
    except asyncio.CancelledError:
        pass
    await ws_mgr.stop_background_tasks()
    clear_pending()
    clear_all_pending_questions()
    await shutdown_dependencies()


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """도메인 예외 → {"detail": "..."} 응답."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """미처리 예외 → 안전한 500 응답 (스택 트레이스 미노출)."""
    logging.getLogger(__name__).error(
        "미처리 예외: %s %s - %s", request.method, request.url.path, exc, exc_info=True
    )
    return JSONResponse(
        status_code=500, content={"detail": "서버 내부 오류가 발생했습니다"}
    )


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(title="rocket-session API", lifespan=lifespan)

    # 글로벌 예외 핸들러
    application.add_exception_handler(AppError, _app_error_handler)
    application.add_exception_handler(Exception, _unhandled_error_handler)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix="/api")
    application.include_router(ws.router, tags=["websocket"])

    return application


app = create_app()
