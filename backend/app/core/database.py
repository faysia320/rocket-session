"""PostgreSQL + SQLAlchemy 비동기 데이터베이스 관리."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

logger = logging.getLogger(__name__)


class Database:
    """asyncpg 기반 비동기 PostgreSQL 데이터베이스 관리.

    연결 풀링 + async_sessionmaker로 세션 팩토리 제공.
    """

    def __init__(self, database_url: str):
        self._database_url = database_url
        self._engine = create_async_engine(
            database_url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            echo=False,
        )
        self._session_factory = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    async def initialize(self):
        """Alembic 마이그레이션 실행 + 글로벌 설정 기본 행 보장."""
        await self._run_migrations()

        # 글로벌 설정 기본 행 보장
        async with self.session() as session:
            from app.repositories.settings_repo import SettingsRepository

            repo = SettingsRepository(session)
            await repo.ensure_default_exists()
            await session.commit()

        logger.info("데이터베이스 초기화 완료: %s", self._database_url.split("@")[-1])

    async def _run_migrations(self):
        """Alembic 마이그레이션을 프로그래매틱으로 실행."""
        from alembic import command
        from alembic.config import Config

        alembic_ini = os.environ.get(
            "ALEMBIC_INI_PATH",
            str(Path(__file__).resolve().parent.parent.parent / "alembic.ini"),
        )
        alembic_cfg = Config(alembic_ini)

        # DB URL 동적 설정 (동기 드라이버 사용)
        sync_url = self._database_url.replace(
            "postgresql+asyncpg", "postgresql+psycopg2"
        )
        # postgresql:// (asyncpg 없는) URL도 psycopg2로 변환
        if sync_url.startswith("postgresql://"):
            sync_url = sync_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        alembic_cfg.set_main_option("sqlalchemy.url", sync_url)

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, command.upgrade, alembic_cfg, "head")

    @asynccontextmanager
    async def session(self):
        """AsyncSession 컨텍스트 매니저. 블록 종료 시 자동 close."""
        async with self._session_factory() as session:
            yield session

    @property
    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        """외부에서 직접 세션 팩토리에 접근."""
        return self._session_factory

    @property
    def engine(self):
        return self._engine

    async def close(self):
        """엔진 및 연결 풀 종료."""
        await self._engine.dispose()
        logger.info("데이터베이스 연결 종료")
