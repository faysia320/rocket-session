"""v1 API 라우터 통합."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    context,
    files,
    filesystem,
    health,
    insights,
    local_sessions,
    mcp,
    memo,
    memory,
    permissions,
    sessions,
    settings,
    tags,
    usage,
    workflow,
    workflow_definitions,
    workspaces,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(sessions.router)
api_router.include_router(files.router)
api_router.include_router(filesystem.router)
api_router.include_router(local_sessions.router)
api_router.include_router(permissions.router)
api_router.include_router(usage.router)
api_router.include_router(settings.router)
api_router.include_router(mcp.router)
api_router.include_router(memo.router)
api_router.include_router(tags.router)
api_router.include_router(analytics.router)
api_router.include_router(workflow.router)

api_router.include_router(workflow_definitions.router)
api_router.include_router(workspaces.router)
api_router.include_router(insights.router)
api_router.include_router(memory.router)
api_router.include_router(context.router)
