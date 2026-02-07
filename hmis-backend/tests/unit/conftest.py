"""
Configuracion de pruebas especifica para tests unitarios.

Usa SQLite en memoria con StaticPool para garantizar que todos los tests
compartan la misma conexion (necesario para que la BD en memoria persista
dentro de cada test). Sobreescribe los fixtures del conftest raiz que
usan SQLite basado en archivo (propenso a errores de locking).
"""

from typing import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base


# Motor async SQLite en memoria con StaticPool (una sola conexion compartida).
# Esto evita los problemas de locking y "table already exists" del SQLite en archivo.
_unit_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_UnitSessionLocal = async_sessionmaker(
    _unit_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(autouse=True)
async def setup_database():
    """Crea las tablas antes de cada test y las destruye despues."""
    async with _unit_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _unit_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provee una sesion de base de datos limpia para tests unitarios."""
    async with _UnitSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
