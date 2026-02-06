"""
Tests de integracion para las rutas de pacientes (/api/v1/patients).
Valida CRUD completo, busqueda, validaciones y autorizacion.
"""

import uuid

import pytest
from httpx import AsyncClient


class TestCreatePatient:
    """Tests para POST /api/v1/patients."""

    @pytest.mark.asyncio
    async def test_crear_paciente_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Crear paciente con datos validos retorna 201."""
        response = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "Juan"
        assert data["last_name"] == "Perez"
        assert data["document_number"] == "00112345678"
        assert "mrn" in data
        assert data["mrn"].startswith("HMIS-")

    @pytest.mark.asyncio
    async def test_crear_paciente_genera_mrn_unico(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Cada paciente recibe un MRN unico."""
        resp1 = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )
        assert resp1.status_code == 201

        # Crear segundo paciente con documento diferente
        data2 = sample_patient_data.copy()
        data2["document_number"] = "00298765432"
        data2["email"] = "maria@email.com"
        data2["first_name"] = "Maria"

        resp2 = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=data2,
        )
        assert resp2.status_code == 201
        assert resp1.json()["mrn"] != resp2.json()["mrn"]

    @pytest.mark.asyncio
    async def test_crear_paciente_duplicado_retorna_409(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Crear paciente con documento duplicado retorna 409."""
        # Crear el primero
        resp1 = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )
        assert resp1.status_code == 201

        # Intentar duplicado
        resp2 = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_crear_paciente_sin_auth_retorna_403(
        self, client: AsyncClient, sample_patient_data
    ):
        """Crear paciente sin token retorna 403."""
        response = await client.post(
            "/api/v1/patients",
            json=sample_patient_data,
        )
        assert response.status_code == 403


class TestGetPatient:
    """Tests para GET /api/v1/patients/{patient_id}."""

    @pytest.mark.asyncio
    async def test_obtener_paciente_por_id(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Obtener paciente existente por UUID retorna 200."""
        # Crear paciente primero
        create_resp = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )
        patient_id = create_resp.json()["id"]

        # Obtener por ID
        response = await client.get(
            f"/api/v1/patients/{patient_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == patient_id
        assert data["first_name"] == "Juan"

    @pytest.mark.asyncio
    async def test_obtener_paciente_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Obtener paciente con UUID inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/patients/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404


class TestSearchPatients:
    """Tests para GET /api/v1/patients/search."""

    @pytest.mark.asyncio
    async def test_buscar_pacientes_retorna_paginado(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Busqueda sin filtros retorna resultado paginado."""
        # Crear un paciente
        await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )

        response = await client.get(
            "/api/v1/patients/search",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data

    @pytest.mark.asyncio
    async def test_buscar_pacientes_por_nombre(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Busqueda por nombre retorna pacientes coincidentes."""
        await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )

        response = await client.get(
            "/api/v1/patients/search?query=Juan",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1


class TestUpdatePatient:
    """Tests para PATCH /api/v1/patients/{patient_id}."""

    @pytest.mark.asyncio
    async def test_actualizar_paciente_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Actualizar campos del paciente retorna 200."""
        create_resp = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )
        patient_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/patients/{patient_id}",
            headers=admin_auth_headers,
            json={"phone": "809-555-9999"},
        )
        assert response.status_code == 200
        assert response.json()["phone"] == "809-555-9999"


class TestDeactivatePatient:
    """Tests para DELETE /api/v1/patients/{patient_id}."""

    @pytest.mark.asyncio
    async def test_desactivar_paciente_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_patient_data
    ):
        """Desactivar paciente retorna 200 con mensaje."""
        create_resp = await client.post(
            "/api/v1/patients",
            headers=admin_auth_headers,
            json=sample_patient_data,
        )
        patient_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/patients/{patient_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        assert "desactivado" in response.json()["mensaje"].lower()

    @pytest.mark.asyncio
    async def test_desactivar_paciente_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Desactivar paciente inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.delete(
            f"/api/v1/patients/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404
