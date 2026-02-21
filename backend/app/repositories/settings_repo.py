"""글로벌 설정 Repository."""

from sqlalchemy import select, update

from app.models.global_settings import GlobalSettings
from app.repositories.base import BaseRepository


class SettingsRepository(BaseRepository[GlobalSettings]):
    """global_settings 테이블 CRUD."""

    model_class = GlobalSettings

    async def get_default(self) -> GlobalSettings | None:
        """기본 설정 행 조회 (id='default')."""
        result = await self._session.execute(
            select(GlobalSettings).where(GlobalSettings.id == "default")
        )
        return result.scalar_one_or_none()

    async def update_settings(self, **kwargs) -> GlobalSettings | None:
        """동적 필드 업데이트. kwargs에 있는 필드만 업데이트."""
        if not kwargs:
            return await self.get_default()
        stmt = (
            update(GlobalSettings)
            .where(GlobalSettings.id == "default")
            .values(**kwargs)
        )
        await self._session.execute(stmt)
        return await self.get_default()

    async def ensure_default_exists(self) -> None:
        """기본 설정 행 존재 보장. 없으면 생성."""
        existing = await self.get_default()
        if not existing:
            self._session.add(GlobalSettings(id="default"))
            await self._session.flush()
