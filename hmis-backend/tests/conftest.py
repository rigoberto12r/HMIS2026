"""
Configuracion de pruebas para el backend HMIS.
Fixtures compartidos para todos los tests.
"""

import asyncio
import uuid
from datetime import date, datetime, timezone
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.main import app


# Base de datos de prueba en memoria (SQLite async)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    """Crea un event loop para toda la sesion de tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_database():
    """Crea las tablas antes de cada test y las limpia despues."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override de la dependencia de base de datos para tests."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Cliente HTTP async para tests de API."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_headers() -> dict:
    """Headers de autenticacion con token JWT de prueba."""
    token = create_access_token({
        "sub": str(uuid.uuid4()),
        "email": "test@hmis.app",
        "tenant_id": "tenant_demo",
        "roles": ["admin"],
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "tenant_demo",
    }


@pytest.fixture
def sample_patient_data() -> dict:
    """Datos de ejemplo para crear un paciente."""
    return {
        "document_type": "cedula",
        "document_number": "00112345678",
        "first_name": "Juan",
        "last_name": "Perez",
        "second_last_name": "Garcia",
        "birth_date": "1985-03-15",
        "gender": "M",
        "blood_type": "O+",
        "phone": "809-555-0100",
        "mobile_phone": "829-555-0200",
        "email": "juan.perez@email.com",
        "address_line1": "Calle Principal #123",
        "city": "Santo Domingo",
        "state_province": "Distrito Nacional",
        "country": "DO",
        "emergency_contact_name": "Maria Perez",
        "emergency_contact_phone": "809-555-0300",
        "emergency_contact_relationship": "esposa",
        "insurance_policies": [
            {
                "insurer_name": "ARS Humano",
                "policy_number": "HUM-123456",
                "plan_type": "Contributivo",
                "coverage_start": "2025-01-01",
                "copay_percentage": 20.0,
                "is_primary": True,
            }
        ],
    }
