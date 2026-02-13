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

from app.api.dependencies import get_settings, init_dependencies, shutdown_dependencies
from app.api.v1.api import api_router
from app.api.v1.endpoints import ws
from app.api.v1.endpoints.permissions import clear_pending


@asynccontextmanager
async def lifespan(application: FastAPI):
    """앱 라이프사이클: DB 초기화 및 정리."""
    await init_dependencies()
    yield
    clear_pending()
    await shutdown_dependencies()


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(title="Claude Code Dashboard API", lifespan=lifespan)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix="/api")
    application.include_router(ws.router, tags=["websocket"])

    return application


app = create_app()
