"""
Tests de integración para las rutas de Pharmacy (/api/v1/pharmacy).
Valida CRUD de prescripciones, dispensaciones e inventario.
"""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient


@pytest.fixture
def sample_prescription_data(sample_patient):
    """Datos de ejemplo para crear una prescripción."""
    return {
        "patient_id": str(sample_patient.id),
        "encounter_id": str(uuid.uuid4()),
        "medication_name": "Paracetamol 500mg",
        "dosage": "500mg",
        "frequency": "Cada 8 horas",
        "duration_days": 7,
        "quantity": 21,
        "instructions": "Tomar con alimentos",
        "start_date": date.today().isoformat(),
    }


class TestCreatePrescription:
    """Tests para POST /api/v1/pharmacy/prescriptions."""

    @pytest.mark.asyncio
    async def test_crear_prescripcion_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_prescription_data
    ):
        """Crear prescripción con datos válidos retorna 201."""
        response = await client.post(
            "/api/v1/pharmacy/prescriptions",
            headers=admin_auth_headers,
            json=sample_prescription_data,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["medication_name"] == "Paracetamol 500mg"
        assert data["status"] == "active"


class TestListPrescriptions:
    """Tests para GET /api/v1/pharmacy/prescriptions."""

    @pytest.mark.asyncio
    async def test_listar_prescripciones_por_paciente(
        self, client: AsyncClient, admin_auth_headers, sample_prescription_data, sample_patient
    ):
        """Listar prescripciones filtradas por paciente."""
        await client.post(
            "/api/v1/pharmacy/prescriptions",
            headers=admin_auth_headers,
            json=sample_prescription_data,
        )

        response = await client.get(
            f"/api/v1/pharmacy/prescriptions?patient_id={sample_patient.id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
