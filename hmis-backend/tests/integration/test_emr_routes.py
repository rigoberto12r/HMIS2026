"""
Tests de integración para las rutas de EMR (/api/v1/emr).
Valida CRUD de encuentros, notas clínicas, diagnósticos y órdenes médicas.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def sample_encounter_data(sample_patient):
    """Datos de ejemplo para crear un encuentro."""
    return {
        "patient_id": str(sample_patient.id),
        "provider_id": str(uuid.uuid4()),
        "encounter_type": "outpatient",
        "reason": "Consulta general",
        "chief_complaint": "Dolor de cabeza",
    }


@pytest.fixture
def sample_clinical_note_data():
    """Datos de ejemplo para una nota clínica SOAP."""
    return {
        "note_type": "SOAP",
        "subjective": "Paciente refiere dolor de cabeza desde hace 2 días",
        "objective": "PA: 120/80, FC: 72, Temp: 36.5°C",
        "assessment": "Cefalea tensional probable",
        "plan": "Paracetamol 500mg c/8h por 3 días",
    }


# ============================================================
# Tests: Encuentros Clínicos
# ============================================================

class TestCreateEncounter:
    """Tests para POST /api/v1/emr/encounters."""

    @pytest.mark.asyncio
    async def test_crear_encuentro_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_encounter_data
    ):
        """Crear encuentro con datos válidos retorna 201."""
        response = await client.post(
            "/api/v1/emr/encounters",
            headers=admin_auth_headers,
            json=sample_encounter_data,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["patient_id"] == sample_encounter_data["patient_id"]
        assert data["encounter_type"] == "outpatient"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_crear_encuentro_sin_patient_id_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_encounter_data
    ):
        """Crear encuentro sin patient_id retorna 422."""
        invalid_data = sample_encounter_data.copy()
        del invalid_data["patient_id"]

        response = await client.post(
            "/api/v1/emr/encounters",
            headers=admin_auth_headers,
            json=invalid_data,
        )
        assert response.status_code == 422


class TestGetEncounter:
    """Tests para GET /api/v1/emr/encounters/{id}."""

    @pytest.mark.asyncio
    async def test_obtener_encuentro_existente(
        self, client: AsyncClient, admin_auth_headers, sample_encounter_data
    ):
        """Obtener encuentro existente retorna 200."""
        # Crear encuentro primero
        create_resp = await client.post(
            "/api/v1/emr/encounters",
            headers=admin_auth_headers,
            json=sample_encounter_data,
        )
        encounter_id = create_resp.json()["id"]

        # Obtener encuentro
        response = await client.get(
            f"/api/v1/emr/encounters/{encounter_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == encounter_id


class TestListEncounters:
    """Tests para GET /api/v1/emr/encounters."""

    @pytest.mark.asyncio
    async def test_listar_encuentros_con_paginacion(
        self, client: AsyncClient, admin_auth_headers, sample_encounter_data
    ):
        """Listar encuentros retorna paginación correcta."""
        # Crear 2 encuentros
        for _ in range(2):
            await client.post(
                "/api/v1/emr/encounters",
                headers=admin_auth_headers,
                json=sample_encounter_data,
            )

        # Listar
        response = await client.get(
            "/api/v1/emr/encounters?page=1&page_size=10",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
