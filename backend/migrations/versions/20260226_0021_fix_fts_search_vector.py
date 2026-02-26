"""fix_fts_search_vector

메시지 INSERT 시 search_vector가 최신 메시지만 반영되던 버그 수정.
모든 메시지를 집계(aggregate)하여 search_vector를 갱신하도록 트리거 함수 변경.
기존 세션의 search_vector도 재빌드.

Revision ID: 0021
Revises: 0020
Create Date: 2026-02-26
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 트리거 함수 교체: 모든 메시지를 집계하여 search_vector 갱신
    op.execute(
        text("""
        CREATE OR REPLACE FUNCTION update_session_search_on_message()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE sessions SET search_vector =
                setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
                setweight(to_tsvector('simple', COALESCE(work_dir, '')), 'B') ||
                setweight((
                    SELECT COALESCE(
                        string_agg(to_tsvector('simple', content)::text, ' ')::tsvector,
                        ''::tsvector
                    )
                    FROM messages WHERE session_id = NEW.session_id
                ), 'C')
            WHERE id = NEW.session_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    )

    # 2. 기존 세션의 search_vector 재빌드
    op.execute(
        text("""
        UPDATE sessions SET search_vector =
            setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
            setweight(to_tsvector('simple', COALESCE(work_dir, '')), 'B') ||
            setweight((
                SELECT COALESCE(
                    string_agg(to_tsvector('simple', content)::text, ' ')::tsvector,
                    ''::tsvector
                )
                FROM messages WHERE session_id = sessions.id
            ), 'C');
    """)
    )


def downgrade() -> None:
    # 원래 단일 메시지만 반영하는 버전으로 롤백
    op.execute(
        text("""
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
    """)
    )
