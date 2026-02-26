"""v1 API 라우터 통합."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    files,
    filesystem,
    health,
    local_sessions,
    mcp,
    permissions,
    sessions,
    settings,
    tags,
    teams,
    usage,
    workflow,
    workflow_definitions,
    workflow_nodes,
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
api_router.include_router(tags.router)
api_router.include_router(teams.router)
api_router.include_router(analytics.router)
api_router.include_router(workflow.router)
api_router.include_router(workflow_nodes.router)
api_router.include_router(workflow_definitions.router)
api_router.include_router(workspaces.router)
