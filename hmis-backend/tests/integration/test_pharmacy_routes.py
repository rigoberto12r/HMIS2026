"""
Tests de integración para las rutas de farmacia (/api/v1/pharmacy).
Valida prescripciones, dispensaciones, inventario de medicamentos y alertas.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


# =============================================
# Fixtures
# =============================================

@pytest.fixture
def sample_medication_data():
    """Datos de muestra para crear un medicamento."""
    return {
        "name": "Amoxicilina 500mg",
        "generic_name": "Amoxicilina",
        "brand_name": "Amoxil",
        "dosage_form": "tablet",
        "strength": "500mg",
        "unit": "tablet",
        "requires_prescription": True,
        "controlled_substance": False,
    }


@pytest.fixture
def sample_prescription_data():
    """Datos de muestra para crear una prescripción."""
    return {
        "patient_id": str(uuid.uuid4()),
        "medication_id": str(uuid.uuid4()),
        "dosage": "500mg",
        "frequency": "cada 8 horas",
        "duration_days": 7,
        "quantity": 21,
        "instructions": "Tomar con alimentos",
        "refills_allowed": 0,
    }


@pytest.fixture
def sample_inventory_data():
    """Datos de muestra para inventario de medicamento."""
    return {
        "quantity": 100,
        "unit_cost": 15.50,
        "selling_price": 25.00,
        "expiration_date": (date.today() + timedelta(days=365)).isoformat(),
        "batch_number": "BATCH-2024-001",
        "supplier": "Farmacia Distribuidora XYZ",
    }


@pytest.fixture
async def sample_patient(client: AsyncClient, auth_headers):
    """Crea un paciente de prueba."""
    patient_data = {
        "first_name": "Ana",
        "last_name": "García",
        "birth_date": "1992-08-10",
        "gender": "F",
        "document_type": "cedula",
        "document_number": "00187654321",
        "phone": "8095558888",
        "email": "ana.garcia@example.com",
    }
    response = await client.post(
        "/api/v1/patients",
        headers=auth_headers,
        json=patient_data,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def sample_medication(client: AsyncClient, auth_headers):
    """Crea un medicamento de prueba."""
    medication_data = {
        "name": "Paracetamol 500mg",
        "generic_name": "Paracetamol",
        "dosage_form": "tablet",
        "strength": "500mg",
        "unit": "tablet",
        "requires_prescription": False,
    }
    response = await client.post(
        "/api/v1/pharmacy/medications",
        headers=auth_headers,
        json=medication_data,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def sample_prescription(client: AsyncClient, auth_headers, sample_patient, sample_medication):
    """Crea una prescripción de prueba."""
    prescription_data = {
        "patient_id": sample_patient["id"],
        "medication_id": sample_medication["id"],
        "dosage": "500mg",
        "frequency": "cada 6 horas",
        "duration_days": 5,
        "quantity": 20,
        "instructions": "Tomar después de las comidas",
    }
    response = await client.post(
        "/api/v1/pharmacy/prescriptions",
        headers=auth_headers,
        json=prescription_data,
    )
    assert response.status_code == 201
    return response.json()


# =============================================
# Tests: Medicamentos
# =============================================

class TestCreateMedication:
    """Tests para POST /api/v1/pharmacy/medications."""

    @pytest.mark.asyncio
    async def test_crear_medicamento_exitoso(
        self, client: AsyncClient, auth_headers
    ):
        """Crear medicamento con datos válidos retorna 201."""
        medication_data = {
            "name": "Ibuprofeno 400mg",
            "generic_name": "Ibuprofeno",
            "brand_name": "Advil",
            "dosage_form": "tablet",
            "strength": "400mg",
            "unit": "tablet",
            "requires_prescription": False,
        }

        response = await client.post(
            "/api/v1/pharmacy/medications",
            headers=auth_headers,
            json=medication_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Ibuprofeno 400mg"
        assert data["generic_name"] == "Ibuprofeno"
        assert data["requires_prescription"] is False
        assert "id" in data

    @pytest.mark.asyncio
    async def test_crear_medicamento_sin_nombre_retorna_422(
        self, client: AsyncClient, auth_headers
    ):
        """Crear medicamento sin nombre retorna 422."""
        medication_data = {
            "generic_name": "Ibuprofeno",
            "dosage_form": "tablet",
        }

        response = await client.post(
            "/api/v1/pharmacy/medications",
            headers=auth_headers,
            json=medication_data,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_medicamento_sin_auth_retorna_403(
        self, client: AsyncClient
    ):
        """Crear medicamento sin autenticación retorna 403."""
        medication_data = {
            "name": "Test Med",
            "generic_name": "Test",
            "dosage_form": "tablet",
        }

        response = await client.post(
            "/api/v1/pharmacy/medications",
            json=medication_data,
        )

        assert response.status_code == 403


class TestGetMedication:
    """Tests para GET /api/v1/pharmacy/medications/{id}."""

    @pytest.mark.asyncio
    async def test_obtener_medicamento_por_id(
        self, client: AsyncClient, auth_headers, sample_medication
    ):
        """Obtener medicamento existente por UUID retorna 200."""
        response = await client.get(
            f"/api/v1/pharmacy/medications/{sample_medication['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_medication["id"]
        assert data["name"] == sample_medication["name"]

    @pytest.mark.asyncio
    async def test_obtener_medicamento_inexistente_retorna_404(
        self, client: AsyncClient, auth_headers
    ):
        """Obtener medicamento inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/pharmacy/medications/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestListMedications:
    """Tests para GET /api/v1/pharmacy/medications."""

    @pytest.mark.asyncio
    async def test_listar_medicamentos_sin_filtros(
        self, client: AsyncClient, auth_headers, sample_medication
    ):
        """Listar medicamentos sin filtros retorna 200."""
        response = await client.get(
            "/api/v1/pharmacy/medications",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) > 0

    @pytest.mark.asyncio
    async def test_buscar_medicamentos_por_nombre(
        self, client: AsyncClient, auth_headers, sample_medication
    ):
        """Buscar medicamentos por nombre retorna resultados."""
        response = await client.get(
            f"/api/v1/pharmacy/medications?search={sample_medication['generic_name']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1


# =============================================
# Tests: Prescripciones
# =============================================

class TestCreatePrescription:
    """Tests para POST /api/v1/pharmacy/prescriptions."""

    @pytest.mark.asyncio
    async def test_crear_prescripcion_exitosa(
        self, client: AsyncClient, auth_headers, sample_patient, sample_medication
    ):
        """Crear prescripción con datos válidos retorna 201."""
        prescription_data = {
            "patient_id": sample_patient["id"],
            "medication_id": sample_medication["id"],
            "dosage": "500mg",
            "frequency": "cada 8 horas",
            "duration_days": 7,
            "quantity": 21,
            "instructions": "Tomar con alimentos",
        }

        response = await client.post(
            "/api/v1/pharmacy/prescriptions",
            headers=auth_headers,
            json=prescription_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["patient_id"] == sample_patient["id"]
        assert data["medication_id"] == sample_medication["id"]
        assert data["status"] == "active"
        assert data["quantity"] == 21

    @pytest.mark.asyncio
    async def test_crear_prescripcion_sin_patient_id_retorna_422(
        self, client: AsyncClient, auth_headers, sample_medication
    ):
        """Crear prescripción sin patient_id retorna 422."""
        prescription_data = {
            "medication_id": sample_medication["id"],
            "dosage": "500mg",
            "quantity": 10,
        }

        response = await client.post(
            "/api/v1/pharmacy/prescriptions",
            headers=auth_headers,
            json=prescription_data,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_prescripcion_con_cantidad_negativa_retorna_422(
        self, client: AsyncClient, auth_headers, sample_patient, sample_medication
    ):
        """Crear prescripción con cantidad negativa retorna 422."""
        prescription_data = {
            "patient_id": sample_patient["id"],
            "medication_id": sample_medication["id"],
            "dosage": "500mg",
            "quantity": -10,
        }

        response = await client.post(
            "/api/v1/pharmacy/prescriptions",
            headers=auth_headers,
            json=prescription_data,
        )

        assert response.status_code == 422


class TestGetPrescription:
    """Tests para GET /api/v1/pharmacy/prescriptions/{id}."""

    @pytest.mark.asyncio
    async def test_obtener_prescripcion_por_id(
        self, client: AsyncClient, auth_headers, sample_prescription
    ):
        """Obtener prescripción existente por UUID retorna 200."""
        response = await client.get(
            f"/api/v1/pharmacy/prescriptions/{sample_prescription['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_prescription["id"]

    @pytest.mark.asyncio
    async def test_obtener_prescripcion_inexistente_retorna_404(
        self, client: AsyncClient, auth_headers
    ):
        """Obtener prescripción inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/pharmacy/prescriptions/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestListPrescriptions:
    """Tests para GET /api/v1/pharmacy/prescriptions."""

    @pytest.mark.asyncio
    async def test_listar_prescripciones_por_patient_id(
        self, client: AsyncClient, auth_headers, sample_patient, sample_prescription
    ):
        """Listar prescripciones filtradas por patient_id retorna resultados."""
        response = await client.get(
            f"/api/v1/pharmacy/prescriptions?patient_id={sample_patient['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert all(p["patient_id"] == sample_patient["id"] for p in data["items"])


# =============================================
# Tests: Dispensación
# =============================================

class TestDispensePrescription:
    """Tests para POST /api/v1/pharmacy/prescriptions/{id}/dispense."""

    @pytest.mark.asyncio
    async def test_dispensar_prescripcion_exitoso(
        self, client: AsyncClient, auth_headers, sample_prescription
    ):
        """Dispensar prescripción con datos válidos retorna 200."""
        dispense_data = {
            "quantity": 20,
            "dispensed_by": str(uuid.uuid4()),
            "notes": "Dispensado completo",
        }

        response = await client.post(
            f"/api/v1/pharmacy/prescriptions/{sample_prescription['id']}/dispense",
            headers=auth_headers,
            json=dispense_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["quantity"] == 20
        assert data["status"] == "dispensed"

    @pytest.mark.asyncio
    async def test_dispensar_cantidad_excesiva_retorna_422(
        self, client: AsyncClient, auth_headers, sample_prescription
    ):
        """Dispensar cantidad mayor a la prescrita retorna 422."""
        dispense_data = {
            "quantity": 999,  # Cantidad excesiva
        }

        response = await client.post(
            f"/api/v1/pharmacy/prescriptions/{sample_prescription['id']}/dispense",
            headers=auth_headers,
            json=dispense_data,
        )

        assert response.status_code == 422


# =============================================
# Tests: Inventario
# =============================================

class TestUpdateInventory:
    """Tests para PATCH /api/v1/pharmacy/medications/{id}/inventory."""

    @pytest.mark.asyncio
    async def test_actualizar_inventario_exitoso(
        self, client: AsyncClient, auth_headers, sample_medication
    ):
        """Actualizar inventario con datos válidos retorna 200."""
        inventory_data = {
            "quantity": 50,
            "unit_cost": 10.00,
            "selling_price": 20.00,
        }

        response = await client.patch(
            f"/api/v1/pharmacy/medications/{sample_medication['id']}/inventory",
            headers=auth_headers,
            json=inventory_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert "inventory" in data or "quantity" in data

    @pytest.mark.asyncio
    async def test_actualizar_inventario_con_cantidad_negativa_retorna_422(
        self, client: AsyncClient, auth_headers, sample_medication
    ):
        """Actualizar inventario con cantidad negativa retorna 422."""
        inventory_data = {
            "quantity": -10,
        }

        response = await client.patch(
            f"/api/v1/pharmacy/medications/{sample_medication['id']}/inventory",
            headers=auth_headers,
            json=inventory_data,
        )

        assert response.status_code == 422


class TestLowStockAlerts:
    """Tests para GET /api/v1/pharmacy/alerts/low-stock."""

    @pytest.mark.asyncio
    async def test_obtener_alertas_stock_bajo(
        self, client: AsyncClient, auth_headers
    ):
        """Obtener alertas de stock bajo retorna 200."""
        response = await client.get(
            "/api/v1/pharmacy/alerts/low-stock",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data or isinstance(data, list)


class TestExpiringMedications:
    """Tests para GET /api/v1/pharmacy/alerts/expiring."""

    @pytest.mark.asyncio
    async def test_obtener_medicamentos_por_vencer(
        self, client: AsyncClient, auth_headers
    ):
        """Obtener medicamentos próximos a vencer retorna 200."""
        response = await client.get(
            "/api/v1/pharmacy/alerts/expiring?days=90",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data or isinstance(data, list)


# =============================================
# Tests: Estadísticas
# =============================================

class TestPharmacyStats:
    """Tests para GET /api/v1/pharmacy/stats."""

    @pytest.mark.asyncio
    async def test_obtener_estadisticas_farmacia(
        self, client: AsyncClient, auth_headers, sample_prescription
    ):
        """Obtener estadísticas de farmacia retorna 200."""
        response = await client.get(
            "/api/v1/pharmacy/stats",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Verificar que existen métricas básicas
        assert "total_medications" in data or "prescriptions_count" in data
