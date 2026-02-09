"""
Tests de integración para las rutas de EMR (/api/v1/emr).
Valida encuentros, diagnósticos, órdenes médicas, signos vitales y notas clínicas.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient


# =============================================
# Fixtures
# =============================================

@pytest.fixture
def sample_encounter_data():
    """Datos de muestra para crear un encuentro."""
    return {
        "patient_id": str(uuid.uuid4()),
        "encounter_type": "outpatient",
        "reason": "Consulta general",
        "chief_complaint": "Dolor de cabeza",
    }


@pytest.fixture
def sample_diagnosis_data():
    """Datos de muestra para crear un diagnóstico."""
    return {
        "code": "J06.9",
        "description": "Infección aguda de las vías respiratorias superiores",
        "type": "primary",
    }


@pytest.fixture
def sample_vital_signs_data():
    """Datos de muestra para signos vitales."""
    return {
        "temperature": 36.8,
        "heart_rate": 75,
        "respiratory_rate": 16,
        "blood_pressure_systolic": 120,
        "blood_pressure_diastolic": 80,
        "oxygen_saturation": 98.0,
        "weight": 70.5,
        "height": 175.0,
    }


@pytest.fixture
def sample_medical_order_data():
    """Datos de muestra para una orden médica."""
    return {
        "order_type": "lab",
        "description": "Hemograma completo",
        "notes": "En ayunas",
        "priority": "routine",
    }


@pytest.fixture
async def sample_patient(client: AsyncClient, auth_headers):
    """Crea un paciente de prueba."""
    patient_data = {
        "first_name": "Juan",
        "last_name": "Pérez",
        "birth_date": "1990-05-15",
        "gender": "M",
        "document_type": "cedula",
        "document_number": "00112345678",
        "phone": "8095551234",
        "email": "juan.perez@example.com",
    }
    response = await client.post(
        "/api/v1/patients",
        headers=auth_headers,
        json=patient_data,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def sample_encounter(client: AsyncClient, auth_headers, sample_patient):
    """Crea un encuentro de prueba."""
    encounter_data = {
        "patient_id": sample_patient["id"],
        "encounter_type": "outpatient",
        "reason": "Consulta de control",
    }
    response = await client.post(
        "/api/v1/emr/encounters",
        headers=auth_headers,
        json=encounter_data,
    )
    assert response.status_code == 201
    return response.json()


# =============================================
# Tests: Encuentros
# =============================================

class TestCreateEncounter:
    """Tests para POST /api/v1/emr/encounters."""

    @pytest.mark.asyncio
    async def test_crear_encuentro_exitoso(
        self, client: AsyncClient, auth_headers, sample_patient
    ):
        """Crear encuentro con datos válidos retorna 201."""
        encounter_data = {
            "patient_id": sample_patient["id"],
            "encounter_type": "outpatient",
            "reason": "Consulta general",
            "chief_complaint": "Dolor de cabeza",
        }

        response = await client.post(
            "/api/v1/emr/encounters",
            headers=auth_headers,
            json=encounter_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["patient_id"] == sample_patient["id"]
        assert data["encounter_type"] == "outpatient"
        assert data["status"] == "active"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_crear_encuentro_sin_patient_id_retorna_422(
        self, client: AsyncClient, auth_headers
    ):
        """Crear encuentro sin patient_id retorna 422."""
        encounter_data = {
            "encounter_type": "outpatient",
            "reason": "Consulta general",
        }

        response = await client.post(
            "/api/v1/emr/encounters",
            headers=auth_headers,
            json=encounter_data,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_encuentro_con_tipo_invalido_retorna_422(
        self, client: AsyncClient, auth_headers, sample_patient
    ):
        """Crear encuentro con tipo inválido retorna 422."""
        encounter_data = {
            "patient_id": sample_patient["id"],
            "encounter_type": "invalid_type",
            "reason": "Consulta general",
        }

        response = await client.post(
            "/api/v1/emr/encounters",
            headers=auth_headers,
            json=encounter_data,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_encuentro_sin_auth_retorna_403(
        self, client: AsyncClient, sample_patient
    ):
        """Crear encuentro sin autenticación retorna 403."""
        encounter_data = {
            "patient_id": sample_patient["id"],
            "encounter_type": "outpatient",
            "reason": "Consulta general",
        }

        response = await client.post(
            "/api/v1/emr/encounters",
            json=encounter_data,
        )

        assert response.status_code == 403


class TestGetEncounter:
    """Tests para GET /api/v1/emr/encounters/{id}."""

    @pytest.mark.asyncio
    async def test_obtener_encuentro_por_id(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Obtener encuentro existente por UUID retorna 200."""
        response = await client.get(
            f"/api/v1/emr/encounters/{sample_encounter['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_encounter["id"]
        assert data["encounter_type"] == sample_encounter["encounter_type"]

    @pytest.mark.asyncio
    async def test_obtener_encuentro_inexistente_retorna_404(
        self, client: AsyncClient, auth_headers
    ):
        """Obtener encuentro inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/emr/encounters/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestListEncounters:
    """Tests para GET /api/v1/emr/encounters."""

    @pytest.mark.asyncio
    async def test_listar_encuentros_sin_filtros(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Listar encuentros sin filtros retorna 200."""
        response = await client.get(
            "/api/v1/emr/encounters",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) > 0

    @pytest.mark.asyncio
    async def test_listar_encuentros_por_patient_id(
        self, client: AsyncClient, auth_headers, sample_patient, sample_encounter
    ):
        """Listar encuentros filtrados por patient_id retorna resultados."""
        response = await client.get(
            f"/api/v1/emr/encounters?patient_id={sample_patient['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert all(e["patient_id"] == sample_patient["id"] for e in data["items"])


# =============================================
# Tests: Diagnósticos
# =============================================

class TestCreateDiagnosis:
    """Tests para POST /api/v1/emr/encounters/{id}/diagnoses."""

    @pytest.mark.asyncio
    async def test_crear_diagnostico_exitoso(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Crear diagnóstico con datos válidos retorna 201."""
        diagnosis_data = {
            "code": "J06.9",
            "description": "Infección respiratoria aguda",
            "type": "primary",
        }

        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/diagnoses",
            headers=auth_headers,
            json=diagnosis_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "J06.9"
        assert data["type"] == "primary"

    @pytest.mark.asyncio
    async def test_crear_diagnostico_sin_codigo_retorna_422(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Crear diagnóstico sin código retorna 422."""
        diagnosis_data = {
            "description": "Infección respiratoria",
            "type": "primary",
        }

        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/diagnoses",
            headers=auth_headers,
            json=diagnosis_data,
        )

        assert response.status_code == 422


# =============================================
# Tests: Signos Vitales
# =============================================

class TestCreateVitalSigns:
    """Tests para POST /api/v1/emr/encounters/{id}/vital-signs."""

    @pytest.mark.asyncio
    async def test_crear_signos_vitales_exitoso(
        self, client: AsyncClient, auth_headers, sample_encounter, sample_vital_signs_data
    ):
        """Crear signos vitales con datos válidos retorna 201."""
        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/vital-signs",
            headers=auth_headers,
            json=sample_vital_signs_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["temperature"] == 36.8
        assert data["heart_rate"] == 75
        assert data["blood_pressure_systolic"] == 120

    @pytest.mark.asyncio
    async def test_crear_signos_vitales_con_temperatura_invalida_retorna_422(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Crear signos vitales con temperatura inválida retorna 422."""
        vital_signs_data = {
            "temperature": 50.0,  # Temperatura inválida
            "heart_rate": 75,
        }

        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/vital-signs",
            headers=auth_headers,
            json=vital_signs_data,
        )

        assert response.status_code == 422


# =============================================
# Tests: Órdenes Médicas
# =============================================

class TestCreateMedicalOrder:
    """Tests para POST /api/v1/emr/encounters/{id}/orders."""

    @pytest.mark.asyncio
    async def test_crear_orden_medica_exitoso(
        self, client: AsyncClient, auth_headers, sample_encounter, sample_medical_order_data
    ):
        """Crear orden médica con datos válidos retorna 201."""
        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/orders",
            headers=auth_headers,
            json=sample_medical_order_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["order_type"] == "lab"
        assert data["description"] == "Hemograma completo"
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_crear_orden_sin_tipo_retorna_422(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Crear orden sin tipo retorna 422."""
        order_data = {
            "description": "Hemograma completo",
        }

        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/orders",
            headers=auth_headers,
            json=order_data,
        )

        assert response.status_code == 422


class TestUpdateOrderStatus:
    """Tests para PATCH /api/v1/emr/orders/{id}/status."""

    @pytest.mark.asyncio
    async def test_actualizar_estado_orden_exitoso(
        self, client: AsyncClient, auth_headers, sample_encounter, sample_medical_order_data
    ):
        """Actualizar estado de orden retorna 200."""
        # Crear orden primero
        create_response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/orders",
            headers=auth_headers,
            json=sample_medical_order_data,
        )
        assert create_response.status_code == 201
        order_id = create_response.json()["id"]

        # Actualizar estado
        status_update = {"status": "completed"}
        response = await client.patch(
            f"/api/v1/emr/orders/{order_id}/status",
            headers=auth_headers,
            json=status_update,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"


# =============================================
# Tests: Notas Clínicas
# =============================================

class TestCreateClinicalNote:
    """Tests para POST /api/v1/emr/encounters/{id}/notes."""

    @pytest.mark.asyncio
    async def test_crear_nota_clinica_exitoso(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Crear nota clínica con datos válidos retorna 201."""
        note_data = {
            "note_type": "progress",
            "content": "Paciente presenta mejoría significativa",
        }

        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/notes",
            headers=auth_headers,
            json=note_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["note_type"] == "progress"
        assert data["content"] == "Paciente presenta mejoría significativa"

    @pytest.mark.asyncio
    async def test_crear_nota_sin_contenido_retorna_422(
        self, client: AsyncClient, auth_headers, sample_encounter
    ):
        """Crear nota sin contenido retorna 422."""
        note_data = {
            "note_type": "progress",
        }

        response = await client.post(
            f"/api/v1/emr/encounters/{sample_encounter['id']}/notes",
            headers=auth_headers,
            json=note_data,
        )

        assert response.status_code == 422
