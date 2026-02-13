"""v1 API 라우터 통합."""

from fastapi import APIRouter

from app.api.v1.endpoints import files, filesystem, health, local_sessions, permissions, sessions, usage

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(sessions.router)
api_router.include_router(files.router)
api_router.include_router(filesystem.router)
api_router.include_router(local_sessions.router)
api_router.include_router(permissions.router)
api_router.include_router(usage.router)
