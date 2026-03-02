"""컨텍스트 자동 빌딩 API 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_context_builder_service
from app.schemas.context import (
    FileSuggestion,
    SessionContextSuggestion,
    SessionSummary,
)
from app.services.context_builder_service import ContextBuilderService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/workspaces/{workspace_id}/context",
    tags=["context"],
)

# prompt 파라미터 최대 길이 — 키워드 추출에 과도한 문자열 처리 방지
_MAX_PROMPT_LENGTH = 1000


@router.get("/suggest", response_model=SessionContextSuggestion)
async def suggest_context(
    workspace_id: str,
    prompt: str | None = Query(None, max_length=_MAX_PROMPT_LENGTH),
    svc: ContextBuilderService = Depends(get_context_builder_service),
):
    """워크스페이스 컨텍스트 종합 제안."""
    try:
        local_path = await svc.get_local_path(workspace_id)
        if not local_path:
            raise HTTPException(
                status_code=404,
                detail=f"워크스페이스를 찾을 수 없습니다: {workspace_id}",
            )
        result = await svc.build_full_context(workspace_id, prompt)
        return result
    except HTTPException:
        raise
    except Exception:
        logger.exception("컨텍스트 제안 실패 (workspace_id=%s)", workspace_id)
        raise HTTPException(status_code=500, detail="컨텍스트 제안 중 오류가 발생했습니다")


@router.get("/recent-sessions", response_model=list[SessionSummary])
async def recent_sessions(
    workspace_id: str,
    limit: int = Query(5, ge=1, le=20),
    svc: ContextBuilderService = Depends(get_context_builder_service),
):
    """최근 세션 요약."""
    try:
        return await svc.get_recent_sessions(workspace_id, limit)
    except Exception:
        logger.exception("최근 세션 조회 실패 (workspace_id=%s)", workspace_id)
        raise HTTPException(status_code=500, detail="최근 세션 조회 중 오류가 발생했습니다")


@router.get("/suggest-files", response_model=list[FileSuggestion])
async def suggest_files(
    workspace_id: str,
    prompt: str | None = Query(None, max_length=_MAX_PROMPT_LENGTH),
    limit: int = Query(10, ge=1, le=50),
    svc: ContextBuilderService = Depends(get_context_builder_service),
):
    """파일 제안."""
    try:
        return await svc.suggest_files(workspace_id, prompt, limit)
    except Exception:
        logger.exception("파일 제안 실패 (workspace_id=%s)", workspace_id)
        raise HTTPException(status_code=500, detail="파일 제안 중 오류가 발생했습니다")
