"""WorkspaceService 통합 테스트.

WorkspaceService의 public 메서드를 PostgreSQL DB를 사용하여 검증합니다:
- 워크스페이스 CRUD (list_all, get, update, delete_workspace)
- stale 워크스페이스 정리 (cleanup_stale)

GitService의 실제 git 명령은 mock 처리하고, DB 연동은 실제 PostgreSQL을 사용합니다.
"""

import os
import tempfile
from datetime import datetime, timezone

import pytest

from app.core.exceptions import NotFoundError
from app.models.workspace import Workspace
from app.repositories.workspace_repo import WorkspaceRepository


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _insert_workspace(
    db,
    *,
    wid: str = "ws-test-0001",
    name: str = "test-repo",
    repo_url: str = "https://github.com/test/repo.git",
    branch: str | None = "main",
    local_path: str = "/tmp/test-workspaces/test-repo",
    status: str = "ready",
    error_message: str | None = None,
) -> dict:
    """테스트용 워크스페이스를 DB에 직접 삽입한다."""
    now = datetime.now(timezone.utc)
    async with db.session() as session:
        repo = WorkspaceRepository(session)
        entity = Workspace(
            id=wid,
            name=name,
            repo_url=repo_url,
            branch=branch,
            local_path=local_path,
            status=status,
            error_message=error_message,
            created_at=now,
            updated_at=now,
        )
        await repo.add(entity)
        await session.commit()
    return {
        "id": wid,
        "name": name,
        "repo_url": repo_url,
        "branch": branch,
        "local_path": local_path,
        "status": status,
    }


# ---------------------------------------------------------------------------
# list_all 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestListAll:
    """list_all: 전체 워크스페이스 목록 조회."""

    async def test_list_all_empty(self, workspace_service):
        """워크스페이스가 없으면 빈 목록을 반환한다."""
        result = await workspace_service.list_all()
        assert result == []

    async def test_list_all_multiple(self, workspace_service, db):
        """여러 워크스페이스가 있으면 모두 반환한다."""
        await _insert_workspace(db, wid="ws-list-001", name="repo-a")
        await _insert_workspace(db, wid="ws-list-002", name="repo-b")
        await _insert_workspace(db, wid="ws-list-003", name="repo-c")

        result = await workspace_service.list_all()

        assert len(result) == 3
        names = {ws["name"] for ws in result}
        assert names == {"repo-a", "repo-b", "repo-c"}

    async def test_list_all_returns_dict_keys(self, workspace_service, db):
        """반환 dict에 필수 키가 포함된다."""
        await _insert_workspace(db, wid="ws-keys-001", name="keys-repo")

        result = await workspace_service.list_all()

        assert len(result) == 1
        ws = result[0]
        for key in ("id", "name", "repo_url", "branch", "local_path", "status"):
            assert key in ws


# ---------------------------------------------------------------------------
# get 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGet:
    """get: 워크스페이스 상세 조회."""

    async def test_get_existing_workspace(self, workspace_service, db):
        """존재하는 워크스페이스를 조회하면 dict를 반환한다."""
        await _insert_workspace(db, wid="ws-get-001", name="get-repo")

        result = await workspace_service.get("ws-get-001")

        assert result is not None
        assert result["id"] == "ws-get-001"
        assert result["name"] == "get-repo"
        assert result["status"] == "ready"

    async def test_get_nonexistent_raises(self, workspace_service):
        """존재하지 않는 워크스페이스 조회 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크스페이스를 찾을 수 없습니다"):
            await workspace_service.get("nonexistent-id")


# ---------------------------------------------------------------------------
# update 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestUpdate:
    """update: 워크스페이스 속성 업데이트."""

    async def test_update_name(self, workspace_service, db):
        """워크스페이스 이름을 변경한다."""
        await _insert_workspace(db, wid="ws-upd-001", name="old-name")

        result = await workspace_service.update("ws-upd-001", name="new-name")

        assert result is not None
        assert result["id"] == "ws-upd-001"
        assert result["name"] == "new-name"

    async def test_update_branch(self, workspace_service, db):
        """워크스페이스 branch를 변경한다."""
        await _insert_workspace(db, wid="ws-upd-002", name="branch-repo", branch="main")

        result = await workspace_service.update("ws-upd-002", branch="develop")

        assert result is not None
        assert result["branch"] == "develop"

    async def test_update_nonexistent_raises(self, workspace_service):
        """존재하지 않는 워크스페이스 수정 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크스페이스를 찾을 수 없습니다"):
            await workspace_service.update("nonexistent-id", name="x")


# ---------------------------------------------------------------------------
# delete_workspace 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestDeleteWorkspace:
    """delete_workspace: 워크스페이스 삭제 (파일 + DB)."""

    async def test_delete_existing_workspace(self, workspace_service, db):
        """존재하는 워크스페이스를 삭제하면 True를 반환한다."""
        await _insert_workspace(db, wid="ws-del-001", name="delete-repo")

        deleted = await workspace_service.delete_workspace("ws-del-001")
        assert deleted is True

        # 삭제 후 조회 시 NotFoundError
        with pytest.raises(NotFoundError):
            await workspace_service.get("ws-del-001")

    async def test_delete_nonexistent_raises(self, workspace_service):
        """존재하지 않는 워크스페이스 삭제 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크스페이스를 찾을 수 없습니다"):
            await workspace_service.delete_workspace("nonexistent-id")

    async def test_delete_removes_local_directory(self, workspace_service, db):
        """워크스페이스 삭제 시 로컬 디렉토리도 삭제된다."""
        tmp_dir = tempfile.mkdtemp(prefix="ws-del-dir-")
        await _insert_workspace(
            db, wid="ws-del-002", name="dir-repo", local_path=tmp_dir
        )
        assert os.path.isdir(tmp_dir)

        deleted = await workspace_service.delete_workspace("ws-del-002")
        assert deleted is True
        assert not os.path.isdir(tmp_dir)


# ---------------------------------------------------------------------------
# cleanup_stale 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCleanupStale:
    """cleanup_stale: 서버 재시작 시 stale 워크스페이스 정리."""

    async def test_cleanup_cloning_workspaces(self, workspace_service, db):
        """cloning 상태의 워크스페이스는 error 상태로 전환된다."""
        await _insert_workspace(
            db, wid="ws-stale-001", name="stale-clone", status="cloning"
        )

        await workspace_service.cleanup_stale()

        result = await workspace_service.get("ws-stale-001")
        assert result is not None
        assert result["status"] == "error"
        assert result["error_message"] == "서버 재시작으로 clone이 중단되었습니다"

    async def test_cleanup_deleting_workspaces(self, workspace_service, db):
        """deleting 상태의 워크스페이스는 DB에서 삭제된다."""
        await _insert_workspace(
            db,
            wid="ws-stale-002",
            name="stale-delete",
            status="deleting",
            local_path="/tmp/nonexistent-stale-path",
        )

        await workspace_service.cleanup_stale()

        with pytest.raises(NotFoundError):
            await workspace_service.get("ws-stale-002")

    async def test_cleanup_ready_workspaces_unaffected(self, workspace_service, db):
        """ready 상태의 워크스페이스는 cleanup에 영향받지 않는다."""
        await _insert_workspace(
            db, wid="ws-stale-003", name="ready-repo", status="ready"
        )

        await workspace_service.cleanup_stale()

        result = await workspace_service.get("ws-stale-003")
        assert result is not None
        assert result["status"] == "ready"

    async def test_cleanup_mixed_statuses(self, workspace_service, db):
        """여러 상태가 혼합된 경우 각각 올바르게 처리된다."""
        await _insert_workspace(db, wid="ws-mix-001", name="mix-ready", status="ready")
        await _insert_workspace(
            db, wid="ws-mix-002", name="mix-cloning", status="cloning"
        )
        await _insert_workspace(
            db,
            wid="ws-mix-003",
            name="mix-deleting",
            status="deleting",
            local_path="/tmp/nonexistent-mix-path",
        )

        await workspace_service.cleanup_stale()

        # ready → 그대로 유지
        ready = await workspace_service.get("ws-mix-001")
        assert ready is not None
        assert ready["status"] == "ready"

        # cloning → error
        cloning = await workspace_service.get("ws-mix-002")
        assert cloning is not None
        assert cloning["status"] == "error"

        # deleting → 삭제됨
        with pytest.raises(NotFoundError):
            await workspace_service.get("ws-mix-003")
