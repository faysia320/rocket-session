"""Alembic 마이그레이션 환경 설정 (PostgreSQL + SQLAlchemy ORM).

사용 컨텍스트:
1. CLI: `alembic upgrade head`
2. 앱 시작: database.py initialize() -> run_in_executor로 별도 스레드에서 실행
3. 테스트: testcontainers PostgreSQL
"""

import logging
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# autogenerate 지원: Base.metadata 참조
target_metadata = Base.metadata


def get_database_url() -> str:
    """DB URL을 동적으로 구성.

    우선순위:
    1. alembic.ini의 sqlalchemy.url (CLI -x 오버라이드 포함)
    2. Settings.database_url
    3. 환경변수 DATABASE_URL
    4. 기본 PostgreSQL URL
    """
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url

    try:
        from app.core.config import Settings

        settings = Settings()
        return settings.sync_database_url
    except Exception:
        return os.environ.get(
            "DATABASE_URL",
            "postgresql+psycopg2://rocket:rocket_secret@localhost:5432/rocket_session",
        )


def run_migrations_offline() -> None:
    """오프라인 모드 (SQL 스크립트 출력)."""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """온라인 모드 마이그레이션 실행."""
    url = get_database_url()

    # asyncpg URL이 들어올 수 있으므로 동기 드라이버로 변환
    sync_url = url.replace("postgresql+asyncpg", "postgresql+psycopg2")
    if sync_url.startswith("postgresql://") and "+psycopg2" not in sync_url:
        sync_url = sync_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    engine = create_engine(sync_url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
