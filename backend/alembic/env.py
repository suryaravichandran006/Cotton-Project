"""Alembic environment: uses DATABASE_URL from backend settings and the ORM metadata."""

from __future__ import annotations

from logging.config import fileConfig

from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

from backend.app import db_models  # noqa: F401 - register tables on Base.metadata
from backend.app.config import get_settings
from backend.app.database import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
if settings.is_sqlite:
    db_file = settings.database_url.replace("sqlite:///", "", 1)
    if db_file and db_file != ":memory:":
        Path(db_file).parent.mkdir(parents=True, exist_ok=True)
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}, render_as_batch=settings.is_sqlite
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=settings.is_sqlite)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
