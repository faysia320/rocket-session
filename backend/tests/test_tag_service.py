"""TagService 통합 테스트.

TagService의 모든 public 메서드를 PostgreSQL DB를 사용하여 검증합니다:
- 태그 CRUD (create, list, get, update, delete)
- 세션-태그 연결 관리 (add_tags_to_session, remove_tag_from_session)
- 세션 태그 조회 (get_session_tags, get_tags_for_sessions)
"""

import tempfile

import pytest

from app.core.exceptions import ConflictError, NotFoundError
from app.schemas.tag import TagInfo


# ---------------------------------------------------------------------------
# 태그 CRUD 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCreateTag:
    """create_tag: 태그 생성."""

    async def test_create_tag_default_color(self, tag_service):
        """이름만 지정하면 기본 색상(#6366f1)으로 태그가 생성된다."""
        tag = await tag_service.create_tag("backend")

        assert isinstance(tag, TagInfo)
        assert tag.id is not None
        assert len(tag.id) == 16
        assert tag.name == "backend"
        assert tag.color == "#6366f1"

    async def test_create_tag_custom_color(self, tag_service):
        """색상을 지정하면 해당 색상으로 태그가 생성된다."""
        tag = await tag_service.create_tag("frontend", color="#ff5733")

        assert tag.name == "frontend"
        assert tag.color == "#ff5733"

    async def test_create_tag_duplicate_name_raises_conflict(self, tag_service):
        """이미 존재하는 이름으로 태그 생성 시 ConflictError가 발생한다."""
        await tag_service.create_tag("duplicate-tag")

        with pytest.raises(ConflictError, match="이미 존재하는 태그 이름입니다"):
            await tag_service.create_tag("duplicate-tag")


@pytest.mark.asyncio
class TestListTags:
    """list_tags: 전체 태그 목록 조회."""

    async def test_list_tags_empty(self, tag_service):
        """태그가 없으면 빈 목록을 반환한다."""
        tags = await tag_service.list_tags()
        assert tags == []

    async def test_list_tags_multiple(self, tag_service):
        """여러 태그가 있으면 모두 반환한다."""
        await tag_service.create_tag("tag-a")
        await tag_service.create_tag("tag-b")
        await tag_service.create_tag("tag-c")

        tags = await tag_service.list_tags()
        assert len(tags) == 3
        names = {t.name for t in tags}
        assert names == {"tag-a", "tag-b", "tag-c"}


@pytest.mark.asyncio
class TestGetTag:
    """get_tag: 개별 태그 조회."""

    async def test_get_existing_tag(self, tag_service):
        """존재하는 태그를 조회하면 TagInfo를 반환한다."""
        created = await tag_service.create_tag("get-test")

        tag = await tag_service.get_tag(created.id)
        assert tag is not None
        assert tag.id == created.id
        assert tag.name == "get-test"
        assert tag.color == "#6366f1"

    async def test_get_nonexistent_tag_returns_none(self, tag_service):
        """존재하지 않는 태그 조회 시 None을 반환한다."""
        tag = await tag_service.get_tag("nonexistent-id")
        assert tag is None


@pytest.mark.asyncio
class TestUpdateTag:
    """update_tag: 태그 수정."""

    async def test_update_tag_name(self, tag_service):
        """태그 이름을 변경한다."""
        created = await tag_service.create_tag("old-name")

        updated = await tag_service.update_tag(created.id, name="new-name")

        assert updated is not None
        assert updated.id == created.id
        assert updated.name == "new-name"
        assert updated.color == "#6366f1"  # 색상은 변경되지 않음

    async def test_update_tag_color(self, tag_service):
        """태그 색상을 변경한다."""
        created = await tag_service.create_tag("color-test")

        updated = await tag_service.update_tag(created.id, color="#00ff00")

        assert updated is not None
        assert updated.name == "color-test"  # 이름은 변경되지 않음
        assert updated.color == "#00ff00"

    async def test_update_tag_name_and_color(self, tag_service):
        """태그 이름과 색상을 동시에 변경한다."""
        created = await tag_service.create_tag("both-test")

        updated = await tag_service.update_tag(
            created.id, name="both-updated", color="#abcdef"
        )

        assert updated is not None
        assert updated.name == "both-updated"
        assert updated.color == "#abcdef"

    async def test_update_nonexistent_tag_raises(self, tag_service):
        """존재하지 않는 태그 수정 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="태그를 찾을 수 없습니다"):
            await tag_service.update_tag("nonexistent-id", name="x")


@pytest.mark.asyncio
class TestDeleteTag:
    """delete_tag: 태그 삭제."""

    async def test_delete_existing_tag(self, tag_service):
        """존재하는 태그를 삭제하면 True를 반환한다."""
        created = await tag_service.create_tag("delete-me")

        deleted = await tag_service.delete_tag(created.id)
        assert deleted is True

        # 삭제 후 조회 시 None
        tag = await tag_service.get_tag(created.id)
        assert tag is None

    async def test_delete_nonexistent_tag_raises(self, tag_service):
        """존재하지 않는 태그 삭제 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="태그를 찾을 수 없습니다"):
            await tag_service.delete_tag("nonexistent-id")


# ---------------------------------------------------------------------------
# 세션-태그 연결 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestAddTagsToSession:
    """add_tags_to_session: 세션에 태그 연결."""

    async def test_add_single_tag_to_session(self, tag_service, test_session):
        """세션에 태그 1개를 연결한다."""
        tag = await tag_service.create_tag("session-tag-1")

        result = await tag_service.add_tags_to_session(test_session["id"], [tag.id])

        assert len(result) == 1
        assert result[0].id == tag.id
        assert result[0].name == "session-tag-1"

    async def test_add_multiple_tags_to_session(self, tag_service, test_session):
        """세션에 여러 태그를 한 번에 연결한다."""
        tag_a = await tag_service.create_tag("multi-a")
        tag_b = await tag_service.create_tag("multi-b")
        tag_c = await tag_service.create_tag("multi-c")

        result = await tag_service.add_tags_to_session(
            test_session["id"], [tag_a.id, tag_b.id, tag_c.id]
        )

        assert len(result) == 3
        result_ids = {t.id for t in result}
        assert tag_a.id in result_ids
        assert tag_b.id in result_ids
        assert tag_c.id in result_ids


@pytest.mark.asyncio
class TestRemoveTagFromSession:
    """remove_tag_from_session: 세션에서 태그 제거."""

    async def test_remove_tag_from_session(self, tag_service, test_session):
        """세션에서 태그를 제거하면 True를 반환한다."""
        tag = await tag_service.create_tag("remove-tag")
        await tag_service.add_tags_to_session(test_session["id"], [tag.id])

        removed = await tag_service.remove_tag_from_session(test_session["id"], tag.id)
        assert removed is True

        # 제거 후 세션 태그가 비어 있는지 확인
        tags = await tag_service.get_session_tags(test_session["id"])
        tag_ids = {t.id for t in tags}
        assert tag.id not in tag_ids

    async def test_remove_nonexistent_tag_from_session(self, tag_service, test_session):
        """연결되지 않은 태그를 제거하면 False를 반환한다."""
        removed = await tag_service.remove_tag_from_session(
            test_session["id"], "nonexistent-tag-id"
        )
        assert removed is False


@pytest.mark.asyncio
class TestGetSessionTags:
    """get_session_tags: 세션의 태그 목록 조회."""

    async def test_get_session_tags_empty(self, tag_service, test_session):
        """태그가 없는 세션은 빈 목록을 반환한다."""
        tags = await tag_service.get_session_tags(test_session["id"])
        assert tags == []

    async def test_get_session_tags_with_tags(self, tag_service, test_session):
        """태그가 있는 세션은 연결된 태그 목록을 반환한다."""
        tag_a = await tag_service.create_tag("sess-tag-a")
        tag_b = await tag_service.create_tag("sess-tag-b")
        await tag_service.add_tags_to_session(test_session["id"], [tag_a.id, tag_b.id])

        tags = await tag_service.get_session_tags(test_session["id"])

        assert len(tags) == 2
        names = {t.name for t in tags}
        assert names == {"sess-tag-a", "sess-tag-b"}
        for t in tags:
            assert isinstance(t, TagInfo)


@pytest.mark.asyncio
class TestGetTagsForSessions:
    """get_tags_for_sessions: 여러 세션의 태그를 일괄 조회."""

    async def test_get_tags_for_multiple_sessions(self, tag_service, session_manager):
        """여러 세션에 대해 각 세션별 태그 목록을 dict로 반환한다."""
        s1 = await session_manager.create(work_dir=tempfile.gettempdir())
        s2 = await session_manager.create(work_dir=tempfile.gettempdir())

        tag_x = await tag_service.create_tag("batch-x")
        tag_y = await tag_service.create_tag("batch-y")

        await tag_service.add_tags_to_session(s1["id"], [tag_x.id])
        await tag_service.add_tags_to_session(s2["id"], [tag_x.id, tag_y.id])

        result = await tag_service.get_tags_for_sessions([s1["id"], s2["id"]])

        assert isinstance(result, dict)
        assert len(result[s1["id"]]) == 1
        assert result[s1["id"]][0].name == "batch-x"
        assert len(result[s2["id"]]) == 2
        s2_names = {t.name for t in result[s2["id"]]}
        assert s2_names == {"batch-x", "batch-y"}

    async def test_get_tags_for_sessions_empty_ids(self, tag_service):
        """빈 세션 ID 목록을 전달하면 빈 dict를 반환한다."""
        result = await tag_service.get_tags_for_sessions([])
        assert result == {}
