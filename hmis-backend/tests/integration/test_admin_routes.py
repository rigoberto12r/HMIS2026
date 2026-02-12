"""
Tests de integracion para las rutas de administracion (/api/v1/admin).
Valida gestion de tenants (crear, listar, desactivar) y autorizacion de superadmin.

Nota: El modulo admin usa raw SQL contra la tabla 'tenants' que no forma parte
de Base.metadata (solo existe via migracion Alembic). Los tests crean esta tabla
manualmente. Las operaciones PostgreSQL-specific (CREATE SCHEMA,
information_schema, NOW()) se manejan con mocks para compatibilidad con SQLite.
"""

import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.database import get_db
from tests.conftest import TestSessionLocal, override_get_db, _test_app


# =============================================
# Fixtures especificas para tests de admin
# =============================================


@pytest.fixture(autouse=True)
async def create_tenants_table():
    """
    Crea la tabla 'tenants' que normalmente se crea via migracion Alembic.
    Esta tabla no es parte de Base.metadata, asi que se crea manualmente
    con sintaxis compatible con SQLite.
    """
    async with TestSessionLocal() as session:
        await session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS tenants (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT UNIQUE NOT NULL,
                    schema_name TEXT UNIQUE NOT NULL,
                    hospital_name TEXT NOT NULL,
                    country TEXT DEFAULT 'DO',
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        await session.commit()
    yield
    async with TestSessionLocal() as session:
        await session.execute(text("DROP TABLE IF EXISTS tenants"))
        await session.commit()


@pytest.fixture
def sample_tenant_data() -> dict:
    """Datos de ejemplo para crear un tenant."""
    return {
        "tenant_id": "hospital_central",
        "hospital_name": "Hospital Central de Santo Domingo",
        "country": "DO",
        "admin_email": "admin@hospital-central.com",
        "admin_password": "AdminHospital2026!",
        "admin_first_name": "Director",
        "admin_last_name": "General",
    }


@pytest.fixture
async def existing_tenant():
    """Inserta un tenant existente directamente en la BD para pruebas."""
    tenant_id_val = str(uuid.uuid4())
    async with TestSessionLocal() as session:
        await session.execute(
            text(
                "INSERT INTO tenants (id, tenant_id, schema_name, hospital_name, "
                "country, is_active, created_at) "
                "VALUES (:id, :tenant_id, :schema, :name, :country, 1, :created_at)"
            ),
            {
                "id": tenant_id_val,
                "tenant_id": "clinica_norte",
                "schema": "tenant_clinica_norte",
                "name": "Clinica Norte",
                "country": "DO",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        await session.commit()
    return {
        "id": tenant_id_val,
        "tenant_id": "clinica_norte",
        "schema_name": "tenant_clinica_norte",
        "hospital_name": "Clinica Norte",
        "country": "DO",
    }


@pytest.fixture
async def multiple_tenants():
    """Inserta varios tenants para pruebas de listado."""
    tenants = [
        {
            "id": str(uuid.uuid4()),
            "tenant_id": "clinica_sur",
            "schema": "tenant_clinica_sur",
            "name": "Clinica Sur",
            "country": "DO",
            "is_active": 1,
        },
        {
            "id": str(uuid.uuid4()),
            "tenant_id": "hospital_este",
            "schema": "tenant_hospital_este",
            "name": "Hospital del Este",
            "country": "DO",
            "is_active": 1,
        },
        {
            "id": str(uuid.uuid4()),
            "tenant_id": "centro_medico_oeste",
            "schema": "tenant_centro_medico_oeste",
            "name": "Centro Medico del Oeste",
            "country": "MX",
            "is_active": 0,
        },
    ]
    async with TestSessionLocal() as session:
        for t in tenants:
            await session.execute(
                text(
                    "INSERT INTO tenants (id, tenant_id, schema_name, hospital_name, "
                    "country, is_active, created_at) "
                    "VALUES (:id, :tenant_id, :schema, :name, :country, :is_active, :created_at)"
                ),
                {
                    **t,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        await session.commit()
    return tenants


# =============================================
# Helpers: mocks para operaciones PostgreSQL-specific
# =============================================


def _mock_engine_context():
    """
    Crea un mock de engine.begin() que simula la creacion de schema
    sin ejecutar SQL de PostgreSQL (CREATE SCHEMA, SET search_path, etc.).
    Returns (context_manager_mock, connection_mock).
    """
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock()
    mock_conn.run_sync = AsyncMock()

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    return mock_ctx, mock_conn


def _make_sqlite_compatible_execute(original_execute):
    """
    Wraps the db session execute to intercept PostgreSQL-specific SQL and
    rewrite it for SQLite compatibility:
    - information_schema.schemata -> returns empty mock result (no schema found)
    - NOW() -> CURRENT_TIMESTAMP
    - boolean literal 'true' -> 1
    """

    async def patched_execute(stmt, *args, **kwargs):
        if hasattr(stmt, "text"):
            sql_text = stmt.text
        else:
            sql_text = str(stmt)

        # information_schema does not exist in SQLite
        if "information_schema.schemata" in sql_text:
            mock_result = AsyncMock()
            mock_result.scalar.return_value = None
            return mock_result

        # Rewrite PG-specific syntax for SQLite
        if "NOW()" in sql_text:
            new_sql = sql_text.replace("NOW()", "CURRENT_TIMESTAMP")
            new_sql = new_sql.replace(", true,", ", 1,")
            new_stmt = text(new_sql)
            return await original_execute(new_stmt, *args, **kwargs)

        return await original_execute(stmt, *args, **kwargs)

    return patched_execute


@contextmanager
def _sqlite_compat_create_tenant():
    """
    Context manager that patches engine.begin() (for CREATE SCHEMA)
    and overrides get_db (for information_schema and NOW()) to make
    the create_tenant endpoint work with SQLite.

    Usage:
        with _sqlite_compat_create_tenant():
            response = await client.post("/api/v1/admin/tenants", ...)
    """
    async def sqlite_compat_get_db():
        async with TestSessionLocal() as session:
            original_execute = session.execute
            session.execute = _make_sqlite_compatible_execute(original_execute)
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    with patch("app.modules.admin.routes.engine") as mock_engine:
        mock_ctx, _ = _mock_engine_context()
        mock_engine.begin.return_value = mock_ctx

        _test_app.dependency_overrides[get_db] = sqlite_compat_get_db
        try:
            yield
        finally:
            _test_app.dependency_overrides[get_db] = override_get_db


# =============================================
# Tests: Crear Tenant (POST /api/v1/admin/tenants)
# =============================================


class TestCreateTenant:
    """Tests para POST /api/v1/admin/tenants."""

    @pytest.mark.asyncio
    async def test_crear_tenant_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Crear tenant con datos validos retorna 201 y datos del tenant."""
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["tenant_id"] == "hospital_central"
        assert data["schema_name"] == "tenant_hospital_central"
        assert data["hospital_name"] == "Hospital Central de Santo Domingo"
        assert data["admin_email"] == "admin@hospital-central.com"
        assert "exitosamente" in data["mensaje"]

    @pytest.mark.asyncio
    async def test_crear_tenant_crea_usuario_admin(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data, db_session
    ):
        """Al crear un tenant se crea el usuario admin del hospital asociado."""
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )

        assert response.status_code == 201

        # Verificar que el usuario admin fue creado en la BD
        result = await db_session.execute(
            text("SELECT email, tenant_id, is_superuser FROM users WHERE email = :email"),
            {"email": "admin@hospital-central.com"},
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] == "admin@hospital-central.com"
        assert row[1] == "hospital_central"
        # El admin del tenant no debe ser superuser global
        assert row[2] in (False, 0)

    @pytest.mark.asyncio
    async def test_crear_tenant_sin_auth_retorna_403(
        self, client: AsyncClient, sample_tenant_data
    ):
        """Crear tenant sin token de autenticacion retorna 403."""
        response = await client.post(
            "/api/v1/admin/tenants",
            json=sample_tenant_data,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_crear_tenant_sin_superuser_retorna_403(
        self, client: AsyncClient, medico_auth_headers, sample_tenant_data
    ):
        """Crear tenant con usuario no-superuser retorna 403."""
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=medico_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 403
        assert "superadmin" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_crear_tenant_id_muy_corto_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Tenant ID con menos de 3 caracteres retorna 422 (validacion Pydantic)."""
        sample_tenant_data["tenant_id"] = "ab"
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_id_muy_largo_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Tenant ID con mas de 50 caracteres retorna 422."""
        sample_tenant_data["tenant_id"] = "a" * 51
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_id_con_mayusculas_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Tenant ID con mayusculas retorna 422 (patron solo permite minusculas)."""
        sample_tenant_data["tenant_id"] = "Hospital_Central"
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_id_con_guion_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Tenant ID con guion retorna 422 (solo letras, numeros y underscore)."""
        sample_tenant_data["tenant_id"] = "hospital-central"
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_id_inicia_con_numero_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Tenant ID que inicia con numero retorna 422 (debe empezar con letra)."""
        sample_tenant_data["tenant_id"] = "1hospital"
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_contrasena_corta_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Contrasena de admin con menos de 8 caracteres retorna 422."""
        sample_tenant_data["admin_password"] = "corta"
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_sin_hospital_name_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Crear tenant sin hospital_name retorna 422."""
        del sample_tenant_data["hospital_name"]
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_sin_admin_email_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Crear tenant sin admin_email retorna 422."""
        del sample_tenant_data["admin_email"]
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_sin_admin_first_name_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Crear tenant sin admin_first_name retorna 422."""
        del sample_tenant_data["admin_first_name"]
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_sin_admin_last_name_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Crear tenant sin admin_last_name retorna 422."""
        del sample_tenant_data["admin_last_name"]
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=sample_tenant_data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_tenant_pais_default_es_do(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Si no se especifica pais, se usa 'DO' por defecto."""
        del sample_tenant_data["country"]
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_crear_tenant_schema_name_sigue_convencion(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """El schema_name retornado sigue la convencion 'tenant_{tenant_id}'."""
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )
        assert response.status_code == 201
        data = response.json()
        assert data["schema_name"] == f"tenant_{data['tenant_id']}"

    @pytest.mark.asyncio
    async def test_crear_tenant_mensaje_contiene_nombre_hospital(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """El mensaje de exito incluye el nombre del hospital."""
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )
        assert response.status_code == 201
        data = response.json()
        assert sample_tenant_data["hospital_name"] in data["mensaje"]


# =============================================
# Tests: Validacion del patron de tenant_id
# =============================================


class TestTenantIdValidation:
    """Tests para la validacion del patron regex: ^[a-z][a-z0-9_]*$"""

    @pytest.mark.asyncio
    async def test_tenant_id_valido_con_numeros(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID con letras seguidas de numeros es valido."""
        data = {
            "tenant_id": "hospital2026",
            "hospital_name": "Hospital 2026",
            "admin_email": "admin@h2026.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "H2026",
        }
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=data,
            )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_tenant_id_valido_con_underscore(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID con underscores es valido."""
        data = {
            "tenant_id": "hospital_del_norte",
            "hospital_name": "Hospital del Norte",
            "admin_email": "admin@hnorte.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "Norte",
        }
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=data,
            )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_tenant_id_minimo_tres_caracteres(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID con exactamente 3 caracteres es valido."""
        data = {
            "tenant_id": "abc",
            "hospital_name": "Test",
            "admin_email": "admin@abc.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "Abc",
        }
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=data,
            )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_tenant_id_invalido_con_espacios(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID con espacios retorna 422."""
        data = {
            "tenant_id": "hospital central",
            "hospital_name": "Hospital Central",
            "admin_email": "admin@hc.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "Central",
        }
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_tenant_id_invalido_con_punto(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID con puntos retorna 422."""
        data = {
            "tenant_id": "hospital.central",
            "hospital_name": "Hospital Central",
            "admin_email": "admin@hc.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "Central",
        }
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_tenant_id_vacio_retorna_422(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID vacio retorna 422."""
        data = {
            "tenant_id": "",
            "hospital_name": "Hospital",
            "admin_email": "admin@h.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "Test",
        }
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_tenant_id_invalido_con_arroba(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID con @ retorna 422."""
        data = {
            "tenant_id": "hospital@central",
            "hospital_name": "Hospital Central",
            "admin_email": "admin@hc.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "Central",
        }
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_tenant_id_invalido_con_slash(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Tenant ID con / retorna 422."""
        data = {
            "tenant_id": "hospital/central",
            "hospital_name": "Hospital Central",
            "admin_email": "admin@hc.com",
            "admin_password": "AdminPass2026!",
            "admin_first_name": "Admin",
            "admin_last_name": "Central",
        }
        response = await client.post(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 422


# =============================================
# Tests: Listar Tenants (GET /api/v1/admin/tenants)
# =============================================


class TestListTenants:
    """Tests para GET /api/v1/admin/tenants."""

    @pytest.mark.asyncio
    async def test_listar_tenants_vacio(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Listar tenants sin datos retorna lista vacia."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_listar_tenants_con_un_registro(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """Listar tenants con un tenant existente retorna un item."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1

    @pytest.mark.asyncio
    async def test_listar_tenants_estructura_del_item(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """Cada item de la lista tiene los campos requeridos por TenantListItem."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        tenant = response.json()[0]

        required_fields = ["tenant_id", "hospital_name", "country", "created_at", "is_active"]
        for field in required_fields:
            assert field in tenant, f"Campo '{field}' faltante en item de la lista"

    @pytest.mark.asyncio
    async def test_listar_tenants_multiples(
        self, client: AsyncClient, admin_auth_headers, multiple_tenants
    ):
        """Listar tenants con multiples registros retorna todos."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    @pytest.mark.asyncio
    async def test_listar_tenants_contiene_datos_correctos(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """La lista de tenants contiene los datos correctos."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        tenant = response.json()[0]
        assert tenant["tenant_id"] == "clinica_norte"
        assert tenant["hospital_name"] == "Clinica Norte"
        assert tenant["country"] == "DO"
        assert tenant["is_active"] in (True, 1)

    @pytest.mark.asyncio
    async def test_listar_tenants_incluye_activos_e_inactivos(
        self, client: AsyncClient, admin_auth_headers, multiple_tenants
    ):
        """La lista incluye tanto tenants activos como inactivos."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        active_states = [t["is_active"] for t in data]
        has_active = any(s in (True, 1) for s in active_states)
        has_inactive = any(s in (False, 0) for s in active_states)
        assert has_active, "Deberia haber al menos un tenant activo"
        assert has_inactive, "Deberia haber al menos un tenant inactivo"

    @pytest.mark.asyncio
    async def test_listar_tenants_retorna_array_json(
        self, client: AsyncClient, admin_auth_headers
    ):
        """GET /tenants retorna un array JSON (no un objeto envolvente)."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_listar_tenants_sin_auth_retorna_403(
        self, client: AsyncClient
    ):
        """Listar tenants sin token retorna 403."""
        response = await client.get("/api/v1/admin/tenants")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_listar_tenants_sin_superuser_retorna_403(
        self, client: AsyncClient, medico_auth_headers
    ):
        """Listar tenants con usuario no-superuser retorna 403."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=medico_auth_headers,
        )
        assert response.status_code == 403
        assert "superadmin" in response.json()["detail"].lower()


# =============================================
# Tests: Desactivar Tenant (PATCH /api/v1/admin/tenants/{tid}/deactivate)
# =============================================


class TestDeactivateTenant:
    """Tests para PATCH /api/v1/admin/tenants/{tenant_id}/deactivate."""

    @pytest.mark.asyncio
    async def test_desactivar_tenant_exitoso(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """Desactivar un tenant existente retorna 200 con mensaje de exito."""
        response = await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "desactivado" in data["mensaje"].lower()
        assert existing_tenant["tenant_id"] in data["mensaje"]

    @pytest.mark.asyncio
    async def test_desactivar_tenant_cambia_estado_en_bd(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """Despues de desactivar, el tenant tiene is_active=false en la BD."""
        await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
            headers=admin_auth_headers,
        )

        async with TestSessionLocal() as session:
            result = await session.execute(
                text("SELECT is_active FROM tenants WHERE tenant_id = :tid"),
                {"tid": existing_tenant["tenant_id"]},
            )
            row = result.fetchone()
            assert row is not None
            assert row[0] in (False, 0)

    @pytest.mark.asyncio
    async def test_desactivar_tenant_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Desactivar un tenant que no existe retorna 404."""
        response = await client.patch(
            "/api/v1/admin/tenants/tenant_fantasma/deactivate",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404
        assert "no encontrado" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_desactivar_tenant_sin_auth_retorna_403(
        self, client: AsyncClient, existing_tenant
    ):
        """Desactivar tenant sin token retorna 403."""
        response = await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_desactivar_tenant_sin_superuser_retorna_403(
        self, client: AsyncClient, medico_auth_headers, existing_tenant
    ):
        """Desactivar tenant con usuario no-superuser retorna 403."""
        response = await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
            headers=medico_auth_headers,
        )
        assert response.status_code == 403
        assert "superadmin" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_desactivar_tenant_ya_desactivado_es_idempotente(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """Desactivar un tenant ya desactivado no produce error (idempotente)."""
        resp1 = await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
            headers=admin_auth_headers,
        )
        assert resp1.status_code == 200

        resp2 = await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
            headers=admin_auth_headers,
        )
        assert resp2.status_code == 200

    @pytest.mark.asyncio
    async def test_desactivar_respuesta_contiene_campo_mensaje(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """La respuesta de desactivar contiene el campo 'mensaje' con texto."""
        response = await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "mensaje" in data
        assert isinstance(data["mensaje"], str)
        assert len(data["mensaje"]) > 0


# =============================================
# Tests: Flujo completo (crear + listar + desactivar)
# =============================================


class TestAdminTenantWorkflow:
    """Tests de flujo completo que combinan multiples operaciones de tenant."""

    @pytest.mark.asyncio
    async def test_flujo_crear_y_listar_tenant(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Crear un tenant y verificar que aparece en la lista."""
        with _sqlite_compat_create_tenant():
            create_resp = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )
        assert create_resp.status_code == 201

        list_resp = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert list_resp.status_code == 200
        tenant_ids = [t["tenant_id"] for t in list_resp.json()]
        assert "hospital_central" in tenant_ids

    @pytest.mark.asyncio
    async def test_flujo_crear_listar_desactivar_verificar(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """Flujo completo: crear, listar (activo), desactivar, listar (inactivo)."""
        # 1. Crear
        with _sqlite_compat_create_tenant():
            create_resp = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )
        assert create_resp.status_code == 201

        # 2. Listar - debe estar activo
        list_resp = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        target = [t for t in list_resp.json() if t["tenant_id"] == "hospital_central"]
        assert len(target) == 1
        assert target[0]["is_active"] in (True, 1)

        # 3. Desactivar
        deactivate_resp = await client.patch(
            "/api/v1/admin/tenants/hospital_central/deactivate",
            headers=admin_auth_headers,
        )
        assert deactivate_resp.status_code == 200

        # 4. Listar - debe estar inactivo
        list_resp2 = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        target2 = [t for t in list_resp2.json() if t["tenant_id"] == "hospital_central"]
        assert len(target2) == 1
        assert target2[0]["is_active"] in (False, 0)

    @pytest.mark.asyncio
    async def test_crear_multiples_tenants_aparecen_en_lista(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Crear multiples tenants y verificar que todos aparecen en la lista."""
        tenants_to_create = [
            {
                "tenant_id": "clinica_alfa",
                "hospital_name": "Clinica Alfa",
                "country": "DO",
                "admin_email": "admin@alfa.com",
                "admin_password": "AdminAlfa2026!",
                "admin_first_name": "Admin",
                "admin_last_name": "Alfa",
            },
            {
                "tenant_id": "clinica_beta",
                "hospital_name": "Clinica Beta",
                "country": "MX",
                "admin_email": "admin@beta.com",
                "admin_password": "AdminBeta2026!",
                "admin_first_name": "Admin",
                "admin_last_name": "Beta",
            },
        ]

        for tenant_data in tenants_to_create:
            with _sqlite_compat_create_tenant():
                resp = await client.post(
                    "/api/v1/admin/tenants",
                    headers=admin_auth_headers,
                    json=tenant_data,
                )
            assert resp.status_code == 201

        list_resp = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert list_resp.status_code == 200
        tenants = list_resp.json()
        assert len(tenants) == 2
        tenant_ids = {t["tenant_id"] for t in tenants}
        assert "clinica_alfa" in tenant_ids
        assert "clinica_beta" in tenant_ids

    @pytest.mark.asyncio
    async def test_desactivar_un_tenant_no_afecta_otros(
        self, client: AsyncClient, admin_auth_headers, multiple_tenants
    ):
        """Desactivar un tenant no cambia el estado de otros tenants."""
        resp = await client.patch(
            "/api/v1/admin/tenants/clinica_sur/deactivate",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 200

        list_resp = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        tenants = list_resp.json()
        hospital_este = [t for t in tenants if t["tenant_id"] == "hospital_este"]
        assert len(hospital_este) == 1
        assert hospital_este[0]["is_active"] in (True, 1)


# =============================================
# Tests: Autorizacion para todos los endpoints
# =============================================


class TestAdminAuthorization:
    """Tests de autorizacion que validan cada endpoint del modulo admin."""

    @pytest.mark.asyncio
    async def test_post_tenants_requiere_auth(self, client: AsyncClient):
        """POST /tenants sin auth retorna 403."""
        resp = await client.post(
            "/api/v1/admin/tenants",
            json={
                "tenant_id": "test_tenant",
                "hospital_name": "Test Hospital",
                "admin_email": "t@t.com",
                "admin_password": "TestPass2026!",
                "admin_first_name": "T",
                "admin_last_name": "T",
            },
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_get_tenants_requiere_auth(self, client: AsyncClient):
        """GET /tenants sin auth retorna 403."""
        resp = await client.get("/api/v1/admin/tenants")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_deactivate_requiere_auth(self, client: AsyncClient):
        """PATCH /tenants/{id}/deactivate sin auth retorna 403."""
        resp = await client.patch("/api/v1/admin/tenants/test/deactivate")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_post_tenants_rechaza_no_superuser(
        self, client: AsyncClient, medico_auth_headers
    ):
        """POST /tenants con usuario no-superuser retorna 403."""
        resp = await client.post(
            "/api/v1/admin/tenants",
            headers=medico_auth_headers,
            json={
                "tenant_id": "test_tenant",
                "hospital_name": "Test Hospital",
                "admin_email": "t@t.com",
                "admin_password": "TestPass2026!",
                "admin_first_name": "T",
                "admin_last_name": "T",
            },
        )
        assert resp.status_code == 403
        assert "detail" in resp.json()

    @pytest.mark.asyncio
    async def test_get_tenants_rechaza_no_superuser(
        self, client: AsyncClient, medico_auth_headers
    ):
        """GET /tenants con usuario no-superuser retorna 403."""
        resp = await client.get(
            "/api/v1/admin/tenants",
            headers=medico_auth_headers,
        )
        assert resp.status_code == 403
        assert "detail" in resp.json()

    @pytest.mark.asyncio
    async def test_patch_deactivate_rechaza_no_superuser(
        self, client: AsyncClient, medico_auth_headers
    ):
        """PATCH /tenants/{id}/deactivate con usuario no-superuser retorna 403."""
        resp = await client.patch(
            "/api/v1/admin/tenants/test/deactivate",
            headers=medico_auth_headers,
        )
        assert resp.status_code == 403
        assert "detail" in resp.json()

    @pytest.mark.asyncio
    async def test_superuser_puede_listar_tenants(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Superuser puede acceder a GET /tenants correctamente."""
        resp = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_superuser_puede_desactivar_tenants(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """Superuser puede desactivar un tenant existente."""
        resp = await client.patch(
            f"/api/v1/admin/tenants/{existing_tenant['tenant_id']}/deactivate",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 200


# =============================================
# Tests: Formato de respuesta
# =============================================


class TestAdminResponseFormat:
    """Tests para verificar la estructura de las respuestas HTTP."""

    @pytest.mark.asyncio
    async def test_create_response_tiene_campos_requeridos(
        self, client: AsyncClient, admin_auth_headers, sample_tenant_data
    ):
        """La respuesta de crear tenant incluye todos los campos de TenantResponse."""
        with _sqlite_compat_create_tenant():
            response = await client.post(
                "/api/v1/admin/tenants",
                headers=admin_auth_headers,
                json=sample_tenant_data,
            )

        assert response.status_code == 201
        data = response.json()
        required_fields = ["tenant_id", "schema_name", "hospital_name", "admin_email", "mensaje"]
        for field in required_fields:
            assert field in data, f"Campo '{field}' faltante en la respuesta de creacion"

    @pytest.mark.asyncio
    async def test_list_item_tiene_campos_requeridos(
        self, client: AsyncClient, admin_auth_headers, existing_tenant
    ):
        """Cada item de la lista incluye todos los campos de TenantListItem."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

        required_fields = ["tenant_id", "hospital_name", "country", "created_at", "is_active"]
        for field in required_fields:
            assert field in data[0], f"Campo '{field}' faltante en item de la lista"

    @pytest.mark.asyncio
    async def test_error_403_tiene_campo_detail(
        self, client: AsyncClient, medico_auth_headers
    ):
        """Las respuestas 403 incluyen el campo 'detail' con un string."""
        response = await client.get(
            "/api/v1/admin/tenants",
            headers=medico_auth_headers,
        )
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        assert isinstance(data["detail"], str)

    @pytest.mark.asyncio
    async def test_error_404_tiene_campo_detail(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Las respuestas 404 incluyen el campo 'detail' con un string."""
        response = await client.patch(
            "/api/v1/admin/tenants/inexistente/deactivate",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert isinstance(data["detail"], str)
