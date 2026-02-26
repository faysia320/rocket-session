"""워크플로우 노드 관리 REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_workflow_node_service
from app.schemas.workflow_node import (
    CreateWorkflowNodeRequest,
    UpdateWorkflowNodeRequest,
    WorkflowNodeInfo,
)
from app.services.workflow_node_service import WorkflowNodeService

router = APIRouter(prefix="/workflow-nodes", tags=["workflow-nodes"])


@router.get("/", response_model=list[WorkflowNodeInfo])
async def list_nodes(
    service: WorkflowNodeService = Depends(get_workflow_node_service),
):
    return await service.list_nodes()


@router.post("/", response_model=WorkflowNodeInfo, status_code=201)
async def create_node(
    req: CreateWorkflowNodeRequest,
    service: WorkflowNodeService = Depends(get_workflow_node_service),
):
    return await service.create_node(
        name=req.name,
        label=req.label,
        icon=req.icon,
        prompt_template=req.prompt_template,
        constraints=req.constraints,
    )


@router.get("/{node_id}", response_model=WorkflowNodeInfo)
async def get_node(
    node_id: str,
    service: WorkflowNodeService = Depends(get_workflow_node_service),
):
    result = await service.get_node(node_id)
    if not result:
        raise HTTPException(status_code=404, detail="워크플로우 노드를 찾을 수 없습니다")
    return result


@router.patch("/{node_id}", response_model=WorkflowNodeInfo)
async def update_node(
    node_id: str,
    req: UpdateWorkflowNodeRequest,
    service: WorkflowNodeService = Depends(get_workflow_node_service),
):
    update_data = req.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="변경할 필드가 없습니다")
    updated = await service.update_node(node_id, **update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="워크플로우 노드를 찾을 수 없습니다")
    return updated


@router.delete("/{node_id}")
async def delete_node(
    node_id: str,
    service: WorkflowNodeService = Depends(get_workflow_node_service),
):
    deleted = await service.delete_node(node_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="워크플로우 노드를 찾을 수 없습니다")
    return {"status": "deleted"}
