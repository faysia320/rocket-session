"""아티팩트 및 주석 Repository."""

from sqlalchemy import select
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
