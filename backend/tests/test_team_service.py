"""TeamService 통합 테스트.

TeamService의 모든 public 메서드를 PostgreSQL DB를 사용하여 검증합니다:
- 팀 CRUD (create, get, list, update, delete)
- 멤버 관리 (add_member, update_member, remove_member, set_lead, get_members)
"""

import pytest

from app.core.exceptions import NotFoundError
from app.schemas.team import TeamInfo, TeamListItem, TeamMemberInfo


# ---------------------------------------------------------------------------
# 팀 CRUD 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCreateTeam:
    """create_team: 팀 생성."""

    async def test_create_team_name_only(self, team_service):
        """이름만 지정하여 팀을 생성한다."""
        team = await team_service.create_team("Alpha Team")

        assert isinstance(team, TeamInfo)
        assert team.id is not None
        assert len(team.id) == 16
        assert team.name == "Alpha Team"
        assert team.description is None
        assert team.status == "active"
        assert team.lead_member_id is None
        assert team.config is None
        assert team.created_at is not None
        assert team.updated_at is not None
        assert team.members == []

    async def test_create_team_with_description(self, team_service):
        """이름과 설명을 지정하여 팀을 생성한다."""
        team = await team_service.create_team(
            "Beta Team", description="Backend development"
        )

        assert team.name == "Beta Team"
        assert team.description == "Backend development"

    async def test_create_team_with_config(self, team_service):
        """config dict를 포함하여 팀을 생성한다."""
        config = {"max_parallel": 3, "timeout": 120}
        team = await team_service.create_team(
            "Config Team", config=config
        )

        assert team.name == "Config Team"
        assert team.config == config


@pytest.mark.asyncio
class TestGetTeam:
    """get_team: 팀 상세 조회."""

    async def test_get_existing_team(self, team_service):
        """존재하는 팀을 조회하면 TeamInfo를 반환한다."""
        created = await team_service.create_team("Get Test Team")

        team = await team_service.get_team(created.id)

        assert team is not None
        assert isinstance(team, TeamInfo)
        assert team.id == created.id
        assert team.name == "Get Test Team"
        assert team.members == []

    async def test_get_team_with_members(self, team_service):
        """멤버가 있는 팀을 조회하면 멤버 목록이 포함된다."""
        created = await team_service.create_team("Team With Members")
        await team_service.add_member(created.id, "Alice", role="lead")
        await team_service.add_member(created.id, "Bob", role="member")

        team = await team_service.get_team(created.id)

        assert team is not None
        assert len(team.members) == 2
        nicknames = {m.nickname for m in team.members}
        assert nicknames == {"Alice", "Bob"}

    async def test_get_nonexistent_team_raises(self, team_service):
        """존재하지 않는 팀 조회 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="팀을 찾을 수 없습니다"):
            await team_service.get_team("nonexistent-id")


@pytest.mark.asyncio
class TestListTeams:
    """list_teams: 팀 목록 조회."""

    async def test_list_teams_empty(self, team_service):
        """팀이 없으면 빈 목록을 반환한다."""
        teams = await team_service.list_teams()
        assert teams == []

    async def test_list_teams_multiple(self, team_service):
        """여러 팀이 있으면 모두 반환한다."""
        await team_service.create_team("Team-1")
        await team_service.create_team("Team-2")
        await team_service.create_team("Team-3")

        teams = await team_service.list_teams()

        assert len(teams) == 3
        for t in teams:
            assert isinstance(t, TeamListItem)
        names = {t.name for t in teams}
        assert names == {"Team-1", "Team-2", "Team-3"}

    async def test_list_teams_with_member_count(self, team_service):
        """팀 목록에 member_count가 포함된다."""
        team = await team_service.create_team("Counted Team")
        await team_service.add_member(team.id, "Alice")
        await team_service.add_member(team.id, "Bob")

        teams = await team_service.list_teams()

        assert len(teams) == 1
        assert teams[0].member_count == 2


@pytest.mark.asyncio
class TestUpdateTeam:
    """update_team: 팀 수정."""

    async def test_update_team_name(self, team_service):
        """팀 이름을 변경한다."""
        created = await team_service.create_team("Old Name")

        updated = await team_service.update_team(created.id, name="New Name")

        assert updated is not None
        assert updated.id == created.id
        assert updated.name == "New Name"

    async def test_update_team_description(self, team_service):
        """팀 설명을 변경한다."""
        created = await team_service.create_team("Desc Team")

        updated = await team_service.update_team(
            created.id, description="Updated description"
        )

        assert updated is not None
        assert updated.description == "Updated description"

    async def test_update_team_status(self, team_service):
        """팀 상태를 변경한다."""
        created = await team_service.create_team("Status Team")

        updated = await team_service.update_team(created.id, status="paused")

        assert updated is not None
        assert updated.status == "paused"

    async def test_update_nonexistent_team_raises(self, team_service):
        """존재하지 않는 팀 수정 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="팀을 찾을 수 없습니다"):
            await team_service.update_team("nonexistent-id", name="x")


@pytest.mark.asyncio
class TestDeleteTeam:
    """delete_team: 팀 삭제."""

    async def test_delete_existing_team(self, team_service):
        """존재하는 팀을 삭제하면 True를 반환한다."""
        created = await team_service.create_team("Delete Me")

        deleted = await team_service.delete_team(created.id)
        assert deleted is True

        # 삭제 후 조회 시 NotFoundError
        with pytest.raises(NotFoundError):
            await team_service.get_team(created.id)

    async def test_delete_nonexistent_team_raises(self, team_service):
        """존재하지 않는 팀 삭제 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="팀을 찾을 수 없습니다"):
            await team_service.delete_team("nonexistent-id")


# ---------------------------------------------------------------------------
# 멤버 관리 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestAddMember:
    """add_member: 팀에 멤버 추가."""

    async def test_add_member_default_role(self, team_service):
        """기본 역할(member)로 멤버를 추가한다."""
        team = await team_service.create_team("Member Team")

        member = await team_service.add_member(team.id, "Alice")

        assert isinstance(member, TeamMemberInfo)
        assert member.id is not None
        assert member.team_id == team.id
        assert member.nickname == "Alice"
        assert member.role == "member"
        assert member.created_at is not None
        assert member.updated_at is not None

    async def test_add_member_with_lead_role(self, team_service):
        """lead 역할로 멤버를 추가하면 팀의 lead_member_id가 업데이트된다."""
        team = await team_service.create_team("Lead Team")

        member = await team_service.add_member(team.id, "Leader", role="lead")

        assert member.role == "lead"

        # 팀의 lead_member_id 확인
        updated_team = await team_service.get_team(team.id)
        assert updated_team is not None
        assert updated_team.lead_member_id == member.id

    async def test_add_member_with_all_fields(self, team_service):
        """모든 옵션을 지정하여 멤버를 추가한다."""
        team = await team_service.create_team("Full Member Team")

        member = await team_service.add_member(
            team.id,
            "Full Member",
            role="member",
            description="Test member description",
            system_prompt="You are a helpful assistant",
            allowed_tools="Read,Write",
            disallowed_tools="Bash",
            model="claude-sonnet-4-20250514",
            max_turns=10,
            max_budget_usd=5.0,
            mcp_server_ids=["server-1", "server-2"],
        )

        assert member.nickname == "Full Member"
        assert member.description == "Test member description"
        assert member.system_prompt == "You are a helpful assistant"
        assert member.allowed_tools == "Read,Write"
        assert member.disallowed_tools == "Bash"
        assert member.model == "claude-sonnet-4-20250514"
        assert member.max_turns == 10
        assert member.max_budget_usd == 5.0
        assert member.mcp_server_ids == ["server-1", "server-2"]

    async def test_add_member_to_nonexistent_team_raises(self, team_service):
        """존재하지 않는 팀에 멤버 추가 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="팀을 찾을 수 없습니다"):
            await team_service.add_member("nonexistent-id", "Alice")


@pytest.mark.asyncio
class TestUpdateMember:
    """update_member: 멤버 정보 수정."""

    async def test_update_member_nickname(self, team_service):
        """멤버 닉네임을 변경한다."""
        team = await team_service.create_team("Update Member Team")
        member = await team_service.add_member(team.id, "OldNick")

        updated = await team_service.update_member(
            team.id, member.id, nickname="NewNick"
        )

        assert updated is not None
        assert updated.nickname == "NewNick"
        assert updated.id == member.id

    async def test_update_member_model_and_budget(self, team_service):
        """멤버의 model과 max_budget_usd를 변경한다."""
        team = await team_service.create_team("Budget Team")
        member = await team_service.add_member(team.id, "Worker")

        updated = await team_service.update_member(
            team.id, member.id, model="claude-opus-4-20250514", max_budget_usd=10.0
        )

        assert updated is not None
        assert updated.model == "claude-opus-4-20250514"
        assert updated.max_budget_usd == 10.0

    async def test_update_nonexistent_member_returns_none(self, team_service):
        """존재하지 않는 멤버 수정 시 None을 반환한다."""
        team = await team_service.create_team("No Member Team")

        result = await team_service.update_member(team.id, 999999, nickname="x")
        assert result is None


@pytest.mark.asyncio
class TestRemoveMember:
    """remove_member: 멤버 제거."""

    async def test_remove_member(self, team_service):
        """멤버를 제거하면 True를 반환한다."""
        team = await team_service.create_team("Remove Member Team")
        member = await team_service.add_member(team.id, "RemoveMe")

        removed = await team_service.remove_member(team.id, member.id)
        assert removed is True

        # 제거 후 멤버 목록에서 사라진 것을 확인
        members = await team_service.get_members(team.id)
        member_ids = {m.id for m in members}
        assert member.id not in member_ids

    async def test_remove_lead_member_clears_lead(self, team_service):
        """리드 멤버를 제거하면 팀의 lead_member_id가 초기화된다."""
        team = await team_service.create_team("Lead Remove Team")
        leader = await team_service.add_member(team.id, "Leader", role="lead")

        # 리드가 설정되었는지 확인
        team_info = await team_service.get_team(team.id)
        assert team_info is not None
        assert team_info.lead_member_id == leader.id

        # 리드 멤버 제거
        removed = await team_service.remove_member(team.id, leader.id)
        assert removed is True

        # lead_member_id가 None으로 초기화
        team_info = await team_service.get_team(team.id)
        assert team_info is not None
        assert team_info.lead_member_id is None

    async def test_remove_nonexistent_member_raises(self, team_service):
        """존재하지 않는 멤버 제거 시 NotFoundError가 발생한다."""
        team = await team_service.create_team("No Remove Team")

        with pytest.raises(NotFoundError, match="멤버를 찾을 수 없습니다"):
            await team_service.remove_member(team.id, 999999)


@pytest.mark.asyncio
class TestSetLead:
    """set_lead: 팀 리드 설정."""

    async def test_set_lead(self, team_service):
        """기존 멤버를 리드로 설정한다."""
        team = await team_service.create_team("Set Lead Team")
        member = await team_service.add_member(team.id, "NewLead")

        result = await team_service.set_lead(team.id, member.id)

        assert result is not None
        assert isinstance(result, TeamInfo)
        assert result.lead_member_id == member.id

    async def test_set_lead_replaces_existing_lead(self, team_service):
        """새 리드를 설정하면 기존 리드의 role이 member로 변경된다."""
        team = await team_service.create_team("Replace Lead Team")
        old_lead = await team_service.add_member(team.id, "OldLead", role="lead")
        new_lead = await team_service.add_member(team.id, "NewLead")

        result = await team_service.set_lead(team.id, new_lead.id)

        assert result is not None
        assert result.lead_member_id == new_lead.id

        # 기존 리드의 role이 member로 변경되었는지 확인
        members = await team_service.get_members(team.id)
        for m in members:
            if m.id == old_lead.id:
                assert m.role == "member"
            if m.id == new_lead.id:
                assert m.role == "lead"

    async def test_set_lead_nonexistent_member_raises(self, team_service):
        """존재하지 않는 멤버를 리드로 설정 시 NotFoundError가 발생한다."""
        team = await team_service.create_team("No Lead Team")

        with pytest.raises(NotFoundError, match="해당 멤버를 찾을 수 없습니다"):
            await team_service.set_lead(team.id, 999999)


@pytest.mark.asyncio
class TestGetMembers:
    """get_members: 팀 멤버 목록 조회."""

    async def test_get_members_empty(self, team_service):
        """멤버가 없는 팀은 빈 목록을 반환한다."""
        team = await team_service.create_team("Empty Members Team")

        members = await team_service.get_members(team.id)
        assert members == []

    async def test_get_members_multiple(self, team_service):
        """여러 멤버가 있는 팀은 모두 반환한다."""
        team = await team_service.create_team("Multi Members Team")
        await team_service.add_member(team.id, "Alice")
        await team_service.add_member(team.id, "Bob")
        await team_service.add_member(team.id, "Charlie")

        members = await team_service.get_members(team.id)

        assert len(members) == 3
        for m in members:
            assert isinstance(m, TeamMemberInfo)
        nicknames = {m.nickname for m in members}
        assert nicknames == {"Alice", "Bob", "Charlie"}
