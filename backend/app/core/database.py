"""SQLite 데이터베이스 연결 관리 및 Alembic 마이그레이션."""

import asyncio
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite

logger = logging.getLogger(__name__)


class Database:
    """aiosqlite 기반 비동기 SQLite 데이터베이스 관리."""

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._db: aiosqlite.Connection | None = None
        self._read_db: aiosqlite.Connection | None = None

    async def initialize(self):
        """DB 파일 생성, Alembic 마이그레이션 실행, 연결 초기화."""
        if self._db_path != ":memory:":
            db_dir = Path(self._db_path).parent
            db_dir.mkdir(parents=True, exist_ok=True)

        # 1. Alembic 마이그레이션 실행 (별도 스레드)
        await self._run_migrations()

        # 2. 메인 연결 열기
        self._db = await aiosqlite.connect(self._db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA foreign_keys=ON")
        await self._db.execute("PRAGMA busy_timeout=5000")

        # 3. FTS5 초기 빌드 (기존 데이터가 있고 FTS가 비어있을 때)
        await self._build_fts_index()

        # 4. 글로벌 설정 기본 행 보장
        cursor = await self._db.execute("SELECT COUNT(*) FROM global_settings")
        row = await cursor.fetchone()
        if row[0] == 0:
            await self._db.execute(
                "INSERT INTO global_settings (id) VALUES ('default')"
            )
        await self._db.commit()

        # 5. 읽기 전용 연결 (WAL 모드에서 동시 읽기 지원)
        if self._db_path != ":memory:":
            self._read_db = await aiosqlite.connect(self._db_path)
            self._read_db.row_factory = aiosqlite.Row
            await self._read_db.execute("PRAGMA journal_mode=WAL")
            await self._read_db.execute("PRAGMA foreign_keys=ON")
            await self._read_db.execute("PRAGMA query_only=ON")

        logger.info("데이터베이스 초기화 완료: %s", self._db_path)

    async def _run_migrations(self):
        """Alembic 마이그레이션을 프로그래매틱으로 실행."""
        from alembic import command
        from alembic.config import Config

        alembic_ini = os.environ.get(
            "ALEMBIC_INI_PATH",
            str(Path(__file__).resolve().parent.parent.parent / "alembic.ini"),
        )
        alembic_cfg = Config(alembic_ini)

        # DB URL 동적 설정 (동기 SQLite 드라이버 사용)
        if self._db_path == ":memory:":
            db_url = "sqlite://"
        else:
            db_url = f"sqlite:///{self._db_path}"
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)

        # 기존 DB: alembic_version이 잘못 stamp된 경우 복구
        self._ensure_migration_integrity(alembic_cfg)

        # 별도 스레드에서 동기 실행 (이벤트 루프 충돌 방지)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, command.upgrade, alembic_cfg, "head")

    def _ensure_migration_integrity(self, alembic_cfg):
        """기존 DB 마이그레이션 무결성 보장.

        - alembic_version이 없는 기존 DB: 마이그레이션이 IF NOT EXISTS이므로 그대로 실행
        - alembic_version이 있지만 테이블 누락: 리셋 후 재실행
        - 정상 상태: 그대로 통과
        """
        if self._db_path == ":memory:":
            return

        try:
            conn = sqlite3.connect(self._db_path)
            try:
                # alembic_version 테이블 확인
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' AND name='alembic_version'"
                )
                if not cursor.fetchone():
                    return  # alembic_version 없음 → upgrade가 처음부터 실행

                # 필수 테이블 존재 여부 확인
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
                )
                existing = {row[0] for row in cursor.fetchall()}

                required = {
                    "sessions", "messages", "file_changes", "events",
                    "global_settings", "mcp_servers", "tags", "session_tags",
                    "session_templates", "sessions_fts",
                }
                missing = required - existing
                if missing:
                    logger.warning(
                        "DB에 누락 테이블 감지 (%s): alembic_version 리셋",
                        ", ".join(sorted(missing)),
                    )
                    conn.execute("DELETE FROM alembic_version")
                    conn.commit()
            finally:
                conn.close()
        except Exception as e:
            logger.debug("마이그레이션 무결성 확인 중 예외 (새 DB일 수 있음): %s", e)

    async def _build_fts_index(self):
        """FTS5 초기 빌드: 비어있으면 기존 데이터로 채움."""
        fts_count = await self._db.execute("SELECT COUNT(*) FROM sessions_fts")
        fts_row = await fts_count.fetchone()
        if fts_row[0] == 0:
            msg_count = await self._db.execute("SELECT COUNT(*) FROM messages")
            msg_row = await msg_count.fetchone()
            if msg_row[0] > 0:
                await self._db.execute(
                    """INSERT INTO sessions_fts(session_id, name, content)
                       SELECT session_id, '', content FROM messages"""
                )
                await self._db.execute(
                    """INSERT INTO sessions_fts(session_id, name, content)
                       SELECT id, name, '' FROM sessions
                       WHERE name IS NOT NULL AND name != ''"""
                )
                logger.info("FTS5 초기 빌드 완료")
            await self._db.commit()

    async def close(self):
        """DB 연결 종료."""
        if self._read_db:
            await self._read_db.close()
            self._read_db = None
        if self._db:
            await self._db.close()
            self._db = None
            logger.info("데이터베이스 연결 종료")

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("데이터베이스가 초기화되지 않았습니다")
        return self._db

    @property
    def read_conn(self) -> aiosqlite.Connection:
        """읽기 전용 연결. 초기화 전에는 쓰기 연결을 fallback으로 사용."""
        if self._read_db is not None:
            return self._read_db
        return self.conn

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
        mcp_server_ids: str | None = None,
        auto_commit: bool = True,
    ) -> dict:
        await self.conn.execute(
            """INSERT INTO sessions (id, work_dir, status, created_at, allowed_tools, system_prompt, timeout_seconds, mode, permission_mode, permission_required_tools,
                                    model, max_turns, max_budget_usd, system_prompt_mode, disallowed_tools, mcp_server_ids)
               VALUES (?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                mcp_server_ids,
            ),
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_session(session_id)

    async def get_session(self, session_id: str) -> dict | None:
        cursor = await self.read_conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)

    async def list_sessions(self) -> list[dict]:
        cursor = await self.read_conn.execute(
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
        cursor = await self.read_conn.execute(
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
        cursor = await self.read_conn.execute(
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

    async def delete_session(self, session_id: str, auto_commit: bool = True) -> bool:
        cursor = await self.conn.execute(
            "DELETE FROM sessions WHERE id = ?", (session_id,)
        )
        if auto_commit:
            await self.conn.commit()
        return cursor.rowcount > 0

    async def update_session_status(
        self, session_id: str, status: str, auto_commit: bool = True
    ):
        await self.conn.execute(
            "UPDATE sessions SET status = ? WHERE id = ?", (status, session_id)
        )
        if auto_commit:
            await self.conn.commit()

    async def update_session_jsonl_path(
        self, session_id: str, jsonl_path: str, auto_commit: bool = True
    ):
        """세션의 JSONL 파일 경로 업데이트."""
        await self.conn.execute(
            "UPDATE sessions SET jsonl_path = ? WHERE id = ?", (jsonl_path, session_id)
        )
        if auto_commit:
            await self.conn.commit()

    async def get_session_jsonl_path(self, session_id: str) -> str | None:
        """세션의 JSONL 파일 경로 조회."""
        cursor = await self.conn.execute(
            "SELECT jsonl_path FROM sessions WHERE id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        return row[0] if row else None

    async def update_claude_session_id(
        self, session_id: str, claude_session_id: str, auto_commit: bool = True
    ):
        await self.conn.execute(
            "UPDATE sessions SET claude_session_id = ? WHERE id = ?",
            (claude_session_id, session_id),
        )
        if auto_commit:
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
        mcp_server_ids: str | None = None,
        auto_commit: bool = True,
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
        if mcp_server_ids is not None:
            fields.append("mcp_server_ids = ?")
            values.append(mcp_server_ids)
        if not fields:
            return await self.get_session(session_id)
        values.append(session_id)
        await self.conn.execute(
            f"UPDATE sessions SET {', '.join(fields)} WHERE id = ?", values
        )
        if auto_commit:
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
        auto_commit: bool = True,
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
        if auto_commit:
            await self.conn.commit()

    async def add_messages_batch(
        self,
        messages: list[tuple],
    ):
        """메시지 배치 저장. messages: [(session_id, role, content, timestamp, cost, duration_ms, is_error, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, model), ...]"""
        await self.conn.executemany(
            """INSERT INTO messages (session_id, role, content, timestamp, cost, duration_ms,
                                    is_error, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, model)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            messages,
        )
        await self.conn.commit()

    async def get_messages(self, session_id: str) -> list[dict]:
        cursor = await self.read_conn.execute(
            """SELECT role, content, cost, duration_ms, timestamp,
                      is_error, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, model
               FROM messages WHERE session_id = ? ORDER BY id""",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_message_count(self, session_id: str) -> int:
        cursor = await self.read_conn.execute(
            "SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?",
            (session_id,),
        )
        row = await cursor.fetchone()
        return row["cnt"] if row else 0

    # --- File Changes ---

    async def add_file_change(
        self,
        session_id: str,
        tool: str,
        file: str,
        timestamp: str,
        auto_commit: bool = True,
    ):
        await self.conn.execute(
            """INSERT INTO file_changes (session_id, tool, file, timestamp)
               VALUES (?, ?, ?, ?)""",
            (session_id, tool, file, timestamp),
        )
        if auto_commit:
            await self.conn.commit()

    async def get_file_changes(self, session_id: str) -> list[dict]:
        cursor = await self.read_conn.execute(
            "SELECT tool, file, timestamp FROM file_changes WHERE session_id = ? ORDER BY id",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_file_changes_count(self, session_id: str) -> int:
        cursor = await self.read_conn.execute(
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
        auto_commit: bool = True,
    ):
        await self.conn.execute(
            """INSERT INTO events (session_id, seq, event_type, payload, timestamp)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, seq, event_type, payload, timestamp),
        )
        if auto_commit:
            await self.conn.commit()

    async def add_events_batch(
        self, events: list[tuple[str, int, str, str, str]], auto_commit: bool = True
    ):
        """이벤트 배치 저장. events: [(session_id, seq, event_type, payload, timestamp), ...]"""
        await self.conn.executemany(
            """INSERT INTO events (session_id, seq, event_type, payload, timestamp)
               VALUES (?, ?, ?, ?, ?)""",
            events,
        )
        if auto_commit:
            await self.conn.commit()

    async def get_events_after(self, session_id: str, after_seq: int) -> list[dict]:
        cursor = await self.read_conn.execute(
            "SELECT seq, event_type, payload, timestamp FROM events WHERE session_id = ? AND seq > ? ORDER BY seq",
            (session_id, after_seq),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_all_events(self, session_id: str) -> list[dict]:
        cursor = await self.read_conn.execute(
            "SELECT seq, event_type, payload, timestamp FROM events WHERE session_id = ? ORDER BY seq",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_current_turn_events(self, session_id: str) -> list[dict]:
        """DB에서 마지막 user_message 이후의 턴 이벤트를 조회."""
        cursor = await self.read_conn.execute(
            "SELECT MAX(seq) as last_seq FROM events "
            "WHERE session_id = ? AND event_type = 'user_message'",
            (session_id,),
        )
        row = await cursor.fetchone()
        last_user_seq = row["last_seq"] if row and row["last_seq"] else 0

        if last_user_seq == 0:
            return []

        cursor = await self.read_conn.execute(
            "SELECT seq, event_type, payload, timestamp FROM events "
            "WHERE session_id = ? AND seq > ? ORDER BY seq",
            (session_id, last_user_seq),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def delete_messages(self, session_id: str, auto_commit: bool = True):
        """세션의 모든 메시지 삭제."""
        await self.conn.execute(
            "DELETE FROM messages WHERE session_id = ?", (session_id,)
        )
        if auto_commit:
            await self.conn.commit()

    async def delete_file_changes(self, session_id: str, auto_commit: bool = True):
        """세션의 모든 파일 변경 기록 삭제."""
        await self.conn.execute(
            "DELETE FROM file_changes WHERE session_id = ?", (session_id,)
        )
        if auto_commit:
            await self.conn.commit()

    async def delete_events(self, session_id: str, auto_commit: bool = True):
        await self.conn.execute(
            "DELETE FROM events WHERE session_id = ?", (session_id,)
        )
        if auto_commit:
            await self.conn.commit()

    async def get_max_seq_per_session(self) -> dict[str, int]:
        """세션별 최대 seq 번호 조회 (서버 재시작 시 seq 카운터 복원용)."""
        cursor = await self.read_conn.execute(
            "SELECT session_id, MAX(seq) as max_seq FROM events GROUP BY session_id"
        )
        rows = await cursor.fetchall()
        return {row["session_id"]: row["max_seq"] for row in rows}

    async def cleanup_old_events(
        self, max_age_hours: int = 24, auto_commit: bool = True
    ):
        """지정 시간 이전의 이벤트 삭제."""
        cursor = await self.conn.execute(
            "DELETE FROM events WHERE timestamp < datetime('now', ?)",
            (f"-{max_age_hours} hours",),
        )
        if auto_commit:
            await self.conn.commit()
        if cursor.rowcount > 0:
            logger.info(
                "오래된 이벤트 %d건 삭제 (기준: %d시간)", cursor.rowcount, max_age_hours
            )

    async def find_session_by_claude_id(self, claude_session_id: str) -> dict | None:
        """claude_session_id로 세션 조회."""
        cursor = await self.read_conn.execute(
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
        cursor = await self.read_conn.execute(
            "SELECT * FROM global_settings WHERE id = 'default'"
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    # ── MCP 서버 CRUD ────────────────────────────────────────

    async def create_mcp_server(
        self,
        server_id: str,
        name: str,
        transport_type: str,
        created_at: str,
        command: str | None = None,
        args: str | None = None,
        url: str | None = None,
        headers: str | None = None,
        env: str | None = None,
        enabled: bool = True,
        source: str = "manual",
        auto_commit: bool = True,
    ) -> dict:
        await self.conn.execute(
            """INSERT INTO mcp_servers (id, name, transport_type, command, args, url, headers, env, enabled, source, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                server_id, name, transport_type, command, args, url, headers, env,
                int(enabled), source, created_at, created_at,
            ),
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_mcp_server(server_id)

    async def get_mcp_server(self, server_id: str) -> dict | None:
        cursor = await self.read_conn.execute(
            "SELECT * FROM mcp_servers WHERE id = ?", (server_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def get_mcp_server_by_name(self, name: str) -> dict | None:
        cursor = await self.read_conn.execute(
            "SELECT * FROM mcp_servers WHERE name = ?", (name,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def list_mcp_servers(self) -> list[dict]:
        cursor = await self.read_conn.execute(
            "SELECT * FROM mcp_servers ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def update_mcp_server(
        self,
        server_id: str,
        updated_at: str,
        name: str | None = None,
        transport_type: str | None = None,
        command: str | None = None,
        args: str | None = None,
        url: str | None = None,
        headers: str | None = None,
        env: str | None = None,
        enabled: bool | None = None,
        auto_commit: bool = True,
    ) -> dict | None:
        fields = ["updated_at = ?"]
        values: list = [updated_at]
        if name is not None:
            fields.append("name = ?")
            values.append(name)
        if transport_type is not None:
            fields.append("transport_type = ?")
            values.append(transport_type)
        if command is not None:
            fields.append("command = ?")
            values.append(command)
        if args is not None:
            fields.append("args = ?")
            values.append(args)
        if url is not None:
            fields.append("url = ?")
            values.append(url)
        if headers is not None:
            fields.append("headers = ?")
            values.append(headers)
        if env is not None:
            fields.append("env = ?")
            values.append(env)
        if enabled is not None:
            fields.append("enabled = ?")
            values.append(int(enabled))
        values.append(server_id)
        await self.conn.execute(
            f"UPDATE mcp_servers SET {', '.join(fields)} WHERE id = ?", values
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_mcp_server(server_id)

    async def delete_mcp_server(self, server_id: str, auto_commit: bool = True) -> bool:
        cursor = await self.conn.execute(
            "DELETE FROM mcp_servers WHERE id = ?", (server_id,)
        )
        if auto_commit:
            await self.conn.commit()
        return cursor.rowcount > 0

    async def get_mcp_servers_by_ids(self, ids: list[str]) -> list[dict]:
        if not ids:
            return []
        placeholders = ",".join("?" for _ in ids)
        cursor = await self.read_conn.execute(
            f"SELECT * FROM mcp_servers WHERE id IN ({placeholders})", ids
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

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
        mcp_server_ids: str | None = None,
        auto_commit: bool = True,
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
        if mcp_server_ids is not None:
            fields.append("mcp_server_ids = ?")
            values.append(mcp_server_ids)
        if not fields:
            return await self.get_global_settings()
        values.append("default")
        await self.conn.execute(
            f"UPDATE global_settings SET {', '.join(fields)} WHERE id = ?", values
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_global_settings()

    # ── 세션 템플릿 CRUD ──────────────────────────────────────

    async def create_template(
        self,
        template_id: str,
        name: str,
        created_at: str,
        description: str | None = None,
        work_dir: str | None = None,
        system_prompt: str | None = None,
        allowed_tools: str | None = None,
        disallowed_tools: str | None = None,
        timeout_seconds: int | None = None,
        mode: str = "normal",
        permission_mode: bool = False,
        permission_required_tools: str | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str = "replace",
        mcp_server_ids: str | None = None,
        auto_commit: bool = True,
    ) -> dict:
        await self.conn.execute(
            """INSERT INTO session_templates
               (id, name, description, work_dir, system_prompt, allowed_tools, disallowed_tools,
                timeout_seconds, mode, permission_mode, permission_required_tools,
                model, max_turns, max_budget_usd, system_prompt_mode, mcp_server_ids,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                template_id, name, description, work_dir, system_prompt,
                allowed_tools, disallowed_tools, timeout_seconds, mode,
                int(permission_mode), permission_required_tools,
                model, max_turns, max_budget_usd, system_prompt_mode, mcp_server_ids,
                created_at, created_at,
            ),
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_template(template_id)

    async def get_template(self, template_id: str) -> dict | None:
        cursor = await self.read_conn.execute(
            "SELECT * FROM session_templates WHERE id = ?", (template_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def get_template_by_name(self, name: str) -> dict | None:
        cursor = await self.read_conn.execute(
            "SELECT * FROM session_templates WHERE name = ?", (name,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def list_templates(self) -> list[dict]:
        cursor = await self.read_conn.execute(
            "SELECT * FROM session_templates ORDER BY updated_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def update_template(
        self,
        template_id: str,
        updated_at: str,
        name: str | None = None,
        description: str | None = None,
        work_dir: str | None = None,
        system_prompt: str | None = None,
        allowed_tools: str | None = None,
        disallowed_tools: str | None = None,
        timeout_seconds: int | None = None,
        mode: str | None = None,
        permission_mode: bool | None = None,
        permission_required_tools: str | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str | None = None,
        mcp_server_ids: str | None = None,
        auto_commit: bool = True,
    ) -> dict | None:
        fields = ["updated_at = ?"]
        values: list = [updated_at]
        if name is not None:
            fields.append("name = ?")
            values.append(name)
        if description is not None:
            fields.append("description = ?")
            values.append(description)
        if work_dir is not None:
            fields.append("work_dir = ?")
            values.append(work_dir)
        if system_prompt is not None:
            fields.append("system_prompt = ?")
            values.append(system_prompt)
        if allowed_tools is not None:
            fields.append("allowed_tools = ?")
            values.append(allowed_tools)
        if disallowed_tools is not None:
            fields.append("disallowed_tools = ?")
            values.append(disallowed_tools)
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
        if mcp_server_ids is not None:
            fields.append("mcp_server_ids = ?")
            values.append(mcp_server_ids)
        values.append(template_id)
        await self.conn.execute(
            f"UPDATE session_templates SET {', '.join(fields)} WHERE id = ?", values
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_template(template_id)

    async def delete_template(self, template_id: str, auto_commit: bool = True) -> bool:
        cursor = await self.conn.execute(
            "DELETE FROM session_templates WHERE id = ?", (template_id,)
        )
        if auto_commit:
            await self.conn.commit()
        return cursor.rowcount > 0

    # ── 토큰 분석 (Analytics) ──────────────────────────────────

    async def get_analytics_summary(self, start: str, end: str) -> dict:
        """기간 내 전체 토큰 요약 통계."""
        cursor = await self.read_conn.execute(
            """SELECT
                  COUNT(*) as total_messages,
                  COALESCE(SUM(input_tokens), 0) as total_input_tokens,
                  COALESCE(SUM(output_tokens), 0) as total_output_tokens,
                  COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens,
                  COALESCE(SUM(cache_creation_tokens), 0) as total_cache_creation_tokens,
                  COUNT(DISTINCT session_id) as total_sessions
               FROM messages
               WHERE role = 'assistant'
                 AND timestamp >= ? AND timestamp < ?""",
            (start, end),
        )
        row = await cursor.fetchone()
        return dict(row) if row else {}

    async def get_daily_token_usage(self, start: str, end: str) -> list[dict]:
        """일별 토큰 사용량."""
        cursor = await self.read_conn.execute(
            """SELECT
                  DATE(timestamp) as date,
                  COALESCE(SUM(input_tokens), 0) as input_tokens,
                  COALESCE(SUM(output_tokens), 0) as output_tokens,
                  COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
                  COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
                  COUNT(DISTINCT session_id) as active_sessions
               FROM messages
               WHERE role = 'assistant'
                 AND timestamp >= ? AND timestamp < ?
               GROUP BY DATE(timestamp)
               ORDER BY date ASC""",
            (start, end),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_session_token_ranking(
        self, start: str, end: str, limit: int = 20
    ) -> list[dict]:
        """세션별 토큰 사용량 랭킹."""
        cursor = await self.read_conn.execute(
            """SELECT
                  m.session_id,
                  s.name as session_name,
                  s.work_dir,
                  COALESCE(SUM(m.input_tokens), 0) as input_tokens,
                  COALESCE(SUM(m.output_tokens), 0) as output_tokens,
                  (COALESCE(SUM(m.input_tokens), 0) + COALESCE(SUM(m.output_tokens), 0)) as total_tokens,
                  COUNT(*) as message_count,
                  (SELECT model FROM messages
                   WHERE session_id = m.session_id AND model IS NOT NULL
                   GROUP BY model ORDER BY COUNT(*) DESC LIMIT 1) as model
               FROM messages m
               JOIN sessions s ON m.session_id = s.id
               WHERE m.role = 'assistant'
                 AND m.timestamp >= ? AND m.timestamp < ?
               GROUP BY m.session_id
               ORDER BY total_tokens DESC
               LIMIT ?""",
            (start, end, limit),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_project_token_usage(self, start: str, end: str) -> list[dict]:
        """프로젝트(work_dir)별 토큰 사용량."""
        cursor = await self.read_conn.execute(
            """SELECT
                  s.work_dir,
                  COALESCE(SUM(m.input_tokens), 0) as input_tokens,
                  COALESCE(SUM(m.output_tokens), 0) as output_tokens,
                  COALESCE(SUM(m.cache_read_tokens), 0) as cache_read_tokens,
                  COALESCE(SUM(m.cache_creation_tokens), 0) as cache_creation_tokens,
                  COUNT(DISTINCT m.session_id) as session_count
               FROM messages m
               JOIN sessions s ON m.session_id = s.id
               WHERE m.role = 'assistant'
                 AND m.timestamp >= ? AND m.timestamp < ?
               GROUP BY s.work_dir
               ORDER BY (COALESCE(SUM(m.input_tokens), 0) + COALESCE(SUM(m.output_tokens), 0)) DESC""",
            (start, end),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    # ── 태그 CRUD ──────────────────────────────────────────────

    async def create_tag(
        self,
        tag_id: str,
        name: str,
        color: str,
        created_at: str,
        auto_commit: bool = True,
    ) -> dict:
        await self.conn.execute(
            "INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
            (tag_id, name, color, created_at),
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_tag(tag_id)

    async def get_tag(self, tag_id: str) -> dict | None:
        cursor = await self.read_conn.execute(
            "SELECT * FROM tags WHERE id = ?", (tag_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def get_tag_by_name(self, name: str) -> dict | None:
        cursor = await self.read_conn.execute(
            "SELECT * FROM tags WHERE name = ?", (name,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def list_tags(self) -> list[dict]:
        cursor = await self.read_conn.execute(
            "SELECT * FROM tags ORDER BY name ASC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def update_tag(
        self,
        tag_id: str,
        name: str | None = None,
        color: str | None = None,
        auto_commit: bool = True,
    ) -> dict | None:
        fields = []
        values: list = []
        if name is not None:
            fields.append("name = ?")
            values.append(name)
        if color is not None:
            fields.append("color = ?")
            values.append(color)
        if not fields:
            return await self.get_tag(tag_id)
        values.append(tag_id)
        await self.conn.execute(
            f"UPDATE tags SET {', '.join(fields)} WHERE id = ?", values
        )
        if auto_commit:
            await self.conn.commit()
        return await self.get_tag(tag_id)

    async def delete_tag(self, tag_id: str, auto_commit: bool = True) -> bool:
        cursor = await self.conn.execute(
            "DELETE FROM tags WHERE id = ?", (tag_id,)
        )
        if auto_commit:
            await self.conn.commit()
        return cursor.rowcount > 0

    # ── 세션-태그 연결 ─────────────────────────────────────────

    async def add_session_tag(
        self,
        session_id: str,
        tag_id: str,
        created_at: str,
        auto_commit: bool = True,
    ):
        await self.conn.execute(
            "INSERT OR IGNORE INTO session_tags (session_id, tag_id, created_at) VALUES (?, ?, ?)",
            (session_id, tag_id, created_at),
        )
        if auto_commit:
            await self.conn.commit()

    async def remove_session_tag(
        self, session_id: str, tag_id: str, auto_commit: bool = True
    ) -> bool:
        cursor = await self.conn.execute(
            "DELETE FROM session_tags WHERE session_id = ? AND tag_id = ?",
            (session_id, tag_id),
        )
        if auto_commit:
            await self.conn.commit()
        return cursor.rowcount > 0

    async def get_session_tags(self, session_id: str) -> list[dict]:
        cursor = await self.read_conn.execute(
            """SELECT t.id, t.name, t.color
               FROM tags t
               JOIN session_tags st ON st.tag_id = t.id
               WHERE st.session_id = ?
               ORDER BY t.name ASC""",
            (session_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_tags_for_sessions(self, session_ids: list[str]) -> dict[str, list[dict]]:
        """여러 세션의 태그를 배치 조회 (N+1 방지)."""
        if not session_ids:
            return {}
        placeholders = ",".join("?" for _ in session_ids)
        cursor = await self.read_conn.execute(
            f"""SELECT st.session_id, t.id, t.name, t.color
                FROM session_tags st
                JOIN tags t ON t.id = st.tag_id
                WHERE st.session_id IN ({placeholders})
                ORDER BY t.name ASC""",
            session_ids,
        )
        rows = await cursor.fetchall()
        result: dict[str, list[dict]] = {sid: [] for sid in session_ids}
        for row in rows:
            r = dict(row)
            sid = r.pop("session_id")
            result[sid].append(r)
        return result

    # ── FTS5 전문 검색 ─────────────────────────────────────────

    async def fts_search(
        self, query: str, limit: int = 50, offset: int = 0
    ) -> dict:
        """FTS5로 세션 전문 검색.

        Returns:
            dict: { session_ids: list[str], total: int }
        """
        # unicode61 prefix match: 쿼리 끝에 * 추가
        fts_query = " ".join(
            f"{term}*" if not term.endswith("*") else term
            for term in query.split()
            if term.strip()
        )
        if not fts_query:
            return {"session_ids": [], "total": 0}

        # 매치된 세션 ID (중복 제거, rank 순)
        count_cursor = await self.read_conn.execute(
            """SELECT COUNT(DISTINCT session_id) FROM sessions_fts
               WHERE sessions_fts MATCH ?""",
            (fts_query,),
        )
        count_row = await count_cursor.fetchone()
        total = count_row[0] if count_row else 0

        cursor = await self.read_conn.execute(
            """SELECT DISTINCT session_id FROM sessions_fts
               WHERE sessions_fts MATCH ?
               ORDER BY rank
               LIMIT ? OFFSET ?""",
            (fts_query, limit, offset),
        )
        rows = await cursor.fetchall()
        session_ids = [row[0] for row in rows]

        return {"session_ids": session_ids, "total": total}
