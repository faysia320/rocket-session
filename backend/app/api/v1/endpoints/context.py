"""컨텍스트 자동 빌딩 API 엔드포인트."""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_context_builder_service
from app.schemas.context import (
    FileSuggestion,
    SessionContextSuggestion,
    SessionSummary,
)
from app.services.context_builder_service import ContextBuilderService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/context",
    tags=["context"],
)


@router.get("/suggest", response_model=SessionContextSuggestion)
async def suggest_context(
    workspace_id: str,
    prompt: str | None = Query(None),
    svc: ContextBuilderService = Depends(get_context_builder_service),
):
    """워크스페이스 컨텍스트 종합 제안."""
    result = await svc.build_full_context(workspace_id, prompt)
    return result


@router.get("/recent-sessions", response_model=list[SessionSummary])
async def recent_sessions(
    workspace_id: str,
    limit: int = Query(5, ge=1, le=20),
    svc: ContextBuilderService = Depends(get_context_builder_service),
):
    """최근 세션 요약."""
    return await svc.get_recent_sessions(workspace_id, limit)


@router.get("/suggest-files", response_model=list[FileSuggestion])
async def suggest_files(
    workspace_id: str,
    prompt: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    svc: ContextBuilderService = Depends(get_context_builder_service),
):
    """파일 제안."""
    return await svc.suggest_files(workspace_id, prompt, limit)
