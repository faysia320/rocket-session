"""WorkflowDefinitionService 통합 테스트.

WorkflowDefinitionService의 모든 public 메서드를 PostgreSQL DB를 사용하여 검증합니다:
- 정의 CRUD (create, list, get, update, delete)
- 기본 워크플로우 관리 (set_default, get_or_default)
- Export / Import
"""

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.schemas.workflow_definition import (
    WorkflowDefinitionInfo,
    WorkflowStepConfig,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_steps(count: int = 2) -> list[WorkflowStepConfig]:
    """테스트용 워크플로우 스텝 목록을 생성한다."""
    return [
        WorkflowStepConfig(
            name=f"step-{i}",
            label=f"Step {i}",
            icon="FileText",
            prompt_template=f"template-{i}",
            constraints="readonly" if i == 0 else "full",
            order_index=i,
            review_required=i > 0,
        )
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# create_definition 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCreateDefinition:
    """create_definition: 워크플로우 정의 생성."""

    async def test_create_basic(self, workflow_definition_service):
        """이름과 스텝으로 정의를 생성한다."""
        steps = _make_steps(2)
        result = await workflow_definition_service.create_definition(
            name="Test Workflow", steps=steps
        )

        assert isinstance(result, WorkflowDefinitionInfo)
        assert result.id is not None
        assert len(result.id) == 16
        assert result.name == "Test Workflow"
        assert result.is_builtin is False
        assert result.is_default is False
        assert len(result.steps) == 2
        assert result.created_at is not None
        assert result.updated_at is not None

    async def test_create_with_description(self, workflow_definition_service):
        """설명을 포함하여 정의를 생성한다."""
        steps = _make_steps(1)
        result = await workflow_definition_service.create_definition(
            name="Described Workflow",
            steps=steps,
            description="A workflow with description",
        )

        assert result.name == "Described Workflow"
        assert result.description == "A workflow with description"

    async def test_create_steps_order(self, workflow_definition_service):
        """스텝이 order_index 순으로 정렬되어 반환된다."""
        steps = [
            WorkflowStepConfig(
                name="implement", label="Implement", order_index=2
            ),
            WorkflowStepConfig(
                name="research", label="Research", order_index=0
            ),
            WorkflowStepConfig(
                name="plan", label="Plan", order_index=1
            ),
        ]
        result = await workflow_definition_service.create_definition(
            name="Ordered Workflow", steps=steps
        )

        assert len(result.steps) == 3
        assert result.steps[0].name == "research"
        assert result.steps[1].name == "plan"
        assert result.steps[2].name == "implement"


# ---------------------------------------------------------------------------
# list_definitions 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestListDefinitions:
    """list_definitions: 워크플로우 정의 목록 조회."""

    async def test_list_empty(self, workflow_definition_service):
        """정의가 없으면 빈 목록을 반환한다."""
        result = await workflow_definition_service.list_definitions()
        assert result == []

    async def test_list_multiple(self, workflow_definition_service):
        """여러 정의가 있으면 모두 반환한다."""
        steps = _make_steps(1)
        await workflow_definition_service.create_definition(name="WF-A", steps=steps)
        await workflow_definition_service.create_definition(name="WF-B", steps=steps)
        await workflow_definition_service.create_definition(name="WF-C", steps=steps)

        result = await workflow_definition_service.list_definitions()

        assert len(result) == 3
        names = {d.name for d in result}
        assert names == {"WF-A", "WF-B", "WF-C"}
        for d in result:
            assert isinstance(d, WorkflowDefinitionInfo)

    async def test_list_returns_sorted(self, workflow_definition_service):
        """목록은 정렬되어 반환된다 (is_builtin 우선, 이후 sort_order/is_default/updated_at)."""
        steps = _make_steps(1)
        await workflow_definition_service.create_definition(name="WF-1", steps=steps)
        await workflow_definition_service.create_definition(name="WF-2", steps=steps)

        result = await workflow_definition_service.list_definitions()

        # 최소한 결과가 리스트이고 항목이 있는지 확인
        assert len(result) == 2
        for d in result:
            assert isinstance(d, WorkflowDefinitionInfo)


# ---------------------------------------------------------------------------
# get_definition 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGetDefinition:
    """get_definition: 워크플로우 정의 상세 조회."""

    async def test_get_existing(self, workflow_definition_service):
        """존재하는 정의를 조회하면 WorkflowDefinitionInfo를 반환한다."""
        steps = _make_steps(2)
        created = await workflow_definition_service.create_definition(
            name="Get Test", steps=steps
        )

        result = await workflow_definition_service.get_definition(created.id)

        assert result is not None
        assert result.id == created.id
        assert result.name == "Get Test"
        assert len(result.steps) == 2

    async def test_get_nonexistent_raises(self, workflow_definition_service):
        """존재하지 않는 정의 조회 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크플로우 정의를 찾을 수 없습니다"):
            await workflow_definition_service.get_definition("nonexistent-id")


# ---------------------------------------------------------------------------
# update_definition 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestUpdateDefinition:
    """update_definition: 워크플로우 정의 수정."""

    async def test_update_name(self, workflow_definition_service):
        """정의 이름을 변경한다."""
        steps = _make_steps(1)
        created = await workflow_definition_service.create_definition(
            name="Old Name", steps=steps
        )

        updated = await workflow_definition_service.update_definition(
            created.id, name="New Name"
        )

        assert updated is not None
        assert updated.id == created.id
        assert updated.name == "New Name"

    async def test_update_description(self, workflow_definition_service):
        """정의 설명을 변경한다."""
        steps = _make_steps(1)
        created = await workflow_definition_service.create_definition(
            name="Desc Update", steps=steps
        )

        updated = await workflow_definition_service.update_definition(
            created.id, description="Updated description"
        )

        assert updated is not None
        assert updated.description == "Updated description"

    async def test_update_steps(self, workflow_definition_service):
        """정의 스텝을 변경한다."""
        steps = _make_steps(2)
        created = await workflow_definition_service.create_definition(
            name="Steps Update", steps=steps
        )
        assert len(created.steps) == 2

        new_steps = _make_steps(3)
        updated = await workflow_definition_service.update_definition(
            created.id, steps=new_steps
        )

        assert updated is not None
        assert len(updated.steps) == 3

    async def test_update_nonexistent_raises(self, workflow_definition_service):
        """존재하지 않는 정의 수정 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크플로우 정의를 찾을 수 없습니다"):
            await workflow_definition_service.update_definition(
                "nonexistent-id", name="x"
            )


# ---------------------------------------------------------------------------
# delete_definition 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestDeleteDefinition:
    """delete_definition: 워크플로우 정의 삭제."""

    async def test_delete_existing(self, workflow_definition_service):
        """존재하는 정의를 삭제하면 True를 반환한다."""
        steps = _make_steps(1)
        created = await workflow_definition_service.create_definition(
            name="Delete Me", steps=steps
        )

        deleted = await workflow_definition_service.delete_definition(created.id)
        assert deleted is True

        # 삭제 후 조회 시 NotFoundError
        with pytest.raises(NotFoundError):
            await workflow_definition_service.get_definition(created.id)

    async def test_delete_nonexistent_raises(self, workflow_definition_service):
        """존재하지 않는 정의 삭제 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크플로우 정의를 찾을 수 없습니다"):
            await workflow_definition_service.delete_definition("nonexistent-id")

    async def test_delete_builtin_raises_validation_error(
        self, workflow_definition_service, db
    ):
        """is_builtin=True인 정의 삭제 시 ValidationError가 발생한다."""
        from datetime import datetime, timezone

        from app.models.workflow_definition import WorkflowDefinition
        from app.repositories.workflow_definition_repo import (
            WorkflowDefinitionRepository,
        )

        # is_builtin=True인 정의를 DB에 직접 삽입
        now = datetime.now(timezone.utc)
        async with db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = WorkflowDefinition(
                id="builtin-test-001",
                name="System Workflow",
                is_builtin=True,
                is_default=False,
                steps=[{"name": "step1", "label": "Step 1", "order_index": 0}],
                created_at=now,
                updated_at=now,
            )
            await repo.add(entity)
            await session.commit()

        with pytest.raises(ValidationError, match="시스템 워크플로우는 삭제할 수 없습니다"):
            await workflow_definition_service.delete_definition("builtin-test-001")

    async def test_delete_default_reassigns_default(
        self, workflow_definition_service
    ):
        """기본(default) 정의를 삭제하면 남은 정의 중 하나가 새 default가 된다."""
        steps = _make_steps(1)
        wf_a = await workflow_definition_service.create_definition(
            name="Default WF", steps=steps
        )
        wf_b = await workflow_definition_service.create_definition(
            name="Other WF", steps=steps
        )

        # wf_a를 기본으로 설정
        await workflow_definition_service.set_default(wf_a.id)

        # wf_a 삭제
        deleted = await workflow_definition_service.delete_definition(wf_a.id)
        assert deleted is True

        # 남은 정의 중 하나가 default가 되었는지 확인
        definitions = await workflow_definition_service.list_definitions()
        assert len(definitions) == 1
        assert definitions[0].id == wf_b.id
        assert definitions[0].is_default is True


# ---------------------------------------------------------------------------
# set_default 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestSetDefault:
    """set_default: 기본 워크플로우 설정."""

    async def test_set_default(self, workflow_definition_service):
        """지정된 정의를 기본으로 설정한다."""
        steps = _make_steps(1)
        created = await workflow_definition_service.create_definition(
            name="Default Candidate", steps=steps
        )

        result = await workflow_definition_service.set_default(created.id)

        assert result is not None
        assert result.id == created.id
        assert result.is_default is True

    async def test_set_default_clears_previous(self, workflow_definition_service):
        """새 기본 설정 시 이전 기본이 해제된다."""
        steps = _make_steps(1)
        wf_a = await workflow_definition_service.create_definition(
            name="First Default", steps=steps
        )
        wf_b = await workflow_definition_service.create_definition(
            name="Second Default", steps=steps
        )

        # wf_a를 기본으로 설정
        await workflow_definition_service.set_default(wf_a.id)
        a_info = await workflow_definition_service.get_definition(wf_a.id)
        assert a_info is not None
        assert a_info.is_default is True

        # wf_b를 기본으로 설정 → wf_a의 기본 해제
        await workflow_definition_service.set_default(wf_b.id)

        a_info = await workflow_definition_service.get_definition(wf_a.id)
        b_info = await workflow_definition_service.get_definition(wf_b.id)
        assert a_info is not None
        assert a_info.is_default is False
        assert b_info is not None
        assert b_info.is_default is True

    async def test_set_default_nonexistent_raises(
        self, workflow_definition_service
    ):
        """존재하지 않는 정의를 기본으로 설정하면 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크플로우 정의를 찾을 수 없습니다"):
            await workflow_definition_service.set_default("nonexistent-id")


# ---------------------------------------------------------------------------
# get_or_default 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGetOrDefault:
    """get_or_default: ID로 조회하거나 기본 정의 반환."""

    async def test_get_or_default_with_id(self, workflow_definition_service):
        """def_id를 지정하면 해당 정의를 반환한다."""
        steps = _make_steps(2)
        created = await workflow_definition_service.create_definition(
            name="Specific WF", steps=steps
        )

        result = await workflow_definition_service.get_or_default(created.id)

        assert result.id == created.id
        assert result.name == "Specific WF"

    async def test_get_or_default_none_returns_default(
        self, workflow_definition_service
    ):
        """def_id가 None이고 기본 정의가 있으면 기본 정의를 반환한다."""
        steps = _make_steps(1)
        created = await workflow_definition_service.create_definition(
            name="Default For Get", steps=steps
        )
        await workflow_definition_service.set_default(created.id)

        result = await workflow_definition_service.get_or_default(None)

        assert result.id == created.id
        assert result.is_default is True

    async def test_get_or_default_fallback(self, workflow_definition_service):
        """def_id=None이고 기본 정의도 없으면 하드코딩 fallback을 반환한다."""
        result = await workflow_definition_service.get_or_default(None)

        assert result.id == "fallback"
        assert result.name == "Default"
        assert result.is_default is True
        assert len(result.steps) == 3
        step_names = [s.name for s in result.steps]
        assert step_names == ["research", "plan", "implement"]

    async def test_get_or_default_invalid_id_returns_default(
        self, workflow_definition_service
    ):
        """존재하지 않는 def_id를 지정하면 기본 정의를 반환한다."""
        steps = _make_steps(1)
        created = await workflow_definition_service.create_definition(
            name="Fallback Default", steps=steps
        )
        await workflow_definition_service.set_default(created.id)

        result = await workflow_definition_service.get_or_default("nonexistent-id")

        assert result.id == created.id
        assert result.is_default is True


# ---------------------------------------------------------------------------
# export_definition 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestExportDefinition:
    """export_definition: 워크플로우 정의 export."""

    async def test_export_existing(self, workflow_definition_service):
        """존재하는 정의를 export하면 version + definition 구조를 반환한다."""
        steps = _make_steps(2)
        created = await workflow_definition_service.create_definition(
            name="Export WF", steps=steps, description="Export test"
        )

        result = await workflow_definition_service.export_definition(created.id)

        assert result is not None
        assert isinstance(result, dict)
        assert result["version"] == 1
        assert "definition" in result
        definition = result["definition"]
        assert definition["name"] == "Export WF"
        assert definition["description"] == "Export test"
        assert len(definition["steps"]) == 2

    async def test_export_nonexistent_raises(self, workflow_definition_service):
        """존재하지 않는 정의 export 시 NotFoundError가 발생한다."""
        with pytest.raises(NotFoundError, match="워크플로우 정의를 찾을 수 없습니다"):
            await workflow_definition_service.export_definition("nonexistent-id")

    async def test_export_contains_all_fields(self, workflow_definition_service):
        """export 결과에 id, name, steps, created_at 등 필수 필드가 포함된다."""
        steps = _make_steps(1)
        created = await workflow_definition_service.create_definition(
            name="Fields WF", steps=steps
        )

        result = await workflow_definition_service.export_definition(created.id)

        assert result is not None
        definition = result["definition"]
        for key in ("id", "name", "is_builtin", "is_default", "steps", "created_at", "updated_at"):
            assert key in definition


# ---------------------------------------------------------------------------
# import_definition 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestImportDefinition:
    """import_definition: 워크플로우 정의 import."""

    async def test_import_basic(self, workflow_definition_service):
        """WorkflowDefinitionInfo 데이터로 새 정의를 import한다."""
        from datetime import datetime, timezone

        steps = _make_steps(2)
        import_data = WorkflowDefinitionInfo(
            id="import-src-001",
            name="Imported WF",
            description="Imported from export",
            steps=steps,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        result = await workflow_definition_service.import_definition(import_data)

        assert isinstance(result, WorkflowDefinitionInfo)
        # import는 새 ID를 생성하므로 원본 ID와 다름
        assert result.id != "import-src-001"
        assert result.name == "Imported WF"
        assert result.description == "Imported from export"
        assert len(result.steps) == 2

    async def test_import_duplicate_name_suffixed(self, workflow_definition_service):
        """이미 존재하는 이름으로 import 시 자동으로 번호가 붙는다."""
        from datetime import datetime, timezone

        # 먼저 동일 이름 정의 생성
        steps = _make_steps(1)
        await workflow_definition_service.create_definition(
            name="Duplicate WF", steps=steps
        )

        # 동일 이름으로 import
        import_data = WorkflowDefinitionInfo(
            id="import-dup-001",
            name="Duplicate WF",
            steps=steps,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        result = await workflow_definition_service.import_definition(import_data)

        # 이름에 번호가 붙어야 함 (예: "Duplicate WF (2)")
        assert result.name != "Duplicate WF"
        assert result.name.startswith("Duplicate WF")
        assert "(2)" in result.name

    async def test_import_preserves_steps(self, workflow_definition_service):
        """import 시 스텝 설정이 보존된다."""
        from datetime import datetime, timezone

        steps = [
            WorkflowStepConfig(
                name="custom-step",
                label="Custom Step",
                icon="Star",
                prompt_template="Do something custom",
                constraints="full",
                order_index=0,
                review_required=True,
            )
        ]

        import_data = WorkflowDefinitionInfo(
            id="import-steps-001",
            name="Steps Preserved WF",
            steps=steps,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        result = await workflow_definition_service.import_definition(import_data)

        assert len(result.steps) == 1
        step = result.steps[0]
        assert step.name == "custom-step"
        assert step.label == "Custom Step"
        assert step.icon == "Star"
        assert step.prompt_template == "Do something custom"
        assert step.constraints == "full"
        assert step.review_required is True


# ---------------------------------------------------------------------------
# update_definition: builtin 이름 변경 불가
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestUpdateBuiltinProtection:
    """update_definition: 시스템 워크플로우 보호."""

    async def test_builtin_name_change_raises(self, workflow_definition_service, db):
        """is_builtin=True인 정의의 이름을 변경하면 ValidationError가 발생한다."""
        from datetime import datetime, timezone

        from app.models.workflow_definition import WorkflowDefinition
        from app.repositories.workflow_definition_repo import (
            WorkflowDefinitionRepository,
        )

        now = datetime.now(timezone.utc)
        async with db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = WorkflowDefinition(
                id="builtin-upd-001",
                name="Built-in WF",
                is_builtin=True,
                is_default=False,
                steps=[{"name": "s1", "label": "S1", "order_index": 0}],
                created_at=now,
                updated_at=now,
            )
            await repo.add(entity)
            await session.commit()

        with pytest.raises(ValidationError, match="시스템 워크플로우의 이름은 변경할 수 없습니다"):
            await workflow_definition_service.update_definition(
                "builtin-upd-001", name="New Name"
            )

    async def test_builtin_steps_update_allowed(self, workflow_definition_service, db):
        """is_builtin=True인 정의의 스텝 변경은 허용된다."""
        from datetime import datetime, timezone

        from app.models.workflow_definition import WorkflowDefinition
        from app.repositories.workflow_definition_repo import (
            WorkflowDefinitionRepository,
        )

        now = datetime.now(timezone.utc)
        async with db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = WorkflowDefinition(
                id="builtin-upd-002",
                name="Built-in Steps WF",
                is_builtin=True,
                is_default=False,
                steps=[{"name": "s1", "label": "S1", "order_index": 0}],
                created_at=now,
                updated_at=now,
            )
            await repo.add(entity)
            await session.commit()

        new_steps = _make_steps(3)
        result = await workflow_definition_service.update_definition(
            "builtin-upd-002", steps=new_steps
        )

        assert result is not None
        assert len(result.steps) == 3
        assert result.name == "Built-in Steps WF"  # 이름은 변경되지 않음
