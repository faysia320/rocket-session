"""워크플로우 정의 관리 REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_workflow_definition_service
from app.schemas.workflow_definition import (
    CreateWorkflowDefinitionRequest,
    UpdateWorkflowDefinitionRequest,
    WorkflowDefinitionExport,
    WorkflowDefinitionInfo,
)
from app.services.workflow_definition_service import WorkflowDefinitionService

router = APIRouter(prefix="/workflow-definitions", tags=["workflow-definitions"])


@router.get("/", response_model=list[WorkflowDefinitionInfo])
async def list_definitions(
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    return await service.list_definitions()


@router.post("/", response_model=WorkflowDefinitionInfo, status_code=201)
async def create_definition(
    req: CreateWorkflowDefinitionRequest,
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    return await service.create_definition(
        name=req.name,
        steps=req.steps,
        description=req.description,
    )


@router.post("/import", response_model=WorkflowDefinitionInfo, status_code=201)
async def import_definition(
    data: WorkflowDefinitionExport,
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    if data.version != 1:
        raise HTTPException(status_code=400, detail="지원하지 않는 버전입니다")
    return await service.import_definition(data.definition)


@router.get("/{def_id}", response_model=WorkflowDefinitionInfo)
async def get_definition(
    def_id: str,
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    result = await service.get_definition(def_id)
    if not result:
        raise HTTPException(
            status_code=404, detail="워크플로우 정의를 찾을 수 없습니다"
        )
    return result


@router.patch("/{def_id}", response_model=WorkflowDefinitionInfo)
async def update_definition(
    def_id: str,
    req: UpdateWorkflowDefinitionRequest,
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    try:
        updated = await service.update_definition(
            def_id=def_id,
            name=req.name,
            description=req.description,
            steps=req.steps,
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not updated:
        raise HTTPException(
            status_code=404, detail="워크플로우 정의를 찾을 수 없습니다"
        )
    return updated


@router.delete("/{def_id}")
async def delete_definition(
    def_id: str,
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    try:
        deleted = await service.delete_definition(def_id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not deleted:
        raise HTTPException(
            status_code=404, detail="워크플로우 정의를 찾을 수 없습니다"
        )
    return {"status": "deleted"}


@router.post("/{def_id}/set-default", response_model=WorkflowDefinitionInfo)
async def set_default_definition(
    def_id: str,
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    result = await service.set_default(def_id)
    if not result:
        raise HTTPException(
            status_code=404, detail="워크플로우 정의를 찾을 수 없습니다"
        )
    return result


@router.get("/{def_id}/export", response_model=WorkflowDefinitionExport)
async def export_definition(
    def_id: str,
    service: WorkflowDefinitionService = Depends(get_workflow_definition_service),
):
    result = await service.export_definition(def_id)
    if not result:
        raise HTTPException(
            status_code=404, detail="워크플로우 정의를 찾을 수 없습니다"
        )
    return result
