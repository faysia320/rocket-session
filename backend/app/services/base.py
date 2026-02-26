"""서비스 베이스 클래스 - DB 세션 보일러플레이트 감소."""

from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Database


class DBService:
    """Database 의존 서비스의 공통 베이스. _session_scope로 DB 세션 + Repository 생성을 단순화."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @asynccontextmanager
    async def _session_scope(
        self, *repo_classes: type
    ) -> AsyncGenerator[tuple[AsyncSession, Any, ...], None]:
        """DB 세션 + Repository 인스턴스를 한 번에 생성.

        Usage:
            async with self._session_scope(TagRepository) as (session, repo):
                ...
            async with self._session_scope(SessionRepository, MessageRepository) as (session, sess_repo, msg_repo):
                ...
        """
        async with self._db.session() as session:
            repos = tuple(cls(session) for cls in repo_classes)
            if len(repos) == 1:
                yield session, repos[0]
            else:
                yield session, *repos
