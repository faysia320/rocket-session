"""Database 클래스 lifecycle 및 Repository CRUD 테스트.

기존 SQLite 기반 API (db.create_session, db.conn 등)를 현재
PostgreSQL + SQLAlchemy ORM + Repository 패턴에 맞게 재작성.
"""

import json
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Database
from app.models.event import Event
from app.models.file_change import FileChange
from app.models.message import Message
from app.models.session import Session
from app.repositories.event_repo import EventRepository
from app.repositories.file_change_repo import FileChangeRepository
from app.repositories.message_repo import MessageRepository
from app.repositories.session_repo import SessionRepository


# ---------------------------------------------------------------------------
# Database lifecycle 테스트
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestDatabaseLifecycle:
    """Database 클래스 자체의 lifecycle 테스트."""

    async def test_initialize_creates_tables(self, db):
        """initialize()가 Alembic 마이그레이션으로 테이블을 생성."""
        async with db.session() as session:
            result = await session.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname='public'")
            )
            tables = {row[0] for row in result.all()}
            assert "sessions" in tables
            assert "messages" in tables
            assert "file_changes" in tables
            assert "events" in tables

    async def test_session_context_manager(self, db):
        """session() context manager가 AsyncSession을 제공."""
        async with db.session() as session:
            assert session is not None
            assert isinstance(session, AsyncSession)

    async def test_session_factory_property(self, db):
        """session_factory property가 사용 가능."""
        factory = db.session_factory
        assert factory is not None

    async def test_engine_property(self, db):
        """engine property가 사용 가능."""
        engine = db.engine
        assert engine is not None


# ---------------------------------------------------------------------------
# Session Repository 테스트
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestSessionRepository:
    """SessionRepository CRUD 테스트."""

    async def test_create_and_get_session(self, db):
        """세션 생성 및 조회."""
        async with db.session() as session:
            repo = SessionRepository(session)
            entity = Session(
                id="test-session-1",
                work_dir="/test/work/dir",
                created_at=datetime.now(timezone.utc).isoformat(),
                status="idle",
                allowed_tools="Read,Write",
                system_prompt="Test prompt",
                timeout_seconds=300,
                mode="normal",
                permission_mode=False,
            )
            await repo.add(entity)
            await session.commit()

        async with db.session() as session:
            repo = SessionRepository(session)
            result = await repo.get_by_id("test-session-1")
            assert result is not None
            assert result.id == "test-session-1"
            assert result.work_dir == "/test/work/dir"
            assert result.status == "idle"
            assert result.allowed_tools == "Read,Write"
            assert result.system_prompt == "Test prompt"
            assert result.timeout_seconds == 300
            assert result.mode == "normal"
            assert result.permission_mode is False

    async def test_get_nonexistent_session_returns_none(self, db):
        """존재하지 않는 세션 조회 시 None 반환."""
        async with db.session() as session:
            repo = SessionRepository(session)
            result = await repo.get_by_id("nonexistent-id")
            assert result is None

    async def test_list_sessions(self, db):
        """전체 세션 목록 조회."""
        async with db.session() as session:
            repo = SessionRepository(session)
            for i in range(3):
                await repo.add(
                    Session(
                        id=f"list-session-{i}",
                        work_dir=f"/test/dir/{i}",
                        created_at=datetime.now(timezone.utc).isoformat(),
                    )
                )
            await session.commit()

        async with db.session() as session:
            repo = SessionRepository(session)
            sessions = await repo.get_all()
            assert len(sessions) == 3

    async def test_delete_session(self, db):
        """세션 삭제."""
        async with db.session() as session:
            repo = SessionRepository(session)
            await repo.add(
                Session(
                    id="session-to-delete",
                    work_dir="/test",
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )
            await session.commit()

        async with db.session() as session:
            repo = SessionRepository(session)
            deleted = await repo.delete_by_id("session-to-delete")
            await session.commit()
            assert deleted is True

        async with db.session() as session:
            repo = SessionRepository(session)
            result = await repo.get_by_id("session-to-delete")
            assert result is None

    async def test_delete_nonexistent_session(self, db):
        """존재하지 않는 세션 삭제 시 False 반환."""
        async with db.session() as session:
            repo = SessionRepository(session)
            deleted = await repo.delete_by_id("nonexistent")
            assert deleted is False


# ---------------------------------------------------------------------------
# Message Repository 테스트
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestMessageRepository:
    """MessageRepository CRUD 테스트."""

    async def _create_session(self, db, session_id: str):
        """테스트용 세션 생성 헬퍼."""
        async with db.session() as session:
            repo = SessionRepository(session)
            await repo.add(
                Session(
                    id=session_id,
                    work_dir="/test",
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )
            await session.commit()

    async def test_add_and_get_messages(self, db):
        """메시지 추가 및 조회."""
        await self._create_session(db, "msg-test")

        async with db.session() as session:
            repo = MessageRepository(session)
            await repo.add_message(
                session_id="msg-test",
                role="user",
                content="Hello",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            await repo.add_message(
                session_id="msg-test",
                role="assistant",
                content="Hi there!",
                timestamp=datetime.now(timezone.utc).isoformat(),
                cost=0.001,
                duration_ms=500,
            )
            await session.commit()

        async with db.session() as session:
            repo = MessageRepository(session)
            messages = await repo.get_by_session("msg-test")
            assert len(messages) == 2
            assert messages[0]["role"] == "user"
            assert messages[0]["content"] == "Hello"
            assert messages[1]["role"] == "assistant"
            assert messages[1]["content"] == "Hi there!"
            assert messages[1]["cost"] == 0.001
            assert messages[1]["duration_ms"] == 500

    async def test_count_messages(self, db):
        """메시지 수 조회."""
        await self._create_session(db, "msg-count")

        async with db.session() as session:
            repo = MessageRepository(session)
            count = await repo.count_by_session("msg-count")
            assert count == 0

            for i in range(5):
                await repo.add_message(
                    session_id="msg-count",
                    role="user",
                    content=f"Message {i}",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
            await session.commit()

        async with db.session() as session:
            repo = MessageRepository(session)
            count = await repo.count_by_session("msg-count")
            assert count == 5


# ---------------------------------------------------------------------------
# FileChange Repository 테스트
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestFileChangeRepository:
    """FileChangeRepository CRUD 테스트."""

    async def test_add_and_get_file_changes(self, db):
        """파일 변경 추가 및 조회."""
        async with db.session() as session:
            repo = SessionRepository(session)
            await repo.add(
                Session(
                    id="fc-test",
                    work_dir="/test",
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )
            await session.commit()

        async with db.session() as session:
            repo = FileChangeRepository(session)
            for tool, path in [
                ("Write", "/test/file1.txt"),
                ("Edit", "/test/file2.py"),
            ]:
                fc = FileChange(
                    session_id="fc-test",
                    tool=tool,
                    file=path,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
                session.add(fc)
            await session.commit()

        async with db.session() as session:
            repo = FileChangeRepository(session)
            changes = await repo.get_by_session("fc-test")
            assert len(changes) == 2


# ---------------------------------------------------------------------------
# Event Repository 테스트
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestEventRepository:
    """EventRepository CRUD 테스트."""

    async def _create_session(self, db, session_id: str):
        """테스트용 세션 생성 헬퍼."""
        async with db.session() as session:
            repo = SessionRepository(session)
            await repo.add(
                Session(
                    id=session_id,
                    work_dir="/test",
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
            )
            await session.commit()

    async def test_add_and_get_events(self, db):
        """이벤트 추가 및 전체 조회."""
        await self._create_session(db, "evt-test")

        async with db.session() as session:
            repo = EventRepository(session)
            for i in range(3):
                await repo.add_event(
                    session_id="evt-test",
                    seq=i + 1,
                    event_type="test_event",
                    payload=json.dumps({"data": f"event-{i}"}),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
            await session.commit()

        async with db.session() as session:
            repo = EventRepository(session)
            events = await repo.get_all_events("evt-test")
            assert len(events) == 3
            assert events[0]["seq"] == 1
            assert events[1]["seq"] == 2
            assert events[2]["seq"] == 3

    async def test_get_events_after_seq(self, db):
        """특정 seq 이후의 이벤트 조회."""
        await self._create_session(db, "evt-after")

        async with db.session() as session:
            repo = EventRepository(session)
            for i in range(5):
                await repo.add_event(
                    session_id="evt-after",
                    seq=i + 1,
                    event_type="test",
                    payload="{}",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
            await session.commit()

        async with db.session() as session:
            repo = EventRepository(session)
            events = await repo.get_after("evt-after", after_seq=2)
            assert len(events) == 3
            assert events[0]["seq"] == 3

    async def test_get_max_seq_per_session(self, db):
        """세션별 최대 seq 조회."""
        for i in range(3):
            await self._create_session(db, f"seq-session-{i}")

        async with db.session() as session:
            repo = EventRepository(session)
            for i in range(3):
                for j in range(i + 1):
                    await repo.add_event(
                        session_id=f"seq-session-{i}",
                        seq=j + 1,
                        event_type="test",
                        payload="{}",
                        timestamp=datetime.now(timezone.utc).isoformat(),
                    )
            await session.commit()

        async with db.session() as session:
            repo = EventRepository(session)
            max_seqs = await repo.get_max_seq_per_session()
            assert max_seqs["seq-session-0"] == 1
            assert max_seqs["seq-session-1"] == 2
            assert max_seqs["seq-session-2"] == 3

    async def test_delete_events(self, db):
        """세션의 이벤트 전체 삭제."""
        await self._create_session(db, "evt-delete")

        async with db.session() as session:
            repo = EventRepository(session)
            for i in range(3):
                await repo.add_event(
                    session_id="evt-delete",
                    seq=i + 1,
                    event_type="test",
                    payload="{}",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
            await session.commit()

        async with db.session() as session:
            repo = EventRepository(session)
            await repo.delete_by_session("evt-delete")
            await session.commit()

        async with db.session() as session:
            repo = EventRepository(session)
            events = await repo.get_all_events("evt-delete")
            assert events == []

    async def test_cascade_delete(self, db):
        """세션 삭제 시 관련 이벤트/메시지/파일변경 cascade 삭제."""
        await self._create_session(db, "cascade-test")

        async with db.session() as session:
            # 메시지, 파일 변경, 이벤트 추가
            msg_repo = MessageRepository(session)
            await msg_repo.add_message(
                session_id="cascade-test",
                role="user",
                content="Test",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            evt_repo = EventRepository(session)
            await evt_repo.add_event(
                session_id="cascade-test",
                seq=1,
                event_type="test",
                payload="{}",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            await session.commit()

        # 세션 삭제
        async with db.session() as session:
            repo = SessionRepository(session)
            await repo.delete_by_id("cascade-test")
            await session.commit()

        # cascade 삭제 확인
        async with db.session() as session:
            msg_repo = MessageRepository(session)
            messages = await msg_repo.get_by_session("cascade-test")
            assert len(messages) == 0
            evt_repo = EventRepository(session)
            events = await evt_repo.get_all_events("cascade-test")
            assert len(events) == 0
