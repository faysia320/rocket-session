"""태그 CRUD REST 엔드포인트."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_tag_service
from app.schemas.common import StatusResponse
from app.schemas.tag import CreateTagRequest, TagInfo, UpdateTagRequest
from app.services.tag_service import TagService

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=list[TagInfo])
async def list_tags(
    service: TagService = Depends(get_tag_service),
):
    return await service.list_tags()


@router.post("/", response_model=TagInfo, status_code=201)
async def create_tag(
    req: CreateTagRequest,
    service: TagService = Depends(get_tag_service),
):
    return await service.create_tag(name=req.name, color=req.color)


@router.patch("/{tag_id}", response_model=TagInfo)
async def update_tag(
    tag_id: str,
    req: UpdateTagRequest,
    service: TagService = Depends(get_tag_service),
):
    return await service.update_tag(tag_id, name=req.name, color=req.color)


@router.delete("/{tag_id}", response_model=StatusResponse)
async def delete_tag(
    tag_id: str,
    service: TagService = Depends(get_tag_service),
):
    await service.delete_tag(tag_id)
    return StatusResponse(status="deleted")
