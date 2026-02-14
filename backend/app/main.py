"""Claude Code Dashboard - FastAPI 앱 팩토리."""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Windows에서 asyncio subprocess 지원을 위해 ProactorEventLoop 사용
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

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
from app.api.v1.endpoints.permissions import clear_pending  # noqa: E402


async def _periodic_cleanup():
    """1시간마다 오래된 이벤트 정리."""
    while True:
        await asyncio.sleep(3600)
        try:
            db = get_database()
            await db.cleanup_old_events(24)
        except Exception as e:
            logging.getLogger(__name__).warning("주기적 이벤트 정리 실패: %s", e)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """앱 라이프사이클: DB 초기화 및 정리."""
    await init_dependencies()
    ws_mgr = get_ws_manager()
    await ws_mgr.start_background_tasks()
    cleanup_task = asyncio.create_task(_periodic_cleanup())
    # 사용량 캐시 백그라운드 워밍업 (서버 시작 시 미리 로드)
    asyncio.create_task(get_usage_service().warmup())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    await ws_mgr.stop_background_tasks()
    clear_pending()
    await shutdown_dependencies()


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(title="Claude Code Dashboard API", lifespan=lifespan)

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
