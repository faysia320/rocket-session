"""WorkflowService 통합 테스트.

WorkflowService의 모든 public 메서드를 PostgreSQL DB를 사용하여 검증합니다:
- 워크플로우 제어 (start, approve_phase, request_revision, get_next_phase)
- 아티팩트 CRUD (create, get, list, update)
- 주석 관리 (add_annotation, update_annotation_status)
- 주석 → 마크다운 렌더링 (render_annotated_content)
- Phase별 프롬프트 컨텍스트 생성 (build_phase_context)
"""

import tempfile

import pytest

from app.services.workflow_service import WorkflowService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def workflow_service(db):
    """WorkflowService fixture (실제 DB 사용)."""
    return WorkflowService(db)


# ---------------------------------------------------------------------------
# 워크플로우 제어 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestStartWorkflow:
    """start_workflow: 워크플로우 시작 및 첫 번째 phase 설정."""

    async def test_start_workflow_default(
        self, workflow_service, session_manager, test_session
    ):
        """기본 시작 시 research phase로 설정된다."""
        result = await workflow_service.start_workflow(
            test_session["id"], session_manager
        )

        assert result["phase"] == "research"
        assert result["status"] == "in_progress"

        # DB에 반영되었는지 확인
        session = await session_manager.get(test_session["id"])
        assert session["workflow_enabled"] is True
        assert session["workflow_phase"] == "research"
        assert session["workflow_phase_status"] == "in_progress"

    async def test_start_workflow_skip_research(
        self, workflow_service, session_manager, test_session
    ):
        """skip_research=True 시 plan phase부터 시작한다."""
        result = await workflow_service.start_workflow(
            test_session["id"], session_manager, skip_research=True
        )

        assert result["phase"] == "plan"
        assert result["status"] == "in_progress"

    async def test_start_workflow_skip_both(
        self, workflow_service, session_manager, test_session
    ):
        """skip_research + skip_plan 시 implement phase부터 시작한다."""
        result = await workflow_service.start_workflow(
            test_session["id"],
            session_manager,
            skip_research=True,
            skip_plan=True,
        )

        assert result["phase"] == "implement"
        assert result["status"] == "in_progress"

    async def test_start_workflow_skip_plan_only(
        self, workflow_service, session_manager, test_session
    ):
        """skip_plan=True만 설정하면 research부터 시작한다 (skip_plan은 skip_research 없이는 효과 없음)."""
        result = await workflow_service.start_workflow(
            test_session["id"], session_manager, skip_plan=True
        )

        # skip_plan만 True일 때: skip_research=False이므로 첫 phase는 research
        assert result["phase"] == "research"


@pytest.mark.asyncio
class TestGetNextPhase:
    """get_next_phase: 다음 phase 반환."""

    async def test_research_to_plan(self, workflow_service):
        """research 다음은 plan이다."""
        assert await workflow_service.get_next_phase("research") == "plan"

    async def test_plan_to_implement(self, workflow_service):
        """plan 다음은 implement이다."""
        assert await workflow_service.get_next_phase("plan") == "implement"

    async def test_implement_to_none(self, workflow_service):
        """implement 다음은 None이다 (마지막 단계)."""
        assert await workflow_service.get_next_phase("implement") is None

    async def test_invalid_phase_returns_none(self, workflow_service):
        """유효하지 않은 phase 입력 시 None을 반환한다."""
        assert await workflow_service.get_next_phase("unknown") is None
        assert await workflow_service.get_next_phase("") is None


@pytest.mark.asyncio
class TestApprovePhase:
    """approve_phase: phase 승인 + 다음 phase 전환."""

    async def test_approve_research_advances_to_plan(
        self, workflow_service, session_manager, test_session
    ):
        """research 승인 시 plan으로 전환된다."""
        session_id = test_session["id"]
        await workflow_service.start_workflow(session_id, session_manager)

        # research 아티팩트 생성
        await workflow_service.create_artifact(
            session_id, "research", "# 연구 결과\n분석 내용"
        )

        result = await workflow_service.approve_phase(session_id, session_manager)

        assert result["approved_phase"] == "research"
        assert result["next_phase"] == "plan"

        # DB 확인: plan phase로 전환
        session = await session_manager.get(session_id)
        assert session["workflow_phase"] == "plan"
        assert session["workflow_phase_status"] == "in_progress"

    async def test_approve_plan_advances_to_implement(
        self, workflow_service, session_manager, test_session
    ):
        """plan 승인 시 implement로 전환된다."""
        session_id = test_session["id"]

        # plan phase로 직접 설정
        await session_manager.update_settings(
            session_id,
            workflow_enabled=True,
            workflow_phase="plan",
            workflow_phase_status="awaiting_approval",
        )

        # plan 아티팩트 생성
        await workflow_service.create_artifact(
            session_id, "plan", "# 구현 계획\n1. 파일 수정"
        )

        result = await workflow_service.approve_phase(session_id, session_manager)

        assert result["approved_phase"] == "plan"
        assert result["next_phase"] == "implement"

    async def test_approve_implement_completes_workflow(
        self, workflow_service, session_manager, test_session
    ):
        """implement 승인 시 워크플로우가 종료된다 (next_phase=None)."""
        session_id = test_session["id"]

        await session_manager.update_settings(
            session_id,
            workflow_enabled=True,
            workflow_phase="implement",
            workflow_phase_status="awaiting_approval",
        )

        result = await workflow_service.approve_phase(session_id, session_manager)

        assert result["approved_phase"] == "implement"
        assert result["next_phase"] is None

        # DB 확인: phase가 None으로 초기화
        session = await session_manager.get(session_id)
        assert session["workflow_phase"] is None
        assert session["workflow_phase_status"] is None

    async def test_approve_sets_artifact_status_approved(
        self, workflow_service, session_manager, test_session
    ):
        """승인 시 아티팩트 status가 'approved'로 변경된다."""
        session_id = test_session["id"]
        await workflow_service.start_workflow(session_id, session_manager)

        artifact = await workflow_service.create_artifact(
            session_id, "research", "# 연구 결과"
        )
        assert artifact.status == "review"

        await workflow_service.approve_phase(session_id, session_manager)

        # 아티팩트 상태 확인
        updated = await workflow_service.get_artifact(artifact.id)
        assert updated is not None
        assert updated.status == "approved"

    async def test_approve_nonexistent_session_raises(
        self, workflow_service, session_manager
    ):
        """존재하지 않는 세션 승인 시 ValueError가 발생한다."""
        with pytest.raises(ValueError, match="세션을 찾을 수 없습니다"):
            await workflow_service.approve_phase(
                "nonexistent-id", session_manager
            )

    async def test_approve_without_active_workflow_raises(
        self, workflow_service, session_manager, test_session
    ):
        """워크플로우가 활성 상태가 아닌 세션 승인 시 ValueError가 발생한다."""
        # workflow_phase가 None인 세션
        with pytest.raises(ValueError, match="워크플로우가 활성 상태가 아닙니다"):
            await workflow_service.approve_phase(
                test_session["id"], session_manager
            )


@pytest.mark.asyncio
class TestRequestRevision:
    """request_revision: 수정 요청 + 아티팩트 superseded 처리."""

    async def test_revision_supersedes_old_artifact(
        self, workflow_service, session_manager, test_session
    ):
        """수정 요청 시 기존 아티팩트가 superseded 상태가 된다."""
        session_id = test_session["id"]
        await workflow_service.start_workflow(session_id, session_manager)

        artifact = await workflow_service.create_artifact(
            session_id, "research", "# 초기 연구"
        )

        result = await workflow_service.request_revision(
            session_id, session_manager, feedback="더 자세한 분석 필요"
        )

        assert result["phase"] == "research"
        assert result["old_artifact_id"] == artifact.id

        # 기존 아티팩트 상태 확인
        old = await workflow_service.get_artifact(artifact.id)
        assert old is not None
        assert old.status == "superseded"

    async def test_revision_sets_phase_in_progress(
        self, workflow_service, session_manager, test_session
    ):
        """수정 요청 후 phase_status가 in_progress로 재설정된다."""
        session_id = test_session["id"]
        await session_manager.update_settings(
            session_id,
            workflow_enabled=True,
            workflow_phase="research",
            workflow_phase_status="awaiting_approval",
        )
        await workflow_service.create_artifact(
            session_id, "research", "# 연구 결과"
        )

        await workflow_service.request_revision(
            session_id, session_manager, feedback="수정 요청"
        )

        session = await session_manager.get(session_id)
        assert session["workflow_phase_status"] == "in_progress"

    async def test_revision_nonexistent_session_raises(
        self, workflow_service, session_manager
    ):
        """존재하지 않는 세션 수정 요청 시 ValueError가 발생한다."""
        with pytest.raises(ValueError, match="세션을 찾을 수 없습니다"):
            await workflow_service.request_revision(
                "nonexistent-id", session_manager, feedback="수정 필요"
            )

    async def test_revision_no_artifact_raises(
        self, workflow_service, session_manager, test_session
    ):
        """아티팩트 없이 수정 요청 시 ValueError가 발생한다."""
        session_id = test_session["id"]
        await workflow_service.start_workflow(session_id, session_manager)

        with pytest.raises(ValueError, match="아티팩트를 찾을 수 없습니다"):
            await workflow_service.request_revision(
                session_id, session_manager, feedback="수정 요청"
            )


# ---------------------------------------------------------------------------
# 아티팩트 CRUD 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCreateArtifact:
    """create_artifact: 아티팩트 생성."""

    async def test_create_first_artifact(
        self, workflow_service, test_session
    ):
        """첫 번째 아티팩트 생성 시 version=1, parent_artifact_id=None이다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "# 연구 결과\n코드 분석"
        )

        assert artifact.id is not None
        assert artifact.session_id == test_session["id"]
        assert artifact.phase == "research"
        assert artifact.title == "research.md"
        assert artifact.content == "# 연구 결과\n코드 분석"
        assert artifact.status == "review"
        assert artifact.version == 1
        assert artifact.parent_artifact_id is None
        assert artifact.created_at is not None
        assert artifact.updated_at is not None

    async def test_create_second_version(
        self, workflow_service, test_session
    ):
        """동일 phase에 아티팩트 생성 시 version이 증가하고 parent가 설정된다."""
        session_id = test_session["id"]

        v1 = await workflow_service.create_artifact(
            session_id, "research", "# v1 연구"
        )
        v2 = await workflow_service.create_artifact(
            session_id, "research", "# v2 연구 (수정)"
        )

        assert v2.version == 2
        assert v2.parent_artifact_id == v1.id
        assert v2.content == "# v2 연구 (수정)"

    async def test_create_different_phase_resets_version(
        self, workflow_service, test_session
    ):
        """다른 phase에 아티팩트 생성 시 version이 1부터 시작한다."""
        session_id = test_session["id"]

        research = await workflow_service.create_artifact(
            session_id, "research", "# 연구"
        )
        plan = await workflow_service.create_artifact(
            session_id, "plan", "# 계획"
        )

        assert research.version == 1
        assert plan.version == 1
        assert plan.parent_artifact_id is None


@pytest.mark.asyncio
class TestGetArtifact:
    """get_artifact: 아티팩트 상세 조회."""

    async def test_get_existing_artifact(
        self, workflow_service, test_session
    ):
        """존재하는 아티팩트를 조회하면 주석 목록을 포함하여 반환한다."""
        created = await workflow_service.create_artifact(
            test_session["id"], "research", "# 내용"
        )

        artifact = await workflow_service.get_artifact(created.id)

        assert artifact is not None
        assert artifact.id == created.id
        assert artifact.content == "# 내용"
        assert artifact.annotations == []

    async def test_get_nonexistent_artifact(self, workflow_service):
        """존재하지 않는 artifact_id 조회 시 None을 반환한다."""
        result = await workflow_service.get_artifact(999999)
        assert result is None

    async def test_get_artifact_includes_annotations(
        self, workflow_service, test_session
    ):
        """아티팩트 조회 시 연결된 주석이 포함된다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "# 제목\n내용1\n내용2"
        )
        await workflow_service.add_annotation(
            artifact.id, line_start=1, content="제목 수정 필요"
        )

        fetched = await workflow_service.get_artifact(artifact.id)
        assert fetched is not None
        assert len(fetched.annotations) == 1
        assert fetched.annotations[0].content == "제목 수정 필요"


@pytest.mark.asyncio
class TestListArtifacts:
    """list_artifacts: 세션의 모든 아티팩트 목록."""

    async def test_list_empty(self, workflow_service, test_session):
        """아티팩트가 없는 세션은 빈 목록을 반환한다."""
        artifacts = await workflow_service.list_artifacts(test_session["id"])
        assert artifacts == []

    async def test_list_multiple_artifacts(
        self, workflow_service, test_session
    ):
        """여러 아티팩트가 있으면 모두 반환한다."""
        session_id = test_session["id"]

        await workflow_service.create_artifact(session_id, "research", "# 연구")
        await workflow_service.create_artifact(session_id, "plan", "# 계획")

        artifacts = await workflow_service.list_artifacts(session_id)
        assert len(artifacts) == 2

        phases = {a.phase for a in artifacts}
        assert phases == {"research", "plan"}

    async def test_list_only_session_artifacts(
        self, workflow_service, session_manager
    ):
        """다른 세션의 아티팩트는 포함하지 않는다."""
        s1 = await session_manager.create(work_dir=tempfile.gettempdir())
        s2 = await session_manager.create(work_dir=tempfile.gettempdir())

        await workflow_service.create_artifact(s1["id"], "research", "# S1 연구")
        await workflow_service.create_artifact(s2["id"], "research", "# S2 연구")

        artifacts_s1 = await workflow_service.list_artifacts(s1["id"])
        assert len(artifacts_s1) == 1
        assert artifacts_s1[0].session_id == s1["id"]


@pytest.mark.asyncio
class TestUpdateArtifact:
    """update_artifact: 아티팩트 본문 수정."""

    async def test_update_content(self, workflow_service, test_session):
        """아티팩트 content를 수정하면 updated_at도 갱신된다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "# 원본 내용"
        )
        original_updated_at = artifact.updated_at

        updated = await workflow_service.update_artifact(
            artifact.id, "# 수정된 내용\n새 분석 추가"
        )

        assert updated.content == "# 수정된 내용\n새 분석 추가"
        assert updated.updated_at >= original_updated_at

    async def test_update_nonexistent_raises(self, workflow_service):
        """존재하지 않는 아티팩트 수정 시 ValueError가 발생한다."""
        with pytest.raises(ValueError, match="아티팩트를 찾을 수 없습니다"):
            await workflow_service.update_artifact(999999, "새 내용")


# ---------------------------------------------------------------------------
# 주석 관리 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestAddAnnotation:
    """add_annotation: 인라인 주석 추가."""

    async def test_add_comment_annotation(
        self, workflow_service, test_session
    ):
        """기본 comment 타입 주석을 추가한다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "# 제목\n내용\n끝"
        )

        annotation = await workflow_service.add_annotation(
            artifact.id,
            line_start=2,
            content="이 부분 보강 필요",
        )

        assert annotation.id is not None
        assert annotation.artifact_id == artifact.id
        assert annotation.line_start == 2
        assert annotation.line_end is None
        assert annotation.content == "이 부분 보강 필요"
        assert annotation.annotation_type == "comment"
        assert annotation.status == "pending"

    async def test_add_suggestion_with_line_range(
        self, workflow_service, test_session
    ):
        """suggestion 타입 + line_end 범위를 지정하여 주석을 추가한다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "plan", "# 계획\n1단계\n2단계\n3단계"
        )

        annotation = await workflow_service.add_annotation(
            artifact.id,
            line_start=2,
            line_end=4,
            content="이 단계들을 통합하세요",
            annotation_type="suggestion",
        )

        assert annotation.line_start == 2
        assert annotation.line_end == 4
        assert annotation.annotation_type == "suggestion"

    async def test_add_multiple_annotations(
        self, workflow_service, test_session
    ):
        """하나의 아티팩트에 여러 주석을 추가할 수 있다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "A\nB\nC\nD"
        )

        await workflow_service.add_annotation(artifact.id, 1, "주석1")
        await workflow_service.add_annotation(artifact.id, 3, "주석2")

        fetched = await workflow_service.get_artifact(artifact.id)
        assert fetched is not None
        assert len(fetched.annotations) == 2


@pytest.mark.asyncio
class TestUpdateAnnotationStatus:
    """update_annotation_status: 주석 상태 변경."""

    async def test_resolve_annotation(self, workflow_service, test_session):
        """주석 상태를 resolved로 변경한다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "# 내용"
        )
        ann = await workflow_service.add_annotation(
            artifact.id, 1, "수정 필요"
        )
        assert ann.status == "pending"

        updated = await workflow_service.update_annotation_status(
            ann.id, "resolved"
        )

        assert updated.status == "resolved"
        assert updated.id == ann.id

    async def test_dismiss_annotation(self, workflow_service, test_session):
        """주석 상태를 dismissed로 변경한다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "# 내용"
        )
        ann = await workflow_service.add_annotation(
            artifact.id, 1, "이 부분 확인"
        )

        updated = await workflow_service.update_annotation_status(
            ann.id, "dismissed"
        )
        assert updated.status == "dismissed"

    async def test_update_nonexistent_annotation_raises(
        self, workflow_service
    ):
        """존재하지 않는 주석 상태 변경 시 ValueError가 발생한다."""
        with pytest.raises(ValueError, match="주석을 찾을 수 없습니다"):
            await workflow_service.update_annotation_status(999999, "resolved")


# ---------------------------------------------------------------------------
# 주석 → 마크다운 렌더링 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestRenderAnnotatedContent:
    """render_annotated_content: pending 주석을 인라인 코멘트로 삽입."""

    async def test_no_annotations_returns_original(
        self, workflow_service, test_session
    ):
        """주석이 없으면 원본 content를 그대로 반환한다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "# 제목\n내용"
        )

        rendered = await workflow_service.render_annotated_content(artifact.id)
        assert rendered == "# 제목\n내용"

    async def test_pending_annotation_inserted(
        self, workflow_service, test_session
    ):
        """pending 주석이 올바른 위치에 HTML 코멘트로 삽입된다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "line0\nline1\nline2"
        )
        await workflow_service.add_annotation(
            artifact.id, line_start=1, content="여기 수정"
        )

        rendered = await workflow_service.render_annotated_content(artifact.id)
        lines = rendered.split("\n")

        # 주석이 삽입되었으므로 줄 수가 증가
        assert len(lines) == 4
        assert "<!-- [COMMENT L1]: 여기 수정 -->" in rendered

    async def test_resolved_annotation_not_inserted(
        self, workflow_service, test_session
    ):
        """resolved 상태의 주석은 렌더링에 포함되지 않는다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "line0\nline1"
        )
        ann = await workflow_service.add_annotation(
            artifact.id, line_start=1, content="해결됨"
        )
        await workflow_service.update_annotation_status(ann.id, "resolved")

        rendered = await workflow_service.render_annotated_content(artifact.id)
        assert "해결됨" not in rendered
        assert rendered == "line0\nline1"

    async def test_multiple_annotations_all_inserted(
        self, workflow_service, test_session
    ):
        """여러 pending 주석이 모두 삽입된다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "A\nB\nC\nD"
        )
        await workflow_service.add_annotation(artifact.id, 1, "주석A")
        await workflow_service.add_annotation(artifact.id, 3, "주석C")

        rendered = await workflow_service.render_annotated_content(artifact.id)

        assert "<!-- [COMMENT L1]: 주석A -->" in rendered
        assert "<!-- [COMMENT L3]: 주석C -->" in rendered

    async def test_suggestion_type_label(
        self, workflow_service, test_session
    ):
        """suggestion 타입 주석은 [SUGGESTION] 라벨로 렌더링된다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "A\nB\nC"
        )
        await workflow_service.add_annotation(
            artifact.id, 2, "대안 제시", annotation_type="suggestion"
        )

        rendered = await workflow_service.render_annotated_content(artifact.id)
        assert "<!-- [SUGGESTION L2]: 대안 제시 -->" in rendered

    async def test_line_range_annotation_label(
        self, workflow_service, test_session
    ):
        """line_end가 있는 주석은 L{start}-L{end} 형식으로 표시된다."""
        artifact = await workflow_service.create_artifact(
            test_session["id"], "research", "A\nB\nC\nD"
        )
        await workflow_service.add_annotation(
            artifact.id, line_start=1, line_end=3, content="범위 주석"
        )

        rendered = await workflow_service.render_annotated_content(artifact.id)
        assert "<!-- [COMMENT L1-L3]: 범위 주석 -->" in rendered

    async def test_nonexistent_artifact_returns_empty(
        self, workflow_service
    ):
        """존재하지 않는 아티팩트의 렌더링은 빈 문자열을 반환한다."""
        rendered = await workflow_service.render_annotated_content(999999)
        assert rendered == ""


# ---------------------------------------------------------------------------
# Phase별 프롬프트 컨텍스트 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestBuildPhaseContext:
    """build_phase_context: Phase별 컨텍스트 프롬프트 생성."""

    async def test_research_phase_context(
        self, workflow_service, test_session
    ):
        """research phase 컨텍스트에는 코드 수정 금지 지시가 포함된다."""
        context = await workflow_service.build_phase_context(
            test_session["id"], "research", "이 프로젝트의 인증 시스템 분석"
        )

        assert "코드를 수정하거나 구현하지 마세요" in context
        assert "이 프로젝트의 인증 시스템 분석" in context
        assert "코드베이스를 깊이 탐색" in context

    async def test_plan_phase_without_research(
        self, workflow_service, test_session
    ):
        """research 아티팩트 없이 plan phase 컨텍스트를 생성하면 지시사항만 포함된다."""
        context = await workflow_service.build_phase_context(
            test_session["id"], "plan", "API 리팩토링 계획"
        )

        assert "구현 계획을 마크다운으로 작성" in context
        assert "API 리팩토링 계획" in context
        # research 결과가 없으므로 "연구 결과" 섹션 없음
        assert "연구 결과 (research.md)" not in context

    async def test_plan_phase_with_approved_research(
        self, workflow_service, session_manager, test_session
    ):
        """approved된 research 아티팩트가 있으면 plan 컨텍스트에 포함된다."""
        session_id = test_session["id"]

        # research 아티팩트 생성 + approved 처리
        await workflow_service.start_workflow(session_id, session_manager)
        await workflow_service.create_artifact(
            session_id, "research", "# 연구 결과\n인증 모듈 분석 완료"
        )
        await workflow_service.approve_phase(session_id, session_manager)

        context = await workflow_service.build_phase_context(
            session_id, "plan", "계획 수립"
        )

        assert "연구 결과 (research.md)" in context
        assert "인증 모듈 분석 완료" in context

    async def test_plan_phase_with_annotated_research(
        self, workflow_service, session_manager, test_session
    ):
        """research 아티팩트에 pending 주석이 있으면 annotated 버전이 plan 컨텍스트에 포함된다."""
        session_id = test_session["id"]

        await workflow_service.start_workflow(session_id, session_manager)
        artifact = await workflow_service.create_artifact(
            session_id, "research", "line0\nline1\nline2"
        )

        # 주석 추가
        await workflow_service.add_annotation(
            artifact.id, line_start=1, content="이 부분 보강"
        )

        # 승인 → plan으로 전환
        await workflow_service.approve_phase(session_id, session_manager)

        context = await workflow_service.build_phase_context(
            session_id, "plan", "계획"
        )

        assert "연구 결과 (research.md)" in context
        assert "<!-- [COMMENT L1]: 이 부분 보강 -->" in context

    async def test_implement_phase_without_plan(
        self, workflow_service, test_session
    ):
        """plan 아티팩트 없이 implement phase 컨텍스트를 생성하면 지시사항만 포함된다."""
        context = await workflow_service.build_phase_context(
            test_session["id"], "implement", "구현 시작"
        )

        assert "계획에 따라 구현하세요" in context
        assert "구현 시작" in context
        assert "구현 계획 (plan.md)" not in context

    async def test_implement_phase_with_approved_plan(
        self, workflow_service, session_manager, test_session
    ):
        """approved된 plan 아티팩트가 있으면 implement 컨텍스트에 포함된다."""
        session_id = test_session["id"]

        # plan phase 설정 + 아티팩트 생성 + 승인
        await session_manager.update_settings(
            session_id,
            workflow_enabled=True,
            workflow_phase="plan",
            workflow_phase_status="awaiting_approval",
        )
        await workflow_service.create_artifact(
            session_id, "plan", "# 계획\n1. API 엔드포인트 추가\n2. 테스트 작성"
        )
        await workflow_service.approve_phase(session_id, session_manager)

        context = await workflow_service.build_phase_context(
            session_id, "implement", "구현"
        )

        assert "구현 계획 (plan.md)" in context
        assert "API 엔드포인트 추가" in context

    async def test_unknown_phase_returns_original_prompt(
        self, workflow_service, test_session
    ):
        """알 수 없는 phase 입력 시 원본 프롬프트를 그대로 반환한다."""
        context = await workflow_service.build_phase_context(
            test_session["id"], "unknown_phase", "원본 프롬프트"
        )

        assert context == "원본 프롬프트"


# ---------------------------------------------------------------------------
# 통합 시나리오: 전체 워크플로우 흐름
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestFullWorkflowIntegration:
    """전체 워크플로우 흐름 (research → plan → implement) 통합 테스트."""

    async def test_complete_workflow_lifecycle(
        self, workflow_service, session_manager, test_session
    ):
        """research → plan → implement 전체 흐름을 검증한다."""
        session_id = test_session["id"]

        # 1. 워크플로우 시작
        start = await workflow_service.start_workflow(
            session_id, session_manager
        )
        assert start["phase"] == "research"

        # 2. research 아티팩트 생성
        research_artifact = await workflow_service.create_artifact(
            session_id, "research", "# 연구 결과\n파일 구조 분석"
        )
        assert research_artifact.phase == "research"
        assert research_artifact.version == 1

        # 3. research 승인 → plan 전환
        approve1 = await workflow_service.approve_phase(
            session_id, session_manager
        )
        assert approve1["approved_phase"] == "research"
        assert approve1["next_phase"] == "plan"

        # 4. plan 아티팩트 생성
        plan_artifact = await workflow_service.create_artifact(
            session_id, "plan", "# 구현 계획\n1. 서비스 추가"
        )
        assert plan_artifact.phase == "plan"
        assert plan_artifact.version == 1

        # 5. plan 승인 → implement 전환
        approve2 = await workflow_service.approve_phase(
            session_id, session_manager
        )
        assert approve2["approved_phase"] == "plan"
        assert approve2["next_phase"] == "implement"

        # 6. implement 승인 → 워크플로우 종료
        approve3 = await workflow_service.approve_phase(
            session_id, session_manager
        )
        assert approve3["approved_phase"] == "implement"
        assert approve3["next_phase"] is None

        # 최종 상태 확인
        session = await session_manager.get(session_id)
        assert session["workflow_phase"] is None
        assert session["workflow_phase_status"] is None

        # 전체 아티팩트 확인
        all_artifacts = await workflow_service.list_artifacts(session_id)
        assert len(all_artifacts) == 2  # research + plan

    async def test_revision_and_re_approve_cycle(
        self, workflow_service, session_manager, test_session
    ):
        """수정 요청 후 새 아티팩트 생성 → 재승인 흐름을 검증한다."""
        session_id = test_session["id"]

        # 워크플로우 시작 + research 아티팩트
        await workflow_service.start_workflow(session_id, session_manager)
        v1 = await workflow_service.create_artifact(
            session_id, "research", "# v1 연구"
        )
        assert v1.version == 1

        # 수정 요청
        revision = await workflow_service.request_revision(
            session_id, session_manager, feedback="더 자세히"
        )
        assert revision["old_artifact_id"] == v1.id

        # 새 아티팩트 생성 (v2)
        v2 = await workflow_service.create_artifact(
            session_id, "research", "# v2 연구 (보강)"
        )
        assert v2.version == 2
        assert v2.parent_artifact_id == v1.id

        # v1은 superseded, v2는 review
        v1_check = await workflow_service.get_artifact(v1.id)
        assert v1_check is not None
        assert v1_check.status == "superseded"
        assert v2.status == "review"

        # v2 승인 → plan으로 전환
        approve = await workflow_service.approve_phase(
            session_id, session_manager
        )
        assert approve["approved_phase"] == "research"
        assert approve["next_phase"] == "plan"

        v2_check = await workflow_service.get_artifact(v2.id)
        assert v2_check is not None
        assert v2_check.status == "approved"
