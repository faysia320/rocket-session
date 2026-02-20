"""세션 템플릿 관리 REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_template_service
from app.schemas.template import (
    CreateTemplateFromSessionRequest,
    CreateTemplateRequest,
    TemplateExport,
    TemplateInfo,
    UpdateTemplateRequest,
)
from app.services.template_service import TemplateService

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=list[TemplateInfo])
async def list_templates(
    service: TemplateService = Depends(get_template_service),
):
    return await service.list_templates()


@router.post("/", response_model=TemplateInfo, status_code=201)
async def create_template(
    req: CreateTemplateRequest,
    service: TemplateService = Depends(get_template_service),
):
    return await service.create_template(
        name=req.name,
        description=req.description,
        work_dir=req.work_dir,
        system_prompt=req.system_prompt,
        allowed_tools=req.allowed_tools,
        disallowed_tools=req.disallowed_tools,
        timeout_seconds=req.timeout_seconds,
        mode=req.mode,
        permission_mode=req.permission_mode,
        permission_required_tools=req.permission_required_tools,
        model=req.model,
        max_turns=req.max_turns,
        max_budget_usd=req.max_budget_usd,
        system_prompt_mode=req.system_prompt_mode,
        mcp_server_ids=req.mcp_server_ids,
    )


@router.post("/import", response_model=TemplateInfo, status_code=201)
async def import_template(
    data: TemplateExport,
    service: TemplateService = Depends(get_template_service),
):
    if data.version != 1:
        raise HTTPException(
            status_code=400, detail="지원하지 않는 템플릿 버전입니다"
        )
    return await service.import_template(data.template)


@router.post(
    "/from-session/{session_id}",
    response_model=TemplateInfo,
    status_code=201,
)
async def create_template_from_session(
    session_id: str,
    req: CreateTemplateFromSessionRequest,
    service: TemplateService = Depends(get_template_service),
):
    result = await service.create_from_session(
        session_id=session_id,
        name=req.name,
        description=req.description,
    )
    if not result:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return result


@router.get("/{template_id}", response_model=TemplateInfo)
async def get_template(
    template_id: str,
    service: TemplateService = Depends(get_template_service),
):
    template = await service.get_template(template_id)
    if not template:
        raise HTTPException(
            status_code=404, detail="템플릿을 찾을 수 없습니다"
        )
    return template


@router.patch("/{template_id}", response_model=TemplateInfo)
async def update_template(
    template_id: str,
    req: UpdateTemplateRequest,
    service: TemplateService = Depends(get_template_service),
):
    updated = await service.update_template(
        template_id=template_id,
        name=req.name,
        description=req.description,
        work_dir=req.work_dir,
        system_prompt=req.system_prompt,
        allowed_tools=req.allowed_tools,
        disallowed_tools=req.disallowed_tools,
        timeout_seconds=req.timeout_seconds,
        mode=req.mode,
        permission_mode=req.permission_mode,
        permission_required_tools=req.permission_required_tools,
        model=req.model,
        max_turns=req.max_turns,
        max_budget_usd=req.max_budget_usd,
        system_prompt_mode=req.system_prompt_mode,
        mcp_server_ids=req.mcp_server_ids,
    )
    if not updated:
        raise HTTPException(
            status_code=404, detail="템플릿을 찾을 수 없습니다"
        )
    return updated


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    service: TemplateService = Depends(get_template_service),
):
    deleted = await service.delete_template(template_id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail="템플릿을 찾을 수 없습니다"
        )
    return {"status": "deleted"}


@router.get("/{template_id}/export", response_model=TemplateExport)
async def export_template(
    template_id: str,
    service: TemplateService = Depends(get_template_service),
):
    result = await service.export_template(template_id)
    if not result:
        raise HTTPException(
            status_code=404, detail="템플릿을 찾을 수 없습니다"
        )
    return result
