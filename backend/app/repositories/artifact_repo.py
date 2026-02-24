"""아티팩트 및 주석 Repository."""

from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.models.session_artifact import ArtifactAnnotation, SessionArtifact
from app.repositories.base import BaseRepository


class SessionArtifactRepository(BaseRepository[SessionArtifact]):
    """SessionArtifact CRUD Repository."""

    model_class = SessionArtifact

    async def list_by_session(self, session_id: str) -> list[SessionArtifact]:
        """세션의 모든 아티팩트 조회 (주석 포함)."""
        stmt = (
            select(SessionArtifact)
            .where(SessionArtifact.session_id == session_id)
            .options(selectinload(SessionArtifact.annotations))
            .order_by(SessionArtifact.created_at)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_by_phase(
        self, session_id: str, phase: str
    ) -> SessionArtifact | None:
        """세션의 특정 phase에서 가장 최신 아티팩트 조회."""
        stmt = (
            select(SessionArtifact)
            .where(
                SessionArtifact.session_id == session_id,
                SessionArtifact.phase == phase,
            )
            .options(selectinload(SessionArtifact.annotations))
            .order_by(SessionArtifact.version.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_with_annotations(self, artifact_id: int) -> SessionArtifact | None:
        """아티팩트를 주석과 함께 조회."""
        stmt = (
            select(SessionArtifact)
            .where(SessionArtifact.id == artifact_id)
            .options(selectinload(SessionArtifact.annotations))
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def delete_by_session(self, session_id: str) -> int:
        """세션의 모든 아티팩트 삭제 (주석은 CASCADE로 자동 삭제)."""
        # 먼저 해당 세션의 아티팩트 ID 목록 조회
        id_stmt = select(SessionArtifact.id).where(
            SessionArtifact.session_id == session_id
        )
        result = await self._session.execute(id_stmt)
        artifact_ids = list(result.scalars().all())

        if artifact_ids:
            # 주석 먼저 삭제
            ann_stmt = delete(ArtifactAnnotation).where(
                ArtifactAnnotation.artifact_id.in_(artifact_ids)
            )
            await self._session.execute(ann_stmt)

            # 아티팩트 삭제
            art_stmt = delete(SessionArtifact).where(
                SessionArtifact.session_id == session_id
            )
            result = await self._session.execute(art_stmt)
            return result.rowcount
        return 0


class ArtifactAnnotationRepository(BaseRepository[ArtifactAnnotation]):
    """ArtifactAnnotation CRUD Repository."""

    model_class = ArtifactAnnotation

    async def list_by_artifact(self, artifact_id: int) -> list[ArtifactAnnotation]:
        """아티팩트의 모든 주석 조회."""
        stmt = (
            select(ArtifactAnnotation)
            .where(ArtifactAnnotation.artifact_id == artifact_id)
            .order_by(ArtifactAnnotation.line_start)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_pending(self, artifact_id: int) -> list[ArtifactAnnotation]:
        """아티팩트의 미해결 주석만 조회."""
        stmt = (
            select(ArtifactAnnotation)
            .where(
                ArtifactAnnotation.artifact_id == artifact_id,
                ArtifactAnnotation.status == "pending",
            )
            .order_by(ArtifactAnnotation.line_start)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
