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


async def _run_background_tasks(shutdown_event: asyncio.Event) -> None:
    """TaskGroup으로 배경 태스크를 구조화 (structured concurrency).

    하나의 태스크가 예외로 종료되면 나머지도 자동 정리됩니다.
    shutdown_event가 set되면 모든 태스크를 종료합니다.
    """
    ws_mgr = get_ws_manager()
    await ws_mgr.start_background_tasks()

    async def _guarded_cleanup():
        """이벤트 정리 — shutdown 시그널 감시."""
        while not shutdown_event.is_set():
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=3600)
            except asyncio.TimeoutError:
                pass  # 1시간 경과 → 정리 실행
            else:
                break  # shutdown 시그널
            try:
                db = get_database()
                async with db.session() as session:
                    from app.repositories.event_repo import EventRepository
                    repo = EventRepository(session)
                    deleted = await repo.cleanup_old_events(24)
                    await session.commit()
                    if deleted:
                        logging.getLogger(__name__).info(
                            "오래된 이벤트 %d건 정리 완료", deleted
                        )
            except Exception as e:
                logging.getLogger(__name__).warning("주기적 이벤트 정리 실패: %s", e)

    async def _guarded_mv_refresh():
        """MV 갱신 — shutdown 시그널 감시."""
        while not shutdown_event.is_set():
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=300)
            except asyncio.TimeoutError:
                pass
            else:
                break
            try:
                db = get_database()
                async with db.session() as session:
                    from app.repositories.analytics_repo import AnalyticsRepository
                    await AnalyticsRepository.refresh_materialized_view(session)
            except Exception as e:
                logging.getLogger(__name__).warning("MV 갱신 실패: %s", e)

    async def _guarded_warmup():
        """사용량 캐시 워밍업 (1회성)."""
        try:
            await get_usage_service().warmup()
        except Exception as e:
            logging.getLogger(__name__).error("사용량 캐시 워밍업 실패: %s", e)

    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(_guarded_cleanup())
            tg.create_task(_guarded_mv_refresh())
            tg.create_task(_guarded_warmup())
            # shutdown 시그널 대기 후 TaskGroup 탈출
            tg.create_task(shutdown_event.wait())
    except* Exception as eg:
        for exc in eg.exceptions:
            logging.getLogger(__name__).error(
                "배경 태스크 비정상 종료: %s", exc, exc_info=exc,
            )
    finally:
        await ws_mgr.stop_background_tasks()


@asynccontextmanager
async def lifespan(application: FastAPI):
    """앱 라이프사이클: DB 초기화 및 정리."""
    await init_dependencies()

    shutdown_event = asyncio.Event()
    bg_task = asyncio.create_task(_run_background_tasks(shutdown_event))

    yield

    # shutdown 시그널 → TaskGroup 내 모든 태스크 종료
    shutdown_event.set()
    try:
        await asyncio.wait_for(bg_task, timeout=10)
    except asyncio.TimeoutError:
        bg_task.cancel()
        try:
            await bg_task
        except asyncio.CancelledError:
            pass

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
