"""워크스페이스 인사이트 REST 엔드포인트."""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_insight_service
from app.core.exceptions import NotFoundError
from app.schemas.common import StatusResponse
from app.schemas.workspace_insight import (
    ArchiveInsightsRequest,
    CreateInsightRequest,
    ExtractInsightsRequest,
    InsightContextResponse,
    UpdateInsightRequest,
    WorkspaceInsightInfo,
)
from app.services.insight_service import InsightService

router = APIRouter(prefix="/workspaces/{workspace_id}/insights", tags=["insights"])


@router.get("/", response_model=list[WorkspaceInsightInfo])
async def list_insights(
    workspace_id: str,
    category: str | None = Query(None),
    include_archived: bool = Query(False),
    service: InsightService = Depends(get_insight_service),
):
    """워크스페이스별 인사이트 조회."""
    return await service.list_insights(
        workspace_id, category=category, include_archived=include_archived
    )


@router.post("/", response_model=WorkspaceInsightInfo, status_code=201)
async def create_insight(
    workspace_id: str,
    req: CreateInsightRequest,
    service: InsightService = Depends(get_insight_service),
):
    """인사이트 수동 생성."""
    return await service.create_insight(workspace_id, req)


@router.put("/{insight_id}", response_model=WorkspaceInsightInfo)
async def update_insight(
    insight_id: int,
    req: UpdateInsightRequest,
    service: InsightService = Depends(get_insight_service),
):
    """인사이트 수정."""
    result = await service.update_insight(insight_id, req)
    if not result:
        raise NotFoundError("인사이트를 찾을 수 없습니다")
    return result


@router.delete("/{insight_id}", response_model=StatusResponse)
async def delete_insight(
    insight_id: int,
    service: InsightService = Depends(get_insight_service),
):
    """인사이트 삭제."""
    deleted = await service.delete_insight(insight_id)
    if not deleted:
        raise NotFoundError("인사이트를 찾을 수 없습니다")
    return StatusResponse(status="ok")


@router.post("/extract", response_model=list[WorkspaceInsightInfo])
async def extract_insights(
    workspace_id: str,
    req: ExtractInsightsRequest,
    service: InsightService = Depends(get_insight_service),
):
    """세션에서 인사이트 자동 추출."""
    return await service.extract_from_session(req.session_id)


@router.get("/context", response_model=InsightContextResponse)
async def get_insight_context(
    workspace_id: str,
    prompt: str = Query(""),
    limit: int = Query(5, ge=1, le=20),
    service: InsightService = Depends(get_insight_service),
):
    """프롬프트 기반 관련 인사이트 컨텍스트 조회."""
    return await service.build_context_for_session(
        workspace_id, prompt=prompt, limit=limit
    )


@router.post("/archive", response_model=StatusResponse)
async def archive_insights(
    req: ArchiveInsightsRequest,
    service: InsightService = Depends(get_insight_service),
):
    """인사이트 다건 아카이브."""
    await service.archive_insights(req.ids)
    return StatusResponse(status="ok")
