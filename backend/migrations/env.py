"""Alembic 마이그레이션 환경 설정.

SQLAlchemy ORM 없이 op.execute(text(...)) 패턴으로 마이그레이션을 실행한다.

사용 컨텍스트:
1. CLI: `alembic upgrade head`
2. 앱 시작: database.py initialize() → run_in_executor로 별도 스레드에서 실행
3. 테스트: conftest.py → tmp_path 기반 파일 DB
"""

import logging
import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool, text

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")


def get_database_url() -> str:
    """DB URL을 동적으로 구성.

    우선순위:
    1. alembic.ini의 sqlalchemy.url (CLI -x 오버라이드 포함)
    2. Settings.database_path
    3. 환경변수 DATABASE_PATH
    4. 기본 경로 (backend/data/sessions.db)
    """
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url

    try:
        from app.core.config import Settings

        settings = Settings()
        db_path = settings.database_path
    except Exception:
        db_path = os.environ.get(
            "DATABASE_PATH",
            str(Path(__file__).resolve().parent.parent / "data" / "sessions.db"),
        )

    if db_path == ":memory:":
        return "sqlite://"

    return f"sqlite:///{db_path}"


def _apply_pragmas(connection) -> None:
    """SQLite PRAGMA 설정을 마이그레이션 전에 적용."""
    connection.execute(text("PRAGMA journal_mode=WAL"))
    connection.execute(text("PRAGMA foreign_keys=ON"))
    connection.execute(text("PRAGMA busy_timeout=5000"))


def run_migrations_offline() -> None:
    """오프라인 모드 (SQL 스크립트 출력)."""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=None,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """동기 컨텍스트에서 마이그레이션 실행."""
    context.configure(
        connection=connection,
        target_metadata=None,
        render_as_batch=True,
    )
    with context.begin_transaction():
        _apply_pragmas(connection)
        context.run_migrations()


def run_migrations_online() -> None:
    """온라인 모드 마이그레이션 실행.

    항상 동기 SQLite 엔진을 사용한다.
    앱 시작 시 run_in_executor로 별도 스레드에서 호출되므로
    동기 실행이 이벤트 루프를 블로킹하지 않는다.
    """
    url = get_database_url()
    # aiosqlite URL이 들어올 수 있으므로 동기 드라이버로 변환
    sync_url = url.replace("sqlite+aiosqlite", "sqlite")
    engine = create_engine(sync_url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        do_run_migrations(connection)
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
