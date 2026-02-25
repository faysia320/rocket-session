"""워크플로우 서비스 — 세션 레벨 Research → Plan → Implement 관리."""

import logging
import re
from datetime import datetime, timezone

from app.core.database import Database
from app.models.session_artifact import ArtifactAnnotation, SessionArtifact
from app.repositories.artifact_repo import (
    ArtifactAnnotationRepository,
    SessionArtifactRepository,
)
from app.repositories.file_change_repo import FileChangeRepository
from app.schemas.workflow import ArtifactAnnotationInfo, SessionArtifactInfo

logger = logging.getLogger(__name__)

# 커밋 타입 키워드 매핑 (workflow_original_prompt 분석용)
_COMMIT_TYPE_KEYWORDS: dict[str, list[str]] = {
    "Fix": ["버그", "수정", "fix", "bug", "오류", "에러", "error", "깨진", "broken"],
    "Refactor": ["리팩토링", "리팩터", "refactor", "정리", "개선", "cleanup"],
    "Docs": ["문서", "doc", "readme", "주석", "comment"],
    "Style": ["스타일", "디자인", "css", "ui", "ux", "레이아웃"],
    "Chore": ["설정", "config", "환경", "의존성", "dependency", "빌드"],
}


def _detect_commit_type(prompt: str) -> str:
    """원본 프롬프트에서 커밋 타입 접두사를 결정."""
    lower = prompt.lower()
    for ctype, keywords in _COMMIT_TYPE_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return ctype
    return "Feat"


def _extract_plan_title(plan_content: str) -> str:
    """Plan 아티팩트에서 제목 추출."""
    for line in plan_content.split("\n"):
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()[:72]
        if stripped.startswith("## "):
            return stripped[3:].strip()[:72]
    # 폴백: 첫 비빈 줄
    for line in plan_content.split("\n"):
        stripped = line.strip()
        if stripped and not stripped.startswith("<!--"):
            return stripped[:72]
    return ""


def _extract_plan_bullets(plan_content: str, max_bullets: int = 5) -> list[str]:
    """Plan 아티팩트에서 주요 항목(불릿/번호 목록) 추출."""
    bullets: list[str] = []
    for line in plan_content.split("\n"):
        stripped = line.strip()
        match = re.match(r"^[-*]\s|^\d+\.\s", stripped)
        if match:
            text = stripped[match.end() :].strip()
            if text and len(text) > 5:
                bullets.append(text)
            if len(bullets) >= max_bullets:
                break
    return bullets

# 고정 3단계 순서
PHASE_ORDER = ["research", "plan", "implement"]


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

    def __init__(self, db: Database):
        self._db = db

    # ─── 커밋 메시지 자동 생성 ───

    async def generate_commit_suggestion(
        self, session_id: str, session_manager=None
    ) -> dict:
        """plan 아티팩트 + file_changes 기반 커밋 메시지 생성 (LLM 없음).

        Returns:
            {"title", "body", "full_message", "changed_files"}
        """
        plan_content = ""
        original_prompt = ""

        # plan 아티팩트 조회
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            plan = await repo.get_latest_by_phase(session_id, "plan")
            if plan:
                plan_content = plan.content or ""

        # 세션 정보에서 original_prompt 조회
        if session_manager:
            session_data = await session_manager.get(session_id)
            if session_data:
                original_prompt = session_data.get("workflow_original_prompt") or ""

        # file_changes 조회
        changed_files: list[str] = []
        async with self._db.session() as db_sess:
            fc_repo = FileChangeRepository(db_sess)
            changes = await fc_repo.get_by_session(session_id)
            seen: set[str] = set()
            for c in changes:
                fp = c.get("file", "")
                if fp and fp not in seen:
                    seen.add(fp)
                    changed_files.append(fp)

        if not changed_files:
            raise ValueError("변경된 파일이 없습니다")

        # 커밋 타입 결정
        commit_type = _detect_commit_type(original_prompt) if original_prompt else "Feat"

        # 제목 결정
        plan_title = _extract_plan_title(plan_content) if plan_content else ""
        if plan_title:
            title = f"{commit_type}: {plan_title}"
        elif original_prompt:
            first_line = original_prompt.split("\n")[0].strip()[:60]
            title = f"{commit_type}: {first_line}"
        else:
            title = f"{commit_type}: 워크플로우 구현 완료"

        # 72자 제한
        if len(title) > 72:
            title = title[:69] + "..."

        # 본문 구성
        body_parts: list[str] = []
        if plan_content:
            bullets = _extract_plan_bullets(plan_content)
            for b in bullets:
                body_parts.append(f"- {b}")
        if not body_parts and original_prompt:
            body_parts.append(original_prompt.strip()[:200])

        body = "\n".join(body_parts)
        full_message = f"{title}\n\n{body}" if body else title

        return {
            "title": title,
            "body": body,
            "full_message": full_message,
            "changed_files": changed_files,
        }

    # ─── 워크플로우 제어 ───

    async def reset_workflow(self, session_id: str, session_manager) -> None:
        """워크플로우 상태를 초기(Research) 상태로 리셋하고 아티팩트를 삭제."""
        # 1. 아티팩트 + 주석 삭제
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            deleted = await repo.delete_by_session(session_id)
            await db_sess.commit()
            if deleted:
                logger.info("아티팩트 삭제: session=%s, count=%d", session_id, deleted)

        # 2. 워크플로우 상태 초기화 (research, in_progress)
        await session_manager.update_settings(
            session_id,
            workflow_phase="research",
            workflow_phase_status="in_progress",
            workflow_original_prompt=None,
        )
        logger.info("워크플로우 리셋: session=%s → research/in_progress", session_id)

    async def start_workflow(
        self,
        session_id: str,
        session_manager,
        skip_research: bool = False,
        skip_plan: bool = False,
    ) -> dict:
        """워크플로우 시작: 첫 번째 phase 설정."""
        if skip_research and skip_plan:
            first_phase = "implement"
        elif skip_research:
            first_phase = "plan"
        else:
            first_phase = "research"

        await session_manager.update_settings(
            session_id,
            workflow_enabled=True,
            workflow_phase=first_phase,
            workflow_phase_status="in_progress",
        )
        logger.info("워크플로우 시작: session=%s, phase=%s", session_id, first_phase)
        return {"phase": first_phase, "status": "in_progress"}

    async def get_next_phase(self, current_phase: str) -> str | None:
        """현재 phase의 다음 단계 반환. implement 다음은 None."""
        try:
            idx = PHASE_ORDER.index(current_phase)
            if idx + 1 < len(PHASE_ORDER):
                return PHASE_ORDER[idx + 1]
        except ValueError:
            pass
        return None

    async def approve_phase(
        self,
        session_id: str,
        session_manager,
        feedback: str | None = None,
    ) -> dict:
        """현재 phase 승인 → 아티팩트 approved → 다음 phase 전환."""
        session_data = await session_manager.get(session_id)
        if not session_data:
            raise ValueError(f"세션을 찾을 수 없습니다: {session_id}")

        current_phase = session_data.get("workflow_phase")
        if not current_phase:
            raise ValueError("워크플로우가 활성 상태가 아닙니다")

        # 아티팩트 approved 처리
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            artifact = await repo.get_latest_by_phase(session_id, current_phase)
            if artifact:
                artifact.status = "approved"
                artifact.updated_at = datetime.now(timezone.utc)
                await db_sess.commit()

        # 다음 phase로 전환
        next_phase = await self.get_next_phase(current_phase)
        if next_phase:
            await session_manager.update_settings(
                session_id,
                workflow_phase=next_phase,
                workflow_phase_status="in_progress",
            )
            logger.info(
                "Phase 승인: session=%s, %s → %s",
                session_id,
                current_phase,
                next_phase,
            )
            return {"approved_phase": current_phase, "next_phase": next_phase}
        else:
            # implement 완료 → 워크플로우 완료 상태로 전환
            await session_manager.update_settings(
                session_id,
                workflow_phase="implement",
                workflow_phase_status="completed",
            )
            logger.info("워크플로우 완료: session=%s", session_id)
            return {"approved_phase": current_phase, "next_phase": None}

    async def request_revision(
        self,
        session_id: str,
        session_manager,
        feedback: str,
    ) -> dict:
        """수정 요청 → 아티팩트 superseded + 새 버전 생성 → 재실행 대기."""
        session_data = await session_manager.get(session_id)
        if not session_data:
            raise ValueError(f"세션을 찾을 수 없습니다: {session_id}")

        current_phase = session_data.get("workflow_phase")
        now = datetime.now(timezone.utc)

        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            old_artifact = await repo.get_latest_by_phase(session_id, current_phase)
            if not old_artifact:
                raise ValueError(f"{current_phase} 아티팩트를 찾을 수 없습니다")

            # 기존 아티팩트 superseded 처리
            old_artifact.status = "superseded"
            old_artifact.updated_at = now
            await db_sess.flush()

            old_artifact_id = old_artifact.id

            await db_sess.commit()

        # phase_status → in_progress (재실행 대기)
        await session_manager.update_settings(
            session_id,
            workflow_phase_status="in_progress",
        )
        logger.info("수정 요청: session=%s, phase=%s", session_id, current_phase)
        return {"phase": current_phase, "old_artifact_id": old_artifact_id}

    # ─── 아티팩트 CRUD ───

    async def create_artifact(
        self,
        session_id: str,
        phase: str,
        content: str,
    ) -> SessionArtifactInfo:
        """아티팩트 생성 (Claude 결과 자동 저장)."""
        now = datetime.now(timezone.utc)

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
        now = datetime.now(timezone.utc)
        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)
            artifact = await repo.get_with_annotations(artifact_id)
            if not artifact:
                raise ValueError(f"아티팩트를 찾을 수 없습니다: {artifact_id}")
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
        now = datetime.now(timezone.utc)
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
                raise ValueError(f"주석을 찾을 수 없습니다: {annotation_id}")
            annotation.status = status
            await db_sess.commit()
            await db_sess.refresh(annotation)
            return _annotation_to_info(annotation)

    # ─── 주석 → 마크다운 변환 ───

    async def render_annotated_content(self, artifact_id: int) -> str:
        """아티팩트 본문에 pending 주석을 인라인 코멘트로 삽입."""
        async with self._db.session() as db_sess:
            art_repo = SessionArtifactRepository(db_sess)
            ann_repo = ArtifactAnnotationRepository(db_sess)

            artifact = await art_repo.get_by_id(artifact_id)
            if not artifact:
                return ""

            pending = await ann_repo.list_pending(artifact_id)
            if not pending:
                return artifact.content

            lines = artifact.content.split("\n")

            # 뒤에서부터 삽입해야 줄 번호가 밀리지 않음
            type_labels = {
                "comment": "COMMENT",
                "suggestion": "SUGGESTION",
                "rejection": "REJECTION",
            }
            for ann in reversed(pending):
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

    async def build_phase_context(
        self, session_id: str, workflow_phase: str, user_prompt: str
    ) -> str:
        """Phase별 컨텍스트 프롬프트를 구성하여 반환."""
        if workflow_phase == "research":
            return (
                "## 지시사항\n"
                "아래 요청에 대해 코드베이스를 깊이 탐색하고 **분석 결과만** 마크다운으로 정리하세요.\n\n"
                "### 분석 항목\n"
                "- 관련 파일 및 함수 목록\n"
                "- 현재 코드의 동작 방식과 데이터 흐름\n"
                "- 아키텍처 패턴 및 의존성 관계\n"
                "- 현재 구현의 제약사항이나 주의점\n\n"
                "### 금지 사항\n"
                "- **구현 계획, 변경 제안, 해결 방안을 작성하지 마세요.**\n"
                "- **코드를 수정하거나 구현하지 마세요.**\n"
                "- 계획 작성은 다음 단계(Plan)에서 별도로 수행됩니다.\n"
                "- 이 단계에서는 현재 상태의 분석과 발견 사항만 보고하세요.\n\n"
                f"## 요청\n{user_prompt}"
            )

        if workflow_phase == "plan":
            # 이전 research 아티팩트 내용 주입
            research_context = ""
            async with self._db.session() as db_sess:
                repo = SessionArtifactRepository(db_sess)
                research_artifact = await repo.get_latest_by_phase(
                    session_id, "research"
                )
                if research_artifact and research_artifact.status == "approved":
                    # 주석이 있으면 annotated 버전 사용
                    ann_repo = ArtifactAnnotationRepository(db_sess)
                    pending = await ann_repo.list_pending(research_artifact.id)
                    if pending:
                        research_context = await self.render_annotated_content(
                            research_artifact.id
                        )
                    else:
                        research_context = research_artifact.content

            parts = []
            if research_context:
                parts.append(f"## 연구 결과 (research.md)\n{research_context}")
            parts.append(
                "## 지시사항\n"
                "위 연구 결과를 바탕으로 상세한 구현 계획을 마크다운으로 작성하세요.\n"
                "변경할 파일, 구체적인 코드 변경 내용, 순서를 명시하세요.\n"
                "**중요: 아직 코드를 수정하거나 구현하지 마세요.**\n\n"
                f"## 요청\n{user_prompt}"
            )
            return "\n\n".join(parts)

        if workflow_phase == "implement":
            # 이전 plan 아티팩트 내용 주입
            plan_context = ""
            async with self._db.session() as db_sess:
                repo = SessionArtifactRepository(db_sess)
                plan_artifact = await repo.get_latest_by_phase(session_id, "plan")
                if plan_artifact and plan_artifact.status == "approved":
                    plan_context = plan_artifact.content

            parts = []
            if plan_context:
                parts.append(f"## 구현 계획 (plan.md)\n{plan_context}")
            parts.append(
                "## 지시사항\n"
                "위 계획에 따라 구현하세요. 모든 단계가 완료될 때까지 멈추지 마세요.\n"
                "구현 후 빌드/린트 검증까지 수행하세요.\n\n"
                f"## 요청\n{user_prompt}"
            )
            return "\n\n".join(parts)

        # 알 수 없는 phase → 원본 프롬프트 반환
        return user_prompt

    async def build_revision_context(
        self, session_id: str, original_prompt: str, feedback: str
    ) -> str:
        """Plan 수정 요청 시 컨텍스트 구성: 이전 plan + 주석 + 피드백 + 원본 요구사항."""
        parts: list[str] = []

        async with self._db.session() as db_sess:
            repo = SessionArtifactRepository(db_sess)

            # Research 결과 주입
            research = await repo.get_latest_by_phase(session_id, "research")
            if research:
                parts.append(f"## 연구 결과 (research.md)\n{research.content}")

            # 이전 Plan (superseded) 내용 + 주석
            plan = await repo.get_latest_by_phase(session_id, "plan")
            if plan:
                ann_repo = ArtifactAnnotationRepository(db_sess)
                pending = await ann_repo.list_pending(plan.id)
                if pending:
                    annotated = await self.render_annotated_content(plan.id)
                    parts.append(f"## 이전 계획 (수정 필요)\n{annotated}")
                else:
                    parts.append(f"## 이전 계획 (수정 필요)\n{plan.content}")

        parts.append(f"## 수정 요청 피드백\n{feedback}")
        parts.append(
            "## 지시사항\n"
            "위 피드백과 주석을 반영하여 구현 계획을 **수정**하세요.\n"
            "변경할 파일, 구체적인 코드 변경 내용, 순서를 명시하세요.\n"
            "**중요: 아직 코드를 수정하거나 구현하지 마세요.**\n\n"
            f"## 원본 요청\n{original_prompt}"
        )
        return "\n\n".join(parts)
