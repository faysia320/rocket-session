"""SQLite 데이터베이스 연결 관리 및 테이블 초기화."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite

logger = logging.getLogger(__name__)

# SQL 스키마 정의
_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    claude_session_id TEXT,
    work_dir TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    created_at TEXT NOT NULL,
    allowed_tools TEXT,
    system_prompt TEXT,
    timeout_seconds INTEGER,
    mode TEXT NOT NULL DEFAULT 'normal'
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    cost REAL,
    duration_ms INTEGER,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    tool TEXT NOT NULL,
    file TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_session_id ON file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
"""


class Database:
    """aiosqlite 기반 비동기 SQLite 데이터베이스 관리."""

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def initialize(self):
        """DB 파일 생성 및 테이블 초기화."""
        db_dir = Path(self._db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)

        self._db = await aiosqlite.connect(self._db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA foreign_keys=ON")
        await self._db.executescript(_SCHEMA)

        # 마이그레이션: 기존 DB에 새 컬럼이 없을 수 있음
        migrations = [
            "ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'normal'",
            "ALTER TABLE sessions ADD COLUMN permission_mode INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE sessions ADD COLUMN permission_required_tools TEXT",
        ]
        for migration in migrations:
            try:
                await self._db.execute(migration)
                await self._db.commit()
            except aiosqlite.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    continue  # 이미 존재하는 컬럼 - 정상
                logger.error("마이그레이션 실패: %s - %s", migration, e)
                raise

        await self._db.commit()
        logger.info("데이터베이스 초기화 완료: %s", self._db_path)

    async def close(self):
        """DB 연결 종료."""
        if self._db:
            await self._db.close()
            self._db = None
            logger.info("데이터베이스 연결 종료")

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("데이터베이스가 초기화되지 않았습니다")
        return self._db

    @asynccontextmanager
    async def transaction(self):
        """트랜잭션 컨텍스트 매니저. 블록 종료 시 commit, 예외 시 rollback."""
        try:
            yield self.conn
            await self.conn.commit()
        except Exception:
            await self.conn.rollback()
            raise

    # --- Sessions CRUD ---

    async def create_session(
        self,
        session_id: str,
        work_dir: str,
        created_at: str,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        mode: str = "normal",
        permission_mode: bool = False,
        permission_required_tools: str | None = None,
    ) -> dict:
        await self.conn.execute(
            """INSERT INTO sessions (id, work_dir, status, created_at, allowed_tools, system_prompt, timeout_seconds, mode, permission_mode, permission_required_tools)
               VALUES (?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                work_dir,
                created_at,
                allowed_tools,
                system_prompt,
                timeout_seconds,
                mode,
                int(permission_mode),
                permission_required_tools,
            ),
        )
        await self.conn.commit()
        return await self.get_session(session_id)

    async def get_session(self, session_id: str) -> dict | None:
        cursor = await self.conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)

    async def list_sessions(self) -> list[dict]:
        cursor = await self.conn.execute(
            """SELECT s.*,
                      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
                      (SELECT COUNT(*) FROM file_changes WHERE session_id = s.id) as file_changes_count
               FROM sessions s ORDER BY s.created_at DESC"""
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_session_with_counts(self, session_id: str) -> dict | None:
        """단일 세션을 message_count, file_changes_count와 함께 조회."""
        cursor = await self.conn.execute(
            """SELECT s.*,
                      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
                      (SELECT COUNT(*) FROM file_changes WHERE session_id = s.id) as file_changes_count
               FROM sessions s WHERE s.id = ?""",
            (session_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)

    async def delete_session(self, session_id: str) -> bool:
        cursor = await self.conn.execute(
            "DELETE FROM sessions WHERE id = ?", (session_id,)
        )
        await self.conn.commit()
        return cursor.rowcount > 0

    async def update_session_status(self, session_id: str, status: str):
        await self.conn.execute(
            "UPDATE sessions SET status = ? WHERE id = ?", (status, session_id)
        )
        await self.conn.commit()

    async def update_claude_session_id(self, session_id: str, claude_session_id: str):
        await self.conn.execute(
            "UPDATE sessions SET claude_session_id = ? WHERE id = ?",
            (claude_session_id, session_id),
        )
        await self.conn.commit()

    async def update_session_settings(
        self,
        session_id: str,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        mode: str | None = None,
        permission_mode: bool | None = None,
        permission_required_tools: str | None = None,
    ) -> dict | None:
        fields = []
        values = []
        if allowed_tools is not None:
            fields.append("allowed_tools = ?")
            values.append(allowed_tools)
        if system_prompt is not None:
            fields.append("system_prompt = ?")
            values.append(system_prompt)
        if timeout_seconds is not None:
            fields.append("timeout_seconds = ?")
            values.append(timeout_seconds)
        if mode is not None:
            fields.append("mode = ?")
            values.append(mode)
        if permission_mode is not None:
            fields.append("permission_mode = ?")
            values.append(int(permission_mode))
        if permission_required_tools is not None:
            fields.append("permission_required_tools = ?")
            values.append(permission_required_tools)
        if not fields:
            return await self.get_session(session_id)
        values.append(session_id)
        await self.conn.execute(
            f"UPDATE sessions SET {', '.join(fields)} WHERE id = ?", values
        )
        await self.conn.commit()
        return await self.get_session(session_id)

    # --- Messages ---

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        timestamp: str,
        cost: float | None = None,
        duration_ms: int | None = None,
    ):
        await self.conn.execute(
            """INSERT INTO messages (session_id, role, content, cost, duration_ms, timestamp)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (session_id, role, content, cost, duration_ms, timestamp),
        )
        await self.conn.commit()

    async def get_messages(self, session_id: str) -> list[dict]:
        cursor = await self.conn.execute(
            "SELECT role, content, cost, duration_ms, timestamp FROM messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_message_count(self, session_id: str) -> int:
        cursor = await self.conn.execute(
            "SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?",
            (session_id,),
        )
        row = await cursor.fetchone()
        return row["cnt"] if row else 0

    # --- File Changes ---

    async def add_file_change(
        self, session_id: str, tool: str, file: str, timestamp: str
    ):
        await self.conn.execute(
            """INSERT INTO file_changes (session_id, tool, file, timestamp)
               VALUES (?, ?, ?, ?)""",
            (session_id, tool, file, timestamp),
        )
        await self.conn.commit()

    async def get_file_changes(self, session_id: str) -> list[dict]:
        cursor = await self.conn.execute(
            "SELECT tool, file, timestamp FROM file_changes WHERE session_id = ? ORDER BY id",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_file_changes_count(self, session_id: str) -> int:
        cursor = await self.conn.execute(
            "SELECT COUNT(*) as cnt FROM file_changes WHERE session_id = ?",
            (session_id,),
        )
        row = await cursor.fetchone()
        return row["cnt"] if row else 0

    async def find_session_by_claude_id(self, claude_session_id: str) -> dict | None:
        """claude_session_id로 세션 조회."""
        cursor = await self.conn.execute(
            "SELECT * FROM sessions WHERE claude_session_id = ?",
            (claude_session_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)
