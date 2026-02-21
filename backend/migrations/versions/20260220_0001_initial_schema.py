"""initial_postgresql_schema

PostgreSQL 초기 스키마 마이그레이션.
SQLAlchemy ORM 모델 기반 + tsvector 트리거/함수 수동 추가.

Revision ID: 0001
Revises:
Create Date: 2026-02-20
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. sessions 테이블 ──────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("claude_session_id", sa.String(), nullable=True),
        sa.Column("work_dir", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="idle"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("allowed_tools", sa.Text(), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("timeout_seconds", sa.Integer(), nullable=True),
        sa.Column("mode", sa.String(), nullable=False, server_default="normal"),
        sa.Column("permission_mode", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("permission_required_tools", JSONB(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("jsonl_path", sa.Text(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("max_turns", sa.Integer(), nullable=True),
        sa.Column("max_budget_usd", sa.Float(), nullable=True),
        sa.Column("system_prompt_mode", sa.String(), nullable=False, server_default="replace"),
        sa.Column("disallowed_tools", sa.Text(), nullable=True),
        sa.Column("mcp_server_ids", JSONB(), nullable=True),
        sa.Column("search_vector", TSVECTOR(), nullable=True),
    )

    # ── 2. messages 테이블 ──────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("timestamp", sa.Text(), nullable=False),
        sa.Column("is_error", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("cache_creation_tokens", sa.Integer(), nullable=True),
        sa.Column("cache_read_tokens", sa.Integer(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
    )

    # ── 3. file_changes 테이블 ──────────────────────────────
    op.create_table(
        "file_changes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tool", sa.String(), nullable=False),
        sa.Column("file", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.Text(), nullable=False),
    )

    # ── 4. events 테이블 ────────────────────────────────────
    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("timestamp", sa.Text(), nullable=False),
    )

    # ── 5. global_settings 테이블 ───────────────────────────
    op.create_table(
        "global_settings",
        sa.Column("id", sa.String(), primary_key=True, server_default="default"),
        sa.Column("work_dir", sa.Text(), nullable=True),
        sa.Column("allowed_tools", sa.Text(), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("timeout_seconds", sa.Integer(), nullable=True),
        sa.Column("mode", sa.String(), nullable=True, server_default="normal"),
        sa.Column("permission_mode", sa.Boolean(), server_default="false"),
        sa.Column("permission_required_tools", JSONB(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("max_turns", sa.Integer(), nullable=True),
        sa.Column("max_budget_usd", sa.Float(), nullable=True),
        sa.Column("system_prompt_mode", sa.String(), nullable=True, server_default="replace"),
        sa.Column("disallowed_tools", sa.Text(), nullable=True),
        sa.Column("mcp_server_ids", JSONB(), nullable=True),
    )

    # ── 6. mcp_servers 테이블 ───────────────────────────────
    op.create_table(
        "mcp_servers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), unique=True, nullable=False),
        sa.Column("transport_type", sa.String(), nullable=False, server_default="stdio"),
        sa.Column("command", sa.Text(), nullable=True),
        sa.Column("args", JSONB(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("headers", JSONB(), nullable=True),
        sa.Column("env", JSONB(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("source", sa.String(), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )

    # ── 7. tags 테이블 ──────────────────────────────────────
    op.create_table(
        "tags",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), unique=True, nullable=False),
        sa.Column("color", sa.String(), nullable=False, server_default="#6366f1"),
        sa.Column("created_at", sa.Text(), nullable=False),
    )

    # ── 8. session_tags 테이블 ──────────────────────────────
    op.create_table(
        "session_tags",
        sa.Column("session_id", sa.String(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.String(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )

    # ── 9. session_templates 테이블 ─────────────────────────
    op.create_table(
        "session_templates",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), unique=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("work_dir", sa.Text(), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("allowed_tools", sa.Text(), nullable=True),
        sa.Column("disallowed_tools", sa.Text(), nullable=True),
        sa.Column("timeout_seconds", sa.Integer(), nullable=True),
        sa.Column("mode", sa.String(), server_default="normal"),
        sa.Column("permission_mode", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("permission_required_tools", JSONB(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("max_turns", sa.Integer(), nullable=True),
        sa.Column("max_budget_usd", sa.Float(), nullable=True),
        sa.Column("system_prompt_mode", sa.String(), server_default="replace"),
        sa.Column("mcp_server_ids", JSONB(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )

    # ── 10. 인덱스 ──────────────────────────────────────────
    op.create_index("idx_sessions_created_at", "sessions", ["created_at"])
    op.create_index("idx_sessions_claude_session_id", "sessions", ["claude_session_id"])
    op.create_index("idx_sessions_status", "sessions", ["status"])
    op.create_index("idx_sessions_model", "sessions", ["model"])
    op.create_index("idx_sessions_work_dir", "sessions", ["work_dir"])
    op.create_index("idx_sessions_search_vector", "sessions", ["search_vector"], postgresql_using="gin")

    op.create_index("idx_messages_session_id", "messages", ["session_id"])
    op.create_index("idx_messages_session_timestamp", "messages", ["session_id", "timestamp"])
    op.create_index("idx_messages_timestamp", "messages", ["timestamp"])
    op.create_index("idx_messages_model", "messages", ["model"])

    op.create_index("idx_file_changes_session_id", "file_changes", ["session_id"])

    op.create_index("idx_events_session_seq", "events", ["session_id", "seq"])
    op.create_index("idx_events_timestamp", "events", ["timestamp"])

    op.create_index("idx_session_tags_tag_id", "session_tags", ["tag_id"])
    op.create_index("idx_session_tags_session_id", "session_tags", ["session_id"])

    # ── 11. tsvector 트리거/함수 (FTS5 대체) ────────────────

    # sessions의 search_vector 갱신 함수
    op.execute(text("""
        CREATE OR REPLACE FUNCTION update_session_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
                setweight(to_tsvector('simple', COALESCE(NEW.work_dir, '')), 'B');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))

    op.execute(text("""
        CREATE TRIGGER trg_sessions_search_vector
        BEFORE INSERT OR UPDATE OF name, work_dir ON sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_session_search_vector();
    """))

    # messages INSERT 시 부모 session의 search_vector 갱신
    op.execute(text("""
        CREATE OR REPLACE FUNCTION update_session_search_on_message()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE sessions SET search_vector =
                setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
                setweight(to_tsvector('simple', COALESCE(work_dir, '')), 'B') ||
                setweight(to_tsvector('simple', NEW.content), 'C')
            WHERE id = NEW.session_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))

    op.execute(text("""
        CREATE TRIGGER trg_messages_search_vector
        AFTER INSERT ON messages
        FOR EACH ROW
        EXECUTE FUNCTION update_session_search_on_message();
    """))

    # ── 12. 글로벌 설정 기본 행 ─────────────────────────────
    op.execute(text(
        "INSERT INTO global_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING"
    ))


def downgrade() -> None:
    # 트리거/함수 삭제
    op.execute(text("DROP TRIGGER IF EXISTS trg_messages_search_vector ON messages"))
    op.execute(text("DROP FUNCTION IF EXISTS update_session_search_on_message"))
    op.execute(text("DROP TRIGGER IF EXISTS trg_sessions_search_vector ON sessions"))
    op.execute(text("DROP FUNCTION IF EXISTS update_session_search_vector"))

    # 테이블 삭제 (FK 순서: 자식 -> 부모)
    op.drop_table("session_tags")
    op.drop_table("session_templates")
    op.drop_table("tags")
    op.drop_table("mcp_servers")
    op.drop_table("global_settings")
    op.drop_table("events")
    op.drop_table("file_changes")
    op.drop_table("messages")
    op.drop_table("sessions")
