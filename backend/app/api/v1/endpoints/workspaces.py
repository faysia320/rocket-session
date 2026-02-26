"""워크스페이스 CRUD + 동기화 REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_workspace_service
from app.schemas.common import StatusResponse
from app.schemas.workspace import (
    CreateWorkspaceRequest,
    UpdateWorkspaceRequest,
    WorkspaceInfo,
    WorkspaceSyncRequest,
    WorkspaceSyncResponse,
)
from app.services.workspace_service import RebaseConflictError, WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("/", response_model=list[WorkspaceInfo])
async def list_workspaces(
    service: WorkspaceService = Depends(get_workspace_service),
):
    """전체 워크스페이스 목록."""
    return await service.list_all()


@router.post("/", response_model=WorkspaceInfo, status_code=201)
async def create_workspace(
    req: CreateWorkspaceRequest,
    service: WorkspaceService = Depends(get_workspace_service),
):
    """워크스페이스 생성 (비동기 clone 시작)."""
    return await service.create_workspace(
        repo_url=req.repo_url,
        branch=req.branch,
        name=req.name,
    )


@router.get("/{workspace_id}", response_model=WorkspaceInfo)
async def get_workspace(
    workspace_id: str,
    service: WorkspaceService = Depends(get_workspace_service),
):
    """워크스페이스 상세 조회 (Git 정보 포함)."""
    ws = await service.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="워크스페이스를 찾을 수 없습니다")
    return ws


@router.patch("/{workspace_id}", response_model=WorkspaceInfo)
async def update_workspace(
    workspace_id: str,
    req: UpdateWorkspaceRequest,
    service: WorkspaceService = Depends(get_workspace_service),
):
    """워크스페이스 속성 수정."""
    updates = req.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="변경할 항목이 없습니다")
    ws = await service.update(workspace_id, **updates)
    if not ws:
        raise HTTPException(status_code=404, detail="워크스페이스를 찾을 수 없습니다")
    return ws


@router.delete("/{workspace_id}", response_model=StatusResponse)
async def delete_workspace(
    workspace_id: str,
    service: WorkspaceService = Depends(get_workspace_service),
):
    """워크스페이스 삭제 (파일 + DB)."""
    deleted = await service.delete_workspace(workspace_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="워크스페이스를 찾을 수 없습니다")
    return StatusResponse(status="deleted")


@router.post("/{workspace_id}/sync", response_model=WorkspaceSyncResponse)
async def sync_workspace(
    workspace_id: str,
    req: WorkspaceSyncRequest,
    service: WorkspaceService = Depends(get_workspace_service),
):
    """워크스페이스 동기화 (pull 또는 push)."""
    try:
        success, message, commit_hash = await service.sync_workspace(
            workspace_id, req.action, force=req.force
        )
    except RebaseConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return WorkspaceSyncResponse(success=True, message=message, commit_hash=commit_hash)
