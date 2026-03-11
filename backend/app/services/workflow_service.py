"""워크플로우 서비스 — 세션 레벨 동적 단계 관리."""

import structlog

from app.core.database import Database
from app.core.exceptions import NotFoundError, ValidationError
from app.core.utils import utc_now
from app.models.session_artifact import ArtifactAnnotation, SessionArtifact
from app.repositories.artifact_repo import (
    ArtifactAnnotationRepository,
    SessionArtifactRepository,
)
from app.schemas.workflow import ArtifactAnnotationInfo, SessionArtifactInfo
from app.schemas.workflow_definition import ResolvedWorkflowStep
from app.services.workflow_definition_service import WorkflowDefinitionService

logger = structlog.get_logger(__name__)


def _artifact_to_info(artifact: SessionArtifact) -> SessionArtifactInfo:
    """ORM → Pydantic 변환."""
    return SessionArtifactInfo(
        id=artifact.id,
        session_id=artifact.session_id,
        phase=artifact.phase,
        title=artifact.title,
        content=artifact.content,
        status=artifact.status,
        version=artifact.version,
        parent_artifact_id=artifact.parent_artifact_id,
        annotations=[
            ArtifactAnnotationInfo(
                id=a.id,
                artifact_id=a.artifact_id,
                line_start=a.line_start,
                line_end=a.line_end,
                content=a.content,
                annotation_type=a.annotation_type,
                status=a.status,
                created_at=a.created_at,
            )
            for a in (artifact.annotations or [])
        ],
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
    )


def _annotation_to_info(ann: ArtifactAnnotation) -> ArtifactAnnotationInfo:
    """ORM → Pydantic 변환."""
    return ArtifactAnnotationInfo(
        id=ann.id,
        artifact_id=ann.artifact_id,
        line_start=ann.line_start,
        line_end=ann.line_end,
        content=ann.content,
        annotation_type=ann.annotation_type,
        status=ann.status,
        created_at=ann.created_at,
    )


class WorkflowService:
    """세션 워크플로우 상태 및 아티팩트 관리."""

    def __init__(self, db: Database, definition_service: WorkflowDefinitionService):
        self._db = db
        self._def_service = definition_service

    # ─── 헬퍼 메서드 ───

    async def _get_steps(
        self, session_id: str, session_manager
    ) -> list[ResolvedWorkflowStep]:
        """세션의 workflow_definition_id로 steps 로드. null이면 기본 프리셋."""
        session_data = await session_manager.get(session_id)
        def_id = session_data.get("workflow_definition_id") if session_data else None
        definition = await self._def_service.get_or_default(def_id)
        return sorted(definition.steps, key=lambda s: s.order_index)

    async def _get_steps_from_db(self, session_id: str) -> list[ResolvedWorkflowStep]:
        """session_manager 없이 DB에서 직접 steps 로드."""
        from app.repositories.session_repo import SessionRepository

        async with self._db.session() as db_sess:
            repo = SessionRepository(db_sess)
            session_entity = await repo.get_by_id(session_id)
            def_id = session_entity.workflow_definition_id if session_entity else None
        definition = await self._def_service.get_or_default(def_id)
        return sorted(definition.steps, key=lambda s: s.order_index)

    @staticmethod
    def _get_step(
        steps: list[ResolvedWorkflowStep], phase_name: str
    ) -> ResolvedWorkflowStep | None:
        """steps에서 이름으로 단계 찾기."""
        return next((s for s in steps if s.name == phase_name), None)

    @staticmethod
    def _get_next_step(
        steps: list[ResolvedWorkflowStep], current_name: str
    ) -> ResolvedWorkflowStep | None:
        """steps에서 현재 단계 다음 단계 반환."""
        names = [s.name for s in steps]
        try:
            idx = names.index(current_name)
            return steps[idx + 1] if idx + 1 < len(steps) else None
        except ValueError:
            return None

    # ─── 워크플로우 제어 ───

    async def reset_workflow(self, session_id: str, session_manager) -> None:
        """워크플로우 상태를 첫 번째 단계로 리셋하고 아티팩트를 삭제."""
        # 1. 아티팩트 + 주석 삭제
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            deleted = await repo.delete_by_session(session_id)
            await db_sess.commit()
            if deleted:
                logger.info("아티팩트 삭제: session=%s, count=%d", session_id, deleted)

        # 2. 워크플로우 상태 초기화 (첫 번째 단계)
        steps = await self._get_steps(session_id, session_manager)
        first_name = steps[0].name if steps else "research"
        await session_manager.update_settings(
            session_id,
            workflow_phase=first_name,
            workflow_phase_status="in_progress",
            workflow_original_prompt=None,
        )
        logger.info(
            "워크플로우 리셋",
            component="workflow",
            operation="reset",
            phase=first_name,
        )

    async def start_workflow(
        self,
        session_id: str,
        session_manager,
        *,
        workflow_definition_id: str | None = None,
        start_from_step: str | None = None,
        skip_research: bool = False,
    ) -> dict:
        """워크플로우 시작: 첫 번째 phase 설정."""
        definition = await self._def_service.get_or_default(workflow_definition_id)
        steps = sorted(definition.steps, key=lambda s: s.order_index)

        if start_from_step:
            first = next((s for s in steps if s.name == start_from_step), steps[0])
        elif skip_research:
            first = steps[1] if len(steps) > 1 else steps[0]
        else:
            first = steps[0]

        await session_manager.update_settings(
            session_id,
            workflow_enabled=True,
            workflow_definition_id=definition.id,
            workflow_phase=first.name,
            workflow_phase_status="in_progress",
            workflow_original_prompt=None,
        )
        logger.info(
            "워크플로우 시작",
            component="workflow",
            operation="start",
            phase=first.name,
            definition_id=definition.id,
        )
        return {"phase": first.name, "status": "in_progress"}

    async def get_next_phase(
        self,
        current_phase: str,
        session_id: str | None = None,
        session_manager=None,
    ) -> str | None:
        """현재 phase의 다음 단계 반환. 마지막이면 None."""
        if session_id and session_manager:
            steps = await self._get_steps(session_id, session_manager)
        elif session_id:
            steps = await self._get_steps_from_db(session_id)
        else:
            default_def = await self._def_service.get_or_default(None)
            steps = sorted(default_def.steps, key=lambda s: s.order_index)

        next_step = self._get_next_step(steps, current_phase)
        return next_step.name if next_step else None

    async def approve_phase(
        self,
        session_id: str,
        session_manager,
        feedback: str | None = None,
    ) -> dict:
        """현재 phase 승인 → 아티팩트 approved → 다음 phase 전환."""
        session_data = await session_manager.get(session_id)

        current_phase = session_data.get("workflow_phase")
        if not current_phase:
            raise ValidationError("워크플로우가 활성 상태가 아닙니다")

        # 아티팩트 approved 처리
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            artifact = await repo.get_latest_by_phase(session_id, current_phase)
            if artifact:
                artifact.status = "approved"
                artifact.updated_at = utc_now()
                await db_sess.commit()

        # 다음 phase로 전환
        next_phase = await self.get_next_phase(
            current_phase, session_id, session_manager
        )
        if next_phase:
            await session_manager.update_settings(
                session_id,
                workflow_phase=next_phase,
                workflow_phase_status="in_progress",
            )
            logger.info(
                "Phase 승인",
                component="workflow",
                operation="approve",
                from_phase=current_phase,
                to_phase=next_phase,
            )
            return {"approved_phase": current_phase, "next_phase": next_phase}
        else:
            # 마지막 단계 완료 → 워크플로우 완료
            await session_manager.update_settings(
                session_id,
                workflow_phase=current_phase,
                workflow_phase_status="completed",
            )
            logger.info(
                "워크플로우 완료 (approve)",
                component="workflow",
                operation="completed",
                phase=current_phase,
            )
            return {"approved_phase": current_phase, "next_phase": None}

    async def request_revision(
        self,
        session_id: str,
        session_manager,
        feedback: str,
        target_phase: str | None = None,
    ) -> dict:
        """수정 요청 → 아티팩트 superseded + 새 버전 생성 → 재실행 대기.

        target_phase가 지정되면 해당 phase로 되돌아감 (예: QA→implement).
        """
        session_data = await session_manager.get(session_id)

        current_phase = session_data.get("workflow_phase")
        now = utc_now()

        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            old_artifact = await repo.get_latest_by_phase(session_id, current_phase)
            if not old_artifact:
                raise NotFoundError(f"{current_phase} 아티팩트를 찾을 수 없습니다")

            # 기존 아티팩트 superseded 처리
            old_artifact.status = "superseded"
            old_artifact.updated_at = now
            await db_sess.flush()

            old_artifact_id = old_artifact.id

            await db_sess.commit()

        # target_phase가 있으면 해당 phase로 전환, 없으면 현재 phase 유지
        effective_phase = target_phase or current_phase
        await session_manager.update_settings(
            session_id,
            workflow_phase=effective_phase,
            workflow_phase_status="in_progress",
        )
        logger.info(
            "수정 요청",
            component="workflow",
            operation="revision",
            from_phase=current_phase,
            to_phase=effective_phase,
        )
        return {"phase": effective_phase, "old_artifact_id": old_artifact_id}

    # ─── 아티팩트 CRUD ───

    async def create_artifact(
        self,
        session_id: str,
        phase: str,
        content: str,
    ) -> SessionArtifactInfo:
        """아티팩트 생성 (Claude 결과 자동 저장)."""
        now = utc_now()

        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)

            # 같은 phase의 이전 버전 확인
            existing = await repo.get_latest_by_phase(session_id, phase)
            version = (existing.version + 1) if existing else 1
            parent_id = existing.id if existing else None

            artifact = SessionArtifact(
                session_id=session_id,
                phase=phase,
                title=f"{phase}.md",
                content=content,
                status="review",
                version=version,
                parent_artifact_id=parent_id,
                created_at=now,
                updated_at=now,
            )
            await repo.add(artifact)
            await db_sess.commit()
            await db_sess.refresh(artifact)
            logger.info(
                "아티팩트 생성: session=%s, phase=%s, v%d",
                session_id,
                phase,
                version,
            )
            return _artifact_to_info(artifact)

    async def get_artifact(self, artifact_id: int) -> SessionArtifactInfo | None:
        """아티팩트 상세 조회 (주석 포함)."""
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            artifact = await repo.get_with_annotations(artifact_id)
            if not artifact:
                return None
            return _artifact_to_info(artifact)

    async def list_artifacts(self, session_id: str) -> list[SessionArtifactInfo]:
        """세션의 모든 아티팩트 목록."""
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            artifacts = await repo.list_by_session(session_id)
            return [_artifact_to_info(a) for a in artifacts]

    async def update_artifact(
        self, artifact_id: int, content: str
    ) -> SessionArtifactInfo:
        """아티팩트 본문 직접 편집."""
        now = utc_now()
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            artifact = await repo.get_with_annotations(artifact_id)
            if not artifact:
                raise NotFoundError(f"아티팩트를 찾을 수 없습니다: {artifact_id}")
            artifact.content = content
            artifact.updated_at = now
            await db_sess.commit()
            await db_sess.refresh(artifact)
            return _artifact_to_info(artifact)

    # ─── 주석 관리 ───

    async def add_annotation(
        self,
        artifact_id: int,
        line_start: int,
        content: str,
        annotation_type: str = "comment",
        line_end: int | None = None,
    ) -> ArtifactAnnotationInfo:
        """인라인 주석 추가."""
        now = utc_now()
        async with self._db.session() as db_sess:
            repo = ArtifactAnnotationRepository(db_sess)
            annotation = ArtifactAnnotation(
                artifact_id=artifact_id,
                line_start=line_start,
                line_end=line_end,
                content=content,
                annotation_type=annotation_type,
                status="pending",
                created_at=now,
            )
            await repo.add(annotation)
            await db_sess.commit()
            await db_sess.refresh(annotation)
            return _annotation_to_info(annotation)

    async def update_annotation_status(
        self, annotation_id: int, status: str
    ) -> ArtifactAnnotationInfo:
        """주석 상태 업데이트 (resolved/dismissed)."""
        async with self._db.session() as db_sess:
            repo = ArtifactAnnotationRepository(db_sess)
            annotation = await repo.get_by_id(annotation_id)
            if not annotation:
                raise NotFoundError(f"주석을 찾을 수 없습니다: {annotation_id}")
            annotation.status = status
            await db_sess.commit()
            await db_sess.refresh(annotation)
            return _annotation_to_info(annotation)

    # ─── 주석 → 마크다운 변환 ───

    async def render_annotated_content(
        self,
        artifact_id: int,
        *,
        artifact_content: str | None = None,
        pending_annotations: list | None = None,
    ) -> str:
        """아티팩트 본문에 pending 주석을 인라인 코멘트로 삽입.

        성능 최적화: artifact_content와 pending_annotations를 직접 전달하면
        DB 재조회를 건너뜁니다 (N+1 쿼리 방지).
        """
        if artifact_content is None:
            async with self._db.session() as db_sess:
                art_repo = SessionArtifactRepository(db_sess)
                artifact = await art_repo.get_by_id(artifact_id)
                if not artifact:
                    return ""
                artifact_content = artifact.content
                if pending_annotations is None:
                    ann_repo = ArtifactAnnotationRepository(db_sess)
                    pending_annotations = await ann_repo.list_pending(artifact_id)

        if pending_annotations is None:
            async with self._db.session() as db_sess:
                ann_repo = ArtifactAnnotationRepository(db_sess)
                pending_annotations = await ann_repo.list_pending(artifact_id)

        if not pending_annotations:
            return artifact_content

        lines = artifact_content.split("\n")

        # 뒤에서부터 삽입해야 줄 번호가 밀리지 않음
        type_labels = {
            "comment": "COMMENT",
            "suggestion": "SUGGESTION",
            "rejection": "REJECTION",
        }
        for ann in reversed(pending_annotations):
            label = type_labels.get(ann.annotation_type, "COMMENT")
            line_ref = f"L{ann.line_start}"
            if ann.line_end:
                line_ref = f"L{ann.line_start}-L{ann.line_end}"
            comment = f"<!-- [{label} {line_ref}]: {ann.content} -->"
            # 주석 줄 뒤에 삽입 (0-indexed 이므로 line_start 위치에)
            insert_idx = min(ann.line_start, len(lines))
            lines.insert(insert_idx, comment)

        return "\n".join(lines)

    # ─── Phase별 프롬프트 컨텍스트 ───

    async def resolve_workflow_state(
        self,
        session_id: str,
        current_session: dict,
        session_manager,
        ws_manager,
    ) -> tuple[str | None, dict | None, str | None]:
        """워크플로우 게이트 로직: (phase, step_config_dict, error_msg) 반환.

        error_msg가 None이 아니면 프롬프트를 차단해야 함.
        """
        from app.models.event_types import WsEventType

        workflow_phase = current_session.get("workflow_phase")
        workflow_phase_status = current_session.get("workflow_phase_status")

        # 워크플로우 완료 상태: 일반 메시지로 처리
        if workflow_phase_status == "completed":
            return None, None, None

        def_id = current_session.get("workflow_definition_id")
        definition = await self._def_service.get_or_default(def_id)
        steps = sorted(definition.steps, key=lambda s: s.order_index)

        # 게이트 1: 워크플로우 미시작 상태 → 자동 복구
        if not workflow_phase:
            first_name = steps[0].name if steps else "research"
            logger.warning(
                "워크플로우 자동 복구: session=%s (enabled=True, phase=None → %s)",
                session_id,
                first_name,
            )
            await session_manager.update_settings(
                session_id,
                workflow_phase=first_name,
                workflow_phase_status="in_progress",
            )
            workflow_phase = first_name
            await ws_manager.broadcast_event(
                session_id,
                {"type": WsEventType.WORKFLOW_STARTED, "phase": first_name},
            )

        # 현재 step config 로드
        step_config = next(
            (s for s in steps if s.name == workflow_phase), None
        )

        # 게이트 2: 승인 대기 중 → 프롬프트 차단
        if workflow_phase_status == "awaiting_approval":
            logger.info(
                "워크플로우 게이트 차단",
                component="workflow",
                operation="gate_block",
                phase=workflow_phase,
                reason="awaiting_approval",
            )
            return workflow_phase, None, (
                "현재 단계의 검토가 완료되지 않았습니다. "
                "아티팩트를 승인하거나 수정 요청해주세요."
            )

        return (
            workflow_phase,
            step_config.model_dump() if step_config else None,
            None,
        )

    # 시스템 프롬프트 크기 폭발 방지: previous_artifact 최대 글자수
    MAX_ARTIFACT_CONTEXT_CHARS = 20_000

    async def build_phase_context(
        self,
        session_id: str,
        workflow_phase: str,
        user_prompt: str,
        session_manager=None,
        is_continuation: bool = False,
    ) -> str:
        """Phase별 컨텍스트 프롬프트를 구성하여 반환.

        definition의 step.prompt_template에 {user_prompt}와 {previous_artifact}를 치환.
        is_continuation=True이면 이전 아티팩트를 참조만 포함 (토큰 절감).
        """
        # definition에서 steps 로드
        if session_manager:
            steps = await self._get_steps(session_id, session_manager)
        else:
            steps = await self._get_steps_from_db(session_id)

        current_step = self._get_step(steps, workflow_phase)
        if not current_step or not current_step.prompt_template:
            return user_prompt

        # 직전 단계의 approved 아티팩트 가져오기
        previous_artifact = ""
        current_idx = next(
            (i for i, s in enumerate(steps) if s.name == workflow_phase), -1
        )
        if current_idx > 0:
            prev_step = steps[current_idx - 1]
            if is_continuation:
                # Continuation turn: 이전 아티팩트는 이미 세션 컨텍스트에 있으므로 참조만
                previous_artifact = (
                    f"## {prev_step.label} 결과 ({prev_step.name}.md)\n"
                    "[이전 단계에서 이미 제출한 결과물입니다. 위 컨텍스트를 참조하세요.]"
                )
            else:
                async with self._db.session() as db_sess:
                    repo = SessionArtifactRepository(db_sess)
                    artifact = await repo.get_latest_by_phase(
                        session_id, prev_step.name
                    )
                    if artifact and artifact.status == "approved":
                        ann_repo = ArtifactAnnotationRepository(db_sess)
                        pending = await ann_repo.list_pending(artifact.id)
                        if pending:
                            # N+1 방지: 이미 로드한 객체를 직접 전달
                            content = await self.render_annotated_content(
                                artifact.id,
                                artifact_content=artifact.content,
                                pending_annotations=pending,
                            )
                        else:
                            content = artifact.content
                        # 크기 제한: TTFT 개선을 위해 시스템 프롬프트 크기 제어
                        if len(content) > self.MAX_ARTIFACT_CONTEXT_CHARS:
                            content = (
                                content[: self.MAX_ARTIFACT_CONTEXT_CHARS]
                                + "\n\n... [truncated — 전체 내용은 이전 세션 컨텍스트를 참조하세요]"
                            )
                        previous_artifact = (
                            f"## {prev_step.label} 결과 ({prev_step.name}.md)\n"
                            f"{content}"
                        )

        return current_step.prompt_template.format(
            user_prompt=user_prompt,
            previous_artifact=previous_artifact,
        )

    async def build_revision_context(
        self,
        session_id: str,
        original_prompt: str,
        feedback: str,
        session_manager=None,
        validation_summary: str | None = None,
        source_phase: str | None = None,
    ) -> str:
        """수정 요청 시 컨텍스트 구성: 이전 아티팩트들 + 주석 + 피드백 + 원본 요구사항.

        source_phase: QA→implement 되돌아가기 시 원래 phase (예: "qa").
        지정되면 source_phase 아티팩트를 "QA 검토 결과"로 포함하고,
        지시사항을 implement용으로 변경.
        """
        parts: list[str] = []

        # definition에서 steps 로드
        if session_manager:
            steps = await self._get_steps(session_id, session_manager)
            session_data = await session_manager.get(session_id)
            current_phase = session_data.get("workflow_phase") if session_data else None
        else:
            steps = await self._get_steps_from_db(session_id)
            from app.repositories.session_repo import SessionRepository

            async with self._db.session() as db_sess:
                repo = SessionRepository(db_sess)
                session_entity = await repo.get_by_id(session_id)
                current_phase = (
                    session_entity.workflow_phase if session_entity else None
                )

        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)

            # 현재 step 이전의 모든 approved 아티팩트 수집
            for step in steps:
                if step.name == current_phase:
                    break
                artifact = await repo.get_latest_by_phase(session_id, step.name)
                if artifact:
                    parts.append(
                        f"## {step.label} 결과 ({step.name}.md)\n{artifact.content}"
                    )

            # source_phase가 있으면 해당 phase의 아티팩트를 "검토 결과"로 추가
            if source_phase:
                source_step = self._get_step(steps, source_phase)
                source_label = source_step.label if source_step else source_phase
                source_artifact = await repo.get_latest_by_phase(
                    session_id, source_phase
                )
                if source_artifact:
                    parts.append(
                        f"## {source_label} 검토 결과\n{source_artifact.content}"
                    )

            # 현재 step의 아티팩트 + 주석 (source_phase가 없을 때만)
            if current_phase and not source_phase:
                current_artifact = await repo.get_latest_by_phase(
                    session_id, current_phase
                )
                if current_artifact:
                    ann_repo = ArtifactAnnotationRepository(db_sess)
                    pending = await ann_repo.list_pending(current_artifact.id)
                    current_step = self._get_step(steps, current_phase)
                    label = current_step.label if current_step else current_phase
                    if pending:
                        annotated = await self.render_annotated_content(
                            current_artifact.id
                        )
                        parts.append(f"## 이전 {label} (수정 필요)\n{annotated}")
                    else:
                        parts.append(
                            f"## 이전 {label} (수정 필요)\n{current_artifact.content}"
                        )

        if validation_summary:
            parts.append(
                f"## 검증 실패 결과\n{validation_summary}\n\n"
                "위 검증 오류를 모두 수정해주세요."
            )
        if feedback and feedback.strip():
            parts.append(f"## 수정 요청 피드백\n{feedback}")

        if source_phase:
            # QA→implement: 코드 수정 지시사항 (Implement 프롬프트의 실행 지침 포함)
            parts.append(
                "## 지시사항\n"
                "위 QA 검토 결과와 피드백을 반영하여 코드를 **수정**하세요.\n\n"
                "### 실행 지침\n"
                "- **논스톱 실행:** 사용자에게 추가적인 컨펌을 받지 말고, "
                "모든 작업이 완료될 때까지 구현을 멈추지 마세요.\n"
                "- **자가 수정(Self-Correction):** 구현 후 반드시 빌드 및 린트(Lint)를 "
                "실행하세요. 에러가 발생하면 작업을 중단하지 말고, 에러 로그를 분석하여 "
                "스스로 코드를 수정하세요. (최대 3회 시도)\n\n"
                "### 최종 리포트\n"
                "모든 구현이 완료되면, 다음 내용을 마크다운으로 짧게 보고하세요:\n"
                "- 변경된 파일 목록\n"
                "- 적용된 핵심 로직 요약 (어떤 문제를 어떻게 해결했는지)\n\n"
                f"## 원본 요청\n{original_prompt}"
            )
        else:
            parts.append(
                "## 지시사항\n"
                "위 피드백과 주석을 반영하여 결과물을 **수정**하세요.\n"
                "변경할 파일, 구체적인 코드 변경 내용, 순서를 명시하세요.\n"
                "**중요: 아직 코드를 수정하거나 구현하지 마세요.**\n\n"
                f"## 원본 요청\n{original_prompt}"
            )
        return "\n\n".join(parts)

    @staticmethod
    def parse_qa_checklist(artifact_content: str) -> dict:
        """QA 아티팩트에서 체크리스트를 파싱.

        Returns:
            {
                "all_passed": bool,
                "items": [{"item": str, "status": "pass"|"fail"|"warn", "detail": str}],
                "summary": {"pass": int, "fail": int, "warn": int}
            }
        """
        import re

        items: list[dict] = []

        # 마크다운 체크박스 형식 우선: - [x] ... / - [ ] ...
        checkbox_pattern = re.compile(r"-\s*\[(x|X| )\]\s*(.+?)$", re.MULTILINE)
        for match in checkbox_pattern.finditer(artifact_content):
            checked = match.group(1).strip().lower() == "x"
            item_text = match.group(2).strip()
            items.append(
                {
                    "item": item_text,
                    "status": "pass" if checked else "fail",
                    "detail": "",
                }
            )

        # [PASS], [FAIL], [WARN] 형식 매칭 (체크박스가 없을 때만)
        if not items:
            pattern = re.compile(
                r"\[(PASS|FAIL|WARN)\]\s*[:\-\u2013]?\s*(.+?)(?:\s*[:\-\u2013]\s*(.+))?$",
                re.IGNORECASE | re.MULTILINE,
            )
            for match in pattern.finditer(artifact_content):
                status = match.group(1).lower()
                item_text = match.group(2).strip()
                detail = (match.group(3) or "").strip()
                items.append({"item": item_text, "status": status, "detail": detail})

        # 파싱 실패 시 전체를 단일 항목으로 처리
        if not items:
            items.append(
                {
                    "item": "Manual review required",
                    "status": "warn",
                    "detail": artifact_content[:200] if artifact_content else "",
                }
            )

        summary = {
            "pass": sum(1 for i in items if i["status"] == "pass"),
            "fail": sum(1 for i in items if i["status"] == "fail"),
            "warn": sum(1 for i in items if i["status"] == "warn"),
        }
        return {
            "all_passed": summary["fail"] == 0,
            "items": items,
            "summary": summary,
        }
