"""
Configuracion de pruebas para el backend HMIS.
Fixtures compartidos para todos los tests.

Resuelve problemas de compatibilidad:
- Lifespan de la app (PostgreSQL/Redis) se reemplaza con no-op para tests
- SQLite se usa como base de datos en memoria para tests de integracion
- Redis (eventos) se mockea para evitar dependencia externa
"""

import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password


# =============================================
# Base de datos de prueba (SQLite async en memoria)
# =============================================

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# =============================================
# Event loop para toda la sesion
# =============================================

@pytest.fixture(scope="session")
def event_loop():
    """Crea un event loop para toda la sesion de tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# =============================================
# Setup de base de datos (crea/destruye tablas por test)
# =============================================

@pytest.fixture(autouse=True)
async def setup_database():
    """Crea las tablas antes de cada test y las limpia despues."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# =============================================
# Override de dependencia de base de datos
# =============================================

async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override de la dependencia de base de datos para tests."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# =============================================
# Sesion de BD para tests unitarios
# =============================================

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provee una sesion de base de datos limpia para tests unitarios."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# =============================================
# Aplicacion de prueba (sin lifespan real)
# =============================================

@asynccontextmanager
async def test_lifespan(app):
    """Lifespan de prueba que no conecta a PostgreSQL ni Redis."""
    yield


def create_test_app():
    """
    Crea una instancia de la app FastAPI con lifespan de prueba.
    Monkey-patch el lifespan antes de crear la app para evitar
    conexiones a PostgreSQL y Redis.
    """
    import app.main as main_module

    original_lifespan = main_module.lifespan
    main_module.lifespan = test_lifespan
    test_app = main_module.create_app()
    main_module.lifespan = original_lifespan  # restaurar original

    # Override de la dependencia de BD
    test_app.dependency_overrides[get_db] = override_get_db

    return test_app


# Instancia global de la app de prueba
_test_app = create_test_app()


# =============================================
# Cliente HTTP async para tests de integracion
# =============================================

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Cliente HTTP async para tests de API."""
    transport = ASGITransport(app=_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# =============================================
# Fixtures de autenticacion
# =============================================

@pytest.fixture
def auth_headers() -> dict:
    """Headers de autenticacion con token JWT de prueba (rol admin)."""
    token = create_access_token({
        "sub": str(uuid.uuid4()),
        "email": "admin@hmis.app",
        "tenant_id": "tenant_demo",
        "roles": ["admin"],
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "tenant_demo",
    }


# =============================================
# Fixtures de entidades de prueba en BD
# =============================================

@pytest.fixture
async def admin_role(db_session: AsyncSession):
    """Crea un rol admin en la base de test."""
    from app.modules.auth.models import Role
    role = Role(
        name="admin",
        display_name="Administrador",
        permissions=["*"],
        is_system_role=True,
    )
    db_session.add(role)
    await db_session.flush()
    await db_session.commit()
    return role


@pytest.fixture
async def medico_role(db_session: AsyncSession):
    """Crea un rol medico en la base de test."""
    from app.modules.auth.models import Role
    role = Role(
        name="medico",
        display_name="Medico",
        permissions=[
            "patients:read", "patients:write",
            "encounters:read", "encounters:write",
            "prescriptions:read", "prescriptions:write",
        ],
        is_system_role=True,
    )
    db_session.add(role)
    await db_session.flush()
    await db_session.commit()
    return role


@pytest.fixture
async def admin_user(db_session: AsyncSession, admin_role):
    """Crea un usuario admin de prueba vinculado al rol admin."""
    from app.modules.auth.models import User, UserRole
    user = User(
        email="admin@test.hmis.app",
        hashed_password=hash_password("TestAdmin2026!"),
        first_name="Admin",
        last_name="Test",
        is_verified=True,
        is_superuser=True,
        tenant_id="tenant_test",
        language="es",
        timezone="America/Santo_Domingo",
    )
    db_session.add(user)
    await db_session.flush()

    user_role = UserRole(user_id=user.id, role_id=admin_role.id)
    db_session.add(user_role)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
async def medico_user(db_session: AsyncSession, medico_role):
    """Crea un usuario medico de prueba."""
    from app.modules.auth.models import User, UserRole
    user = User(
        email="medico@test.hmis.app",
        hashed_password=hash_password("TestMedico2026!"),
        first_name="Carlos",
        last_name="Martinez",
        is_verified=True,
        is_superuser=False,
        tenant_id="tenant_test",
        specialty="Medicina General",
        license_number="MED-TEST-001",
        language="es",
        timezone="America/Santo_Domingo",
    )
    db_session.add(user)
    await db_session.flush()

    user_role = UserRole(user_id=user.id, role_id=medico_role.id)
    db_session.add(user_role)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
def admin_auth_headers(admin_user) -> dict:
    """Headers de autenticacion con usuario admin real en BD."""
    token = create_access_token({
        "sub": str(admin_user.id),
        "email": admin_user.email,
        "tenant_id": "tenant_test",
        "roles": ["admin"],
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "tenant_test",
    }


@pytest.fixture
def medico_auth_headers(medico_user) -> dict:
    """Headers de autenticacion con usuario medico real en BD."""
    token = create_access_token({
        "sub": str(medico_user.id),
        "email": medico_user.email,
        "tenant_id": "tenant_test",
        "roles": ["medico"],
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "tenant_test",
    }


# =============================================
# Fixtures de datos de ejemplo
# =============================================

@pytest.fixture
def sample_patient_data() -> dict:
    """Datos de ejemplo para crear un paciente dominicano."""
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


# =============================================
# Mock global de eventos (Redis)
# =============================================

@pytest.fixture(autouse=True)
def mock_event_publish():
    """
    Mockea la funcion publish de eventos para evitar conexion a Redis.
    Se aplica automaticamente a todos los tests.
    """
    with patch("app.shared.events.publish", new_callable=AsyncMock) as mock_pub:
        yield mock_pub
