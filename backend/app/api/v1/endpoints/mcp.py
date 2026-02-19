"""MCP 서버 관리 REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_mcp_service
from app.schemas.mcp import (
    CreateMcpServerRequest,
    ImportSystemRequest,
    McpServerInfo,
    SystemMcpServer,
    UpdateMcpServerRequest,
)
from app.services.mcp_service import McpService

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/", response_model=list[McpServerInfo])
async def list_mcp_servers(
    service: McpService = Depends(get_mcp_service),
):
    return await service.list_servers()


@router.post("/", response_model=McpServerInfo, status_code=201)
async def create_mcp_server(
    req: CreateMcpServerRequest,
    service: McpService = Depends(get_mcp_service),
):
    return await service.create_server(
        name=req.name,
        transport_type=req.transport_type,
        command=req.command,
        args=req.args,
        url=req.url,
        headers=req.headers,
        env=req.env,
        enabled=req.enabled,
    )


@router.get("/system-servers", response_model=list[SystemMcpServer])
async def get_system_mcp_servers(
    service: McpService = Depends(get_mcp_service),
):
    return await service.read_system_servers()


@router.post("/import-system", response_model=list[McpServerInfo])
async def import_system_mcp_servers(
    req: ImportSystemRequest,
    service: McpService = Depends(get_mcp_service),
):
    return await service.import_from_system(names=req.names)


@router.get("/{server_id}", response_model=McpServerInfo)
async def get_mcp_server(
    server_id: str,
    service: McpService = Depends(get_mcp_service),
):
    server = await service.get_server(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP 서버를 찾을 수 없습니다")
    return server


@router.patch("/{server_id}", response_model=McpServerInfo)
async def update_mcp_server(
    server_id: str,
    req: UpdateMcpServerRequest,
    service: McpService = Depends(get_mcp_service),
):
    updated = await service.update_server(
        server_id=server_id,
        name=req.name,
        transport_type=req.transport_type,
        command=req.command,
        args=req.args,
        url=req.url,
        headers=req.headers,
        env=req.env,
        enabled=req.enabled,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="MCP 서버를 찾을 수 없습니다")
    return updated


@router.delete("/{server_id}")
async def delete_mcp_server(
    server_id: str,
    service: McpService = Depends(get_mcp_service),
):
    deleted = await service.delete_server(server_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="MCP 서버를 찾을 수 없습니다")
    return {"status": "deleted"}
