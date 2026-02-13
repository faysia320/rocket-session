"""Claude Code Dashboard - FastAPI 앱 팩토리."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.dependencies import get_settings
from app.api.v1.api import api_router


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(title="Claude Code Dashboard API")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix="/api")

    return application


app = create_app()
