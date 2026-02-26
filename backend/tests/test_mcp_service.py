"""McpService 통합 테스트.

McpService의 주요 public 메서드를 PostgreSQL DB를 사용하여 검증합니다:
- MCP 서버 CRUD (create, list, get, update, delete)
- MCP config 빌드 (build_mcp_config)
"""

import pytest

from app.core.exceptions import NotFoundError
from app.schemas.mcp import McpServerInfo


# ---------------------------------------------------------------------------
# MCP 서버 CRUD 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCreateServer:
    """create_server: MCP 서버 생성."""

    async def test_create_stdio_server(self, mcp_service):
        """stdio 타입 MCP 서버를 생성한다."""
        server = await mcp_service.create_server(
            name="my-stdio-server",
            transport_type="stdio",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem"],
        )

        assert isinstance(server, McpServerInfo)
        assert server.id is not None
        assert len(server.id) == 16
        assert server.name == "my-stdio-server"
        assert server.transport_type == "stdio"
        assert server.command == "npx"
        assert server.args == ["-y", "@modelcontextprotocol/server-filesystem"]
        assert server.url is None
        assert server.headers is None
        assert server.enabled is True
        assert server.source == "manual"
        assert server.created_at is not None
        assert server.updated_at is not None

    async def test_create_sse_server(self, mcp_service):
        """sse 타입 MCP 서버를 생성한다."""
        server = await mcp_service.create_server(
            name="my-sse-server",
            transport_type="sse",
            url="http://localhost:3000/sse",
            headers={"Authorization": "Bearer token123"},
        )

        assert server.name == "my-sse-server"
        assert server.transport_type == "sse"
        assert server.command is None
        assert server.args is None
        assert server.url == "http://localhost:3000/sse"
        assert server.headers == {"Authorization": "Bearer token123"}

    async def test_create_server_with_env(self, mcp_service):
        """환경 변수가 포함된 MCP 서버를 생성한다."""
        server = await mcp_service.create_server(
            name="env-server",
            transport_type="stdio",
            command="python",
            args=["server.py"],
            env={"API_KEY": "secret123", "DEBUG": "true"},
        )

        assert server.env == {"API_KEY": "secret123", "DEBUG": "true"}

    async def test_create_server_disabled(self, mcp_service):
        """비활성화 상태로 서버를 생성한다."""
        server = await mcp_service.create_server(
            name="disabled-server",
            transport_type="stdio",
            command="echo",
            enabled=False,
        )

        assert server.enabled is False

    async def test_create_server_with_source(self, mcp_service):
        """source를 지정하여 서버를 생성한다."""
        server = await mcp_service.create_server(
            name="system-server",
            transport_type="stdio",
            command="npx",
            source="system",
        )

        assert server.source == "system"


@pytest.mark.asyncio
class TestListServers:
    """list_servers: 전체 MCP 서버 목록 조회."""

    async def test_list_servers_empty(self, mcp_service):
        """서버가 없으면 빈 목록을 반환한다."""
        servers = await mcp_service.list_servers()
        assert servers == []

    async def test_list_servers_multiple(self, mcp_service):
        """여러 서버가 있으면 모두 반환한다."""
        await mcp_service.create_server(
            name="server-a", transport_type="stdio", command="cmd-a"
        )
        await mcp_service.create_server(
            name="server-b", transport_type="sse", url="http://b.com/sse"
        )
        await mcp_service.create_server(
            name="server-c", transport_type="stdio", command="cmd-c"
        )

        servers = await mcp_service.list_servers()

        assert len(servers) == 3
        names = {s.name for s in servers}
        assert names == {"server-a", "server-b", "server-c"}


@pytest.mark.asyncio
class TestGetServer:
    """get_server: 개별 MCP 서버 조회."""

    async def test_get_existing_server(self, mcp_service):
        """존재하는 서버를 조회하면 McpServerInfo를 반환한다."""
        created = await mcp_service.create_server(
            name="get-test", transport_type="stdio", command="echo"
        )

        server = await mcp_service.get_server(created.id)

        assert server is not None
        assert isinstance(server, McpServerInfo)
        assert server.id == created.id
        assert server.name == "get-test"
        assert server.transport_type == "stdio"
        assert server.command == "echo"

    async def test_get_nonexistent_server_returns_none(self, mcp_service):
        """존재하지 않는 서버 조회 시 None을 반환한다."""
        server = await mcp_service.get_server("nonexistent-id")
        assert server is None


@pytest.mark.asyncio
class TestUpdateServer:
    """update_server: MCP 서버 수정."""

    async def test_update_server_name(self, mcp_service):
        """서버 이름을 변경한다."""
        created = await mcp_service.create_server(
            name="old-server", transport_type="stdio", command="echo"
        )

        updated = await mcp_service.update_server(created.id, name="new-server")

        assert updated is not None
        assert updated.id == created.id
        assert updated.name == "new-server"
        assert updated.command == "echo"  # 기존 값 유지

    async def test_update_server_enable_disable(self, mcp_service):
        """서버의 enabled 상태를 토글한다."""
        created = await mcp_service.create_server(
            name="toggle-server", transport_type="stdio", command="echo", enabled=True
        )
        assert created.enabled is True

        disabled = await mcp_service.update_server(created.id, enabled=False)
        assert disabled is not None
        assert disabled.enabled is False

        enabled = await mcp_service.update_server(created.id, enabled=True)
        assert enabled is not None
        assert enabled.enabled is True

    async def test_update_server_transport_and_url(self, mcp_service):
        """서버의 transport_type과 url을 변경한다."""
        created = await mcp_service.create_server(
            name="transport-update", transport_type="stdio", command="echo"
        )

        updated = await mcp_service.update_server(
            created.id,
            transport_type="sse",
            url="http://localhost:8080/sse",
        )

        assert updated is not None
        assert updated.transport_type == "sse"
        assert updated.url == "http://localhost:8080/sse"

    async def test_update_server_env(self, mcp_service):
        """서버의 환경 변수를 변경한다."""
        created = await mcp_service.create_server(
            name="env-update", transport_type="stdio", command="echo"
        )

        updated = await mcp_service.update_server(
            created.id, env={"NEW_VAR": "new_value"}
        )

        assert updated is not None
        assert updated.env == {"NEW_VAR": "new_value"}

    async def test_update_nonexistent_server_raises(self, mcp_service):
        """존재하지 않는 서버 수정 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="MCP 서버를 찾을 수 없습니다"):
            await mcp_service.update_server("nonexistent-id", name="x")


@pytest.mark.asyncio
class TestDeleteServer:
    """delete_server: MCP 서버 삭제."""

    async def test_delete_existing_server(self, mcp_service):
        """존재하는 서버를 삭제하면 True를 반환한다."""
        created = await mcp_service.create_server(
            name="delete-me", transport_type="stdio", command="echo"
        )

        deleted = await mcp_service.delete_server(created.id)
        assert deleted is True

        # 삭제 후 조회 시 None
        server = await mcp_service.get_server(created.id)
        assert server is None

    async def test_delete_nonexistent_server_raises(self, mcp_service):
        """존재하지 않는 서버 삭제 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="MCP 서버를 찾을 수 없습니다"):
            await mcp_service.delete_server("nonexistent-id")


# ---------------------------------------------------------------------------
# MCP Config 빌드 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestBuildMcpConfig:
    """build_mcp_config: MCP 설정 dict 빌드."""

    async def test_build_config_stdio_server(self, mcp_service):
        """stdio 서버의 config를 빌드하면 command/args가 포함된다."""
        server = await mcp_service.create_server(
            name="stdio-config",
            transport_type="stdio",
            command="npx",
            args=["-y", "server-pkg"],
            env={"TOKEN": "abc"},
        )

        config = await mcp_service.build_mcp_config([server.id])

        assert "mcpServers" in config
        assert "stdio-config" in config["mcpServers"]

        entry = config["mcpServers"]["stdio-config"]
        assert entry["command"] == "npx"
        assert entry["args"] == ["-y", "server-pkg"]
        assert entry["env"] == {"TOKEN": "abc"}
        # stdio 타입은 url/type 키가 없어야 함
        assert "url" not in entry
        assert "type" not in entry

    async def test_build_config_sse_server(self, mcp_service):
        """sse 서버의 config를 빌드하면 url/type/headers가 포함된다."""
        # 외부 호스트 URL을 사용 (Docker 환경에서 localhost가 host.docker.internal로 변환됨)
        server = await mcp_service.create_server(
            name="sse-config",
            transport_type="sse",
            url="http://my-mcp-host:3000/sse",
            headers={"Authorization": "Bearer tok"},
        )

        config = await mcp_service.build_mcp_config([server.id])

        assert "sse-config" in config["mcpServers"]

        entry = config["mcpServers"]["sse-config"]
        assert entry["url"] == "http://my-mcp-host:3000/sse"
        assert entry["type"] == "sse"
        assert entry["headers"] == {"Authorization": "Bearer tok"}
        # sse 타입은 command/args 키가 없어야 함
        assert "command" not in entry
        assert "args" not in entry

    async def test_build_config_empty_server_ids(self, mcp_service):
        """빈 server_ids를 전달하면 빈 mcpServers를 반환한다."""
        config = await mcp_service.build_mcp_config([])

        assert config == {"mcpServers": {}}

    async def test_build_config_skips_disabled_servers(self, mcp_service):
        """비활성화된 서버는 config에 포함되지 않는다."""
        enabled = await mcp_service.create_server(
            name="enabled-srv",
            transport_type="stdio",
            command="echo",
            enabled=True,
        )
        disabled = await mcp_service.create_server(
            name="disabled-srv",
            transport_type="stdio",
            command="echo",
            enabled=False,
        )

        config = await mcp_service.build_mcp_config([enabled.id, disabled.id])

        assert "enabled-srv" in config["mcpServers"]
        assert "disabled-srv" not in config["mcpServers"]

    async def test_build_config_multiple_servers(self, mcp_service):
        """여러 서버를 포함하는 config를 빌드한다."""
        s1 = await mcp_service.create_server(
            name="multi-1", transport_type="stdio", command="cmd1"
        )
        s2 = await mcp_service.create_server(
            name="multi-2", transport_type="sse", url="http://srv2/sse"
        )

        config = await mcp_service.build_mcp_config([s1.id, s2.id])

        assert len(config["mcpServers"]) == 2
        assert "multi-1" in config["mcpServers"]
        assert "multi-2" in config["mcpServers"]

    async def test_build_config_with_permission_mcp_dict(self, mcp_service):
        """permission_mcp_dict가 전달되면 config에 병합된다."""
        server = await mcp_service.create_server(
            name="perm-test", transport_type="stdio", command="echo"
        )
        permission_mcp = {
            "permission": {"command": "perm-tool", "args": ["--check"]}
        }

        config = await mcp_service.build_mcp_config(
            [server.id], permission_mcp_dict=permission_mcp
        )

        assert "perm-test" in config["mcpServers"]
        assert "permission" in config["mcpServers"]
        assert config["mcpServers"]["permission"]["command"] == "perm-tool"

    async def test_build_config_permission_mcp_only(self, mcp_service):
        """server_ids가 비어있어도 permission_mcp_dict는 포함된다."""
        permission_mcp = {
            "permission": {"command": "perm-tool"}
        }

        config = await mcp_service.build_mcp_config(
            [], permission_mcp_dict=permission_mcp
        )

        assert "permission" in config["mcpServers"]
        assert config["mcpServers"]["permission"]["command"] == "perm-tool"
