"""
Configuracion de Alembic para migraciones multi-schema.

Soporta dos modos de migracion:
1. Schema public: alembic upgrade head
2. Todos los tenant schemas: alembic -x tenant=all upgrade head
3. Un tenant especifico: alembic -x tenant=tenant_demo upgrade head

La variable -x tenant controla el comportamiento:
- Sin -x: solo schema public
- tenant=all: itera todos los schemas tenant_*
- tenant=nombre: solo ese schema
"""

import asyncio
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings
from app.core.database import Base

# Importar todos los modelos para que Alembic los detecte
from app.modules.auth.models import *  # noqa: F401,F403
from app.modules.patients.models import *  # noqa: F401,F403
from app.modules.appointments.models import *  # noqa: F401,F403
from app.modules.emr.models import *  # noqa: F401,F403
from app.modules.billing.models import *  # noqa: F401,F403
from app.modules.pharmacy.models import *  # noqa: F401,F403
from app.modules.reports.models import *  # noqa: F401,F403

logger = logging.getLogger("alembic.env")

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Migraciones en modo offline (genera SQL sin conectar)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection, schema: str | None = None):
    """Ejecuta migraciones en una conexion, opcionalmente en un schema."""
    if schema:
        logger.info("Migrando schema: %s", schema)
        connection.execute(text(f"SET search_path TO {schema}, public"))
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=schema,
            include_schemas=True,
        )
    else:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

    with context.begin_transaction():
        context.run_migrations()


async def _get_tenant_schemas(connection) -> list[str]:
    """Obtiene todos los schemas de tenants desde la base de datos."""
    result = await connection.execute(
        text(
            "SELECT schema_name FROM information_schema.schemata "
            "WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name"
        )
    )
    schemas = [row[0] for row in result]
    return schemas


async def run_async_migrations() -> None:
    """Migraciones en modo online (async) con soporte multi-tenant."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # Obtener parametro -x tenant=...
    tenant_arg = context.get_x_argument(as_dictionary=True).get("tenant")

    async with connectable.connect() as connection:
        if not tenant_arg:
            # Modo normal: solo schema public
            logger.info("Migrando schema public")
            await connection.run_sync(do_run_migrations)

        elif tenant_arg == "all":
            # Migrar public + todos los tenant schemas
            logger.info("Migrando schema public")
            await connection.run_sync(do_run_migrations)

            schemas = await _get_tenant_schemas(connection)
            logger.info("Encontrados %d schemas de tenant", len(schemas))
            for schema in schemas:
                await connection.run_sync(do_run_migrations, schema)

        else:
            # Migrar un tenant especifico
            await connection.run_sync(do_run_migrations, tenant_arg)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Punto de entrada para migraciones online."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
