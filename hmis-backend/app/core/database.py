"""
Configuracion de base de datos PostgreSQL con soporte multi-tenant.
Usa SQLAlchemy 2.0 async con patron de schema por tenant.
"""

from contextvars import ContextVar
from typing import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Variable de contexto para el tenant actual (aislada por request)
current_tenant: ContextVar[str | None] = ContextVar("current_tenant", default=None)

# Motor async de SQLAlchemy
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
)

# Fabrica de sesiones async
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Clase base para todos los modelos SQLAlchemy del sistema."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency de FastAPI que provee una sesion de base de datos.
    Automaticamente establece el search_path al schema del tenant actual.
    """
    async with AsyncSessionLocal() as session:
        tenant_schema = current_tenant.get()
        if tenant_schema:
            # Establecer search_path al schema del tenant
            await session.execute(
                text(f"SET search_path TO {tenant_schema}, public")
            )
        else:
            await session.execute(text("SET search_path TO public"))

        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tenant_schema(schema_name: str) -> None:
    """
    Crea un nuevo schema para un tenant y las tablas necesarias.
    Se ejecuta durante el onboarding de un nuevo hospital.
    """
    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
        await conn.execute(text(f"SET search_path TO {schema_name}"))
        # Las tablas se crean con Alembic migrations
        await conn.commit()


async def drop_tenant_schema(schema_name: str) -> None:
    """Elimina el schema de un tenant (usar con precaucion)."""
    async with engine.begin() as conn:
        await conn.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE"))
        await conn.commit()
