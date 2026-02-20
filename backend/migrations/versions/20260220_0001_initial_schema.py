"""initial_schema

현재 database.py의 _SCHEMA + migrations + ddl_migrations + fts_triggers를
통합한 초기 마이그레이션.

기존 DB 사용자: database.py의 _stamp_existing_db_if_needed()가 자동으로
alembic stamp head를 수행하여 이 마이그레이션을 건너뛴다.
신규 DB: 이 마이그레이션으로 전체 스키마가 생성된다.

Revision ID: 0001
Revises:
Create Date: 2026-02-20
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Core 테이블 ───────────────────────────────────

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            claude_session_id TEXT,
            work_dir TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'idle',
            created_at TEXT NOT NULL,
            allowed_tools TEXT,
            system_prompt TEXT,
            timeout_seconds INTEGER,
            mode TEXT NOT NULL DEFAULT 'normal',
            permission_mode INTEGER NOT NULL DEFAULT 0,
            permission_required_tools TEXT,
            name TEXT,
            jsonl_path TEXT,
            model TEXT,
            max_turns INTEGER,
            max_budget_usd REAL,
            system_prompt_mode TEXT NOT NULL DEFAULT 'replace',
            disallowed_tools TEXT,
            mcp_server_ids TEXT
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            cost REAL,
            duration_ms INTEGER,
            timestamp TEXT NOT NULL,
            is_error INTEGER NOT NULL DEFAULT 0,
            input_tokens INTEGER,
            output_tokens INTEGER,
            cache_creation_tokens INTEGER,
            cache_read_tokens INTEGER,
            model TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS file_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            tool TEXT NOT NULL,
            file TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS global_settings (
            id TEXT PRIMARY KEY DEFAULT 'default',
            work_dir TEXT,
            allowed_tools TEXT,
            system_prompt TEXT,
            timeout_seconds INTEGER,
            mode TEXT DEFAULT 'normal',
            permission_mode INTEGER DEFAULT 0,
            permission_required_tools TEXT,
            model TEXT,
            max_turns INTEGER,
            max_budget_usd REAL,
            system_prompt_mode TEXT DEFAULT 'replace',
            disallowed_tools TEXT,
            mcp_server_ids TEXT
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            transport_type TEXT NOT NULL DEFAULT 'stdio',
            command TEXT,
            args TEXT,
            url TEXT,
            headers TEXT,
            env TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            color TEXT NOT NULL DEFAULT '#6366f1',
            created_at TEXT NOT NULL
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS session_tags (
            session_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (session_id, tag_id),
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
    """))

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS session_templates (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            work_dir TEXT,
            system_prompt TEXT,
            allowed_tools TEXT,
            disallowed_tools TEXT,
            timeout_seconds INTEGER,
            mode TEXT DEFAULT 'normal',
            permission_mode INTEGER NOT NULL DEFAULT 0,
            permission_required_tools TEXT,
            model TEXT,
            max_turns INTEGER,
            max_budget_usd REAL,
            system_prompt_mode TEXT DEFAULT 'replace',
            mcp_server_ids TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """))

    # ── 2. 인덱스 ────────────────────────────────────────

    op.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_file_changes_session_id ON file_changes(session_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_events_session_seq ON events(session_id, seq)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_sessions_claude_session_id ON sessions(claude_session_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_sessions_model ON sessions(model)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_sessions_work_dir ON sessions(work_dir)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_session_tags_tag_id ON session_tags(tag_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_session_tags_session_id ON session_tags(session_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp ON messages(session_id, timestamp)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_model ON messages(model)"))

    # ── 3. FTS5 가상 테이블 ──────────────────────────────

    op.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
            session_id UNINDEXED,
            name,
            content,
            tokenize='unicode61'
        )
    """))

    # ── 4. FTS5 트리거 ───────────────────────────────────

    op.execute(text("""
        CREATE TRIGGER IF NOT EXISTS trg_messages_fts_insert
        AFTER INSERT ON messages
        BEGIN
            INSERT INTO sessions_fts(session_id, name, content)
            VALUES (NEW.session_id, '', NEW.content);
        END
    """))

    op.execute(text("""
        CREATE TRIGGER IF NOT EXISTS trg_sessions_fts_name_update
        AFTER UPDATE OF name ON sessions
        WHEN NEW.name IS NOT NULL AND NEW.name != ''
        BEGIN
            DELETE FROM sessions_fts WHERE session_id = NEW.id AND content = '';
            INSERT OR REPLACE INTO sessions_fts(session_id, name, content)
            VALUES (NEW.id, NEW.name, '');
        END
    """))

    op.execute(text("""
        CREATE TRIGGER IF NOT EXISTS trg_sessions_fts_delete
        AFTER DELETE ON sessions
        BEGIN
            DELETE FROM sessions_fts WHERE session_id = OLD.id;
        END
    """))

    # ── 5. 글로벌 설정 기본 행 ────────────────────────────

    op.execute(text(
        "INSERT OR IGNORE INTO global_settings (id) VALUES ('default')"
    ))


def downgrade() -> None:
    # FTS 트리거 삭제
    op.execute(text("DROP TRIGGER IF EXISTS trg_sessions_fts_delete"))
    op.execute(text("DROP TRIGGER IF EXISTS trg_sessions_fts_name_update"))
    op.execute(text("DROP TRIGGER IF EXISTS trg_messages_fts_insert"))

    # FTS5 테이블 삭제
    op.execute(text("DROP TABLE IF EXISTS sessions_fts"))

    # 테이블 삭제 (FK 순서 고려: 자식 → 부모)
    op.execute(text("DROP TABLE IF EXISTS session_tags"))
    op.execute(text("DROP TABLE IF EXISTS session_templates"))
    op.execute(text("DROP TABLE IF EXISTS tags"))
    op.execute(text("DROP TABLE IF EXISTS mcp_servers"))
    op.execute(text("DROP TABLE IF EXISTS global_settings"))
    op.execute(text("DROP TABLE IF EXISTS events"))
    op.execute(text("DROP TABLE IF EXISTS file_changes"))
    op.execute(text("DROP TABLE IF EXISTS messages"))
    op.execute(text("DROP TABLE IF EXISTS sessions"))
