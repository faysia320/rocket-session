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

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS global_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    work_dir TEXT,
    allowed_tools TEXT,
    system_prompt TEXT,
    timeout_seconds INTEGER,
    mode TEXT DEFAULT 'normal',
    permission_mode INTEGER DEFAULT 0,
    permission_required_tools TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_session_id ON file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session_seq ON events(session_id, seq);
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
        await self._db.execute("PRAGMA busy_timeout=5000")
        await self._db.executescript(_SCHEMA)

        # 마이그레이션: 기존 DB에 새 컬럼이 없을 수 있음
        migrations = [
            "ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'normal'",
            "ALTER TABLE sessions ADD COLUMN permission_mode INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE sessions ADD COLUMN permission_required_tools TEXT",
            "ALTER TABLE sessions ADD COLUMN name TEXT",
            # Phase 1: result.is_error 추적
            "ALTER TABLE messages ADD COLUMN is_error INTEGER NOT NULL DEFAULT 0",
            # Phase 2: 토큰 사용량 + 모델명 저장
            "ALTER TABLE messages ADD COLUMN input_tokens INTEGER",
            "ALTER TABLE messages ADD COLUMN output_tokens INTEGER",
            "ALTER TABLE messages ADD COLUMN cache_creation_tokens INTEGER",
            "ALTER TABLE messages ADD COLUMN cache_read_tokens INTEGER",
            "ALTER TABLE messages ADD COLUMN model TEXT",
            # JSONL 실시간 감시용: import된 세션의 JSONL 파일 경로
            "ALTER TABLE sessions ADD COLUMN jsonl_path TEXT",
            # Phase 3: CLI 기능 이식 (model, max_turns, max_budget_usd, system_prompt_mode, disallowed_tools)
            "ALTER TABLE sessions ADD COLUMN model TEXT",
            "ALTER TABLE sessions ADD COLUMN max_turns INTEGER",
            "ALTER TABLE sessions ADD COLUMN max_budget_usd REAL",
            "ALTER TABLE sessions ADD COLUMN system_prompt_mode TEXT NOT NULL DEFAULT 'replace'",
            "ALTER TABLE sessions ADD COLUMN disallowed_tools TEXT",
            "ALTER TABLE global_settings ADD COLUMN model TEXT",
            "ALTER TABLE global_settings ADD COLUMN max_turns INTEGER",
            "ALTER TABLE global_settings ADD COLUMN max_budget_usd REAL",
            "ALTER TABLE global_settings ADD COLUMN system_prompt_mode TEXT DEFAULT 'replace'",
            "ALTER TABLE global_settings ADD COLUMN disallowed_tools TEXT",
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

        # 글로벌 설정 기본 행 보장
        cursor = await self._db.execute("SELECT COUNT(*) FROM global_settings")
        row = await cursor.fetchone()
        if row[0] == 0:
            await self._db.execute(
                "INSERT INTO global_settings (id) VALUES ('default')"
            )

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
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str = "replace",
        disallowed_tools: str | None = None,
    ) -> dict:
        await self.conn.execute(
            """INSERT INTO sessions (id, work_dir, status, created_at, allowed_tools, system_prompt, timeout_seconds, mode, permission_mode, permission_required_tools,
                                    model, max_turns, max_budget_usd, system_prompt_mode, disallowed_tools)
               VALUES (?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                model,
                max_turns,
                max_budget_usd,
                system_prompt_mode,
                disallowed_tools,
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
                      COALESCE(mc.cnt, 0) as message_count,
                      COALESCE(fc.cnt, 0) as file_changes_count
               FROM sessions s
               LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM messages GROUP BY session_id) mc
                 ON mc.session_id = s.id
               LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM file_changes GROUP BY session_id) fc
                 ON fc.session_id = s.id
               ORDER BY s.created_at DESC"""
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_session_with_counts(self, session_id: str) -> dict | None:
        """단일 세션을 message_count, file_changes_count와 함께 조회."""
        cursor = await self.conn.execute(
            """SELECT s.*,
                      COALESCE(mc.cnt, 0) as message_count,
                      COALESCE(fc.cnt, 0) as file_changes_count
               FROM sessions s
               LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM messages WHERE session_id = ?) mc
                 ON mc.session_id = s.id
               LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM file_changes WHERE session_id = ?) fc
                 ON fc.session_id = s.id
               WHERE s.id = ?""",
            (session_id, session_id, session_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)

    async def get_session_stats(self, session_id: str) -> dict | None:
        """세션별 누적 비용, 토큰, 메시지 수 통계."""
        cursor = await self.conn.execute(
            """SELECT
                  COUNT(*) as total_messages,
                  COALESCE(SUM(cost), 0) as total_cost,
                  COALESCE(SUM(duration_ms), 0) as total_duration_ms,
                  COALESCE(SUM(input_tokens), 0) as total_input_tokens,
                  COALESCE(SUM(output_tokens), 0) as total_output_tokens,
                  COALESCE(SUM(cache_creation_tokens), 0) as total_cache_creation_tokens,
                  COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens
               FROM messages WHERE session_id = ?""",
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

    async def update_session_jsonl_path(self, session_id: str, jsonl_path: str):
        """세션의 JSONL 파일 경로 업데이트."""
        await self.conn.execute(
            "UPDATE sessions SET jsonl_path = ? WHERE id = ?", (jsonl_path, session_id)
        )
        await self.conn.commit()

    async def get_session_jsonl_path(self, session_id: str) -> str | None:
        """세션의 JSONL 파일 경로 조회."""
        cursor = await self.conn.execute(
            "SELECT jsonl_path FROM sessions WHERE id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None

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
        name: str | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str | None = None,
        disallowed_tools: str | None = None,
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
        if name is not None:
            fields.append("name = ?")
            values.append(name)
        if model is not None:
            fields.append("model = ?")
            values.append(model)
        if max_turns is not None:
            fields.append("max_turns = ?")
            values.append(max_turns)
        if max_budget_usd is not None:
            fields.append("max_budget_usd = ?")
            values.append(max_budget_usd)
        if system_prompt_mode is not None:
            fields.append("system_prompt_mode = ?")
            values.append(system_prompt_mode)
        if disallowed_tools is not None:
            fields.append("disallowed_tools = ?")
            values.append(disallowed_tools)
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
        is_error: bool = False,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        cache_creation_tokens: int | None = None,
        cache_read_tokens: int | None = None,
        model: str | None = None,
    ):
        await self.conn.execute(
            """INSERT INTO messages (session_id, role, content, cost, duration_ms, timestamp,
                                    is_error, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, model)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                role,
                content,
                cost,
                duration_ms,
                timestamp,
                int(is_error),
                input_tokens,
                output_tokens,
                cache_creation_tokens,
                cache_read_tokens,
                model,
            ),
        )
        await self.conn.commit()

    async def get_messages(self, session_id: str) -> list[dict]:
        cursor = await self.conn.execute(
            """SELECT role, content, cost, duration_ms, timestamp,
                      is_error, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, model
               FROM messages WHERE session_id = ? ORDER BY id""",
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

    # --- Events (WebSocket 이벤트 버퍼링) ---

    async def add_event(
        self,
        session_id: str,
        seq: int,
        event_type: str,
        payload: str,
        timestamp: str,
    ):
        await self.conn.execute(
            """INSERT INTO events (session_id, seq, event_type, payload, timestamp)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, seq, event_type, payload, timestamp),
        )
        await self.conn.commit()

    async def add_events_batch(self, events: list[tuple[str, int, str, str, str]]):
        """이벤트 배치 저장. events: [(session_id, seq, event_type, payload, timestamp), ...]"""
        await self.conn.executemany(
            """INSERT INTO events (session_id, seq, event_type, payload, timestamp)
               VALUES (?, ?, ?, ?, ?)""",
            events,
        )
        await self.conn.commit()

    async def get_events_after(self, session_id: str, after_seq: int) -> list[dict]:
        cursor = await self.conn.execute(
            "SELECT seq, event_type, payload, timestamp FROM events WHERE session_id = ? AND seq > ? ORDER BY seq",
            (session_id, after_seq),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_all_events(self, session_id: str) -> list[dict]:
        cursor = await self.conn.execute(
            "SELECT seq, event_type, payload, timestamp FROM events WHERE session_id = ? ORDER BY seq",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_current_turn_events(self, session_id: str) -> list[dict]:
        """DB에서 마지막 user_message 이후의 턴 이벤트를 조회."""
        cursor = await self.conn.execute(
            "SELECT MAX(seq) as last_seq FROM events "
            "WHERE session_id = ? AND event_type = 'user_message'",
            (session_id,),
        )
        row = await cursor.fetchone()
        last_user_seq = row["last_seq"] if row and row["last_seq"] else 0

        if last_user_seq == 0:
            return []

        cursor = await self.conn.execute(
            "SELECT seq, event_type, payload, timestamp FROM events "
            "WHERE session_id = ? AND seq > ? ORDER BY seq",
            (session_id, last_user_seq),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def delete_events(self, session_id: str):
        await self.conn.execute(
            "DELETE FROM events WHERE session_id = ?", (session_id,)
        )
        await self.conn.commit()

    async def get_max_seq_per_session(self) -> dict[str, int]:
        """세션별 최대 seq 번호 조회 (서버 재시작 시 seq 카운터 복원용)."""
        cursor = await self.conn.execute(
            "SELECT session_id, MAX(seq) as max_seq FROM events GROUP BY session_id"
        )
        rows = await cursor.fetchall()
        return {row["session_id"]: row["max_seq"] for row in rows}

    async def cleanup_old_events(self, max_age_hours: int = 24):
        """지정 시간 이전의 이벤트 삭제."""
        cursor = await self.conn.execute(
            "DELETE FROM events WHERE timestamp < datetime('now', ?)",
            (f"-{max_age_hours} hours",),
        )
        await self.conn.commit()
        if cursor.rowcount > 0:
            logger.info(
                "오래된 이벤트 %d건 삭제 (기준: %d시간)", cursor.rowcount, max_age_hours
            )

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

    # ── 글로벌 설정 ───────────────────────────────────────────

    async def get_global_settings(self) -> dict | None:
        """글로벌 기본 설정 조회."""
        cursor = await self.conn.execute(
            "SELECT * FROM global_settings WHERE id = 'default'"
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def update_global_settings(
        self,
        work_dir: str | None = None,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        mode: str | None = None,
        permission_mode: int | None = None,
        permission_required_tools: str | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str | None = None,
        disallowed_tools: str | None = None,
    ) -> dict | None:
        """글로벌 기본 설정 업데이트."""
        fields = []
        values = []
        if work_dir is not None:
            fields.append("work_dir = ?")
            values.append(work_dir)
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
            values.append(permission_mode)
        if permission_required_tools is not None:
            fields.append("permission_required_tools = ?")
            values.append(permission_required_tools)
        if model is not None:
            fields.append("model = ?")
            values.append(model)
        if max_turns is not None:
            fields.append("max_turns = ?")
            values.append(max_turns)
        if max_budget_usd is not None:
            fields.append("max_budget_usd = ?")
            values.append(max_budget_usd)
        if system_prompt_mode is not None:
            fields.append("system_prompt_mode = ?")
            values.append(system_prompt_mode)
        if disallowed_tools is not None:
            fields.append("disallowed_tools = ?")
            values.append(disallowed_tools)
        if not fields:
            return await self.get_global_settings()
        values.append("default")
        await self.conn.execute(
            f"UPDATE global_settings SET {', '.join(fields)} WHERE id = ?", values
        )
        await self.conn.commit()
        return await self.get_global_settings()
