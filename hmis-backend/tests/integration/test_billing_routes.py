"""
Tests de integración para las rutas de facturación (/api/v1/billing).
Valida facturas, pagos, compañías de seguros y reclamos.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient


# =============================================
# Fixtures
# =============================================

@pytest.fixture
def sample_invoice_data():
    """Datos de muestra para crear una factura."""
    return {
        "patient_id": str(uuid.uuid4()),
        "issue_date": date.today().isoformat(),
        "due_date": (date.today() + timedelta(days=30)).isoformat(),
        "items": [
            {
                "description": "Consulta médica general",
                "quantity": 1,
                "unit_price": 500.00,
            },
            {
                "description": "Laboratorio - Hemograma",
                "quantity": 1,
                "unit_price": 300.00,
            },
        ],
        "notes": "Factura de consulta y estudios",
    }


@pytest.fixture
def sample_payment_data():
    """Datos de muestra para registrar un pago."""
    return {
        "amount": 800.00,
        "payment_method": "cash",
        "reference": "PAY-12345",
        "notes": "Pago completo en efectivo",
    }


@pytest.fixture
def sample_insurance_company_data():
    """Datos de muestra para compañía de seguros."""
    return {
        "name": "Seguro Universal",
        "code": "SU001",
        "contact_name": "María Gómez",
        "phone": "8095551111",
        "email": "contacto@segurouniversal.com",
        "address": "Av. Principal #123",
        "payment_terms_days": 45,
        "is_active": True,
    }


@pytest.fixture
async def sample_patient(client: AsyncClient, auth_headers):
    """Crea un paciente de prueba."""
    patient_data = {
        "first_name": "Carlos",
        "last_name": "Martínez",
        "birth_date": "1985-03-20",
        "gender": "M",
        "document_type": "cedula",
        "document_number": "00198765432",
        "phone": "8095559999",
        "email": "carlos.martinez@example.com",
    }
    response = await client.post(
        "/api/v1/patients",
        headers=auth_headers,
        json=patient_data,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def sample_invoice(client: AsyncClient, auth_headers, sample_patient):
    """Crea una factura de prueba."""
    invoice_data = {
        "patient_id": sample_patient["id"],
        "issue_date": date.today().isoformat(),
        "due_date": (date.today() + timedelta(days=30)).isoformat(),
        "items": [
            {
                "description": "Consulta médica",
                "quantity": 1,
                "unit_price": 500.00,
            },
        ],
    }
    response = await client.post(
        "/api/v1/billing/invoices",
        headers=auth_headers,
        json=invoice_data,
    )
    assert response.status_code == 201
    return response.json()


# =============================================
# Tests: Facturas
# =============================================

class TestCreateInvoice:
    """Tests para POST /api/v1/billing/invoices."""

    @pytest.mark.asyncio
    async def test_crear_factura_exitosa(
        self, client: AsyncClient, auth_headers, sample_patient
    ):
        """Crear factura con datos válidos retorna 201."""
        invoice_data = {
            "patient_id": sample_patient["id"],
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "items": [
                {
                    "description": "Consulta médica",
                    "quantity": 1,
                    "unit_price": 500.00,
                },
                {
                    "description": "Laboratorio",
                    "quantity": 2,
                    "unit_price": 150.00,
                },
            ],
        }

        response = await client.post(
            "/api/v1/billing/invoices",
            headers=auth_headers,
            json=invoice_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["patient_id"] == sample_patient["id"]
        assert data["status"] == "draft"
        assert "invoice_number" in data
        assert len(data["items"]) == 2
        # Verificar cálculos
        assert float(data["subtotal"]) == 800.00  # 500 + (150 * 2)

    @pytest.mark.asyncio
    async def test_crear_factura_sin_items_retorna_422(
        self, client: AsyncClient, auth_headers, sample_patient
    ):
        """Crear factura sin items retorna 422."""
        invoice_data = {
            "patient_id": sample_patient["id"],
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "items": [],
        }

        response = await client.post(
            "/api/v1/billing/invoices",
            headers=auth_headers,
            json=invoice_data,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_factura_con_precio_negativo_retorna_422(
        self, client: AsyncClient, auth_headers, sample_patient
    ):
        """Crear factura con precio negativo retorna 422."""
        invoice_data = {
            "patient_id": sample_patient["id"],
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "items": [
                {
                    "description": "Item inválido",
                    "quantity": 1,
                    "unit_price": -100.00,
                },
            ],
        }

        response = await client.post(
            "/api/v1/billing/invoices",
            headers=auth_headers,
            json=invoice_data,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_crear_factura_sin_auth_retorna_403(
        self, client: AsyncClient, sample_patient
    ):
        """Crear factura sin autenticación retorna 403."""
        invoice_data = {
            "patient_id": sample_patient["id"],
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "items": [{"description": "Test", "quantity": 1, "unit_price": 100.00}],
        }

        response = await client.post(
            "/api/v1/billing/invoices",
            json=invoice_data,
        )

        assert response.status_code == 403


class TestGetInvoice:
    """Tests para GET /api/v1/billing/invoices/{id}."""

    @pytest.mark.asyncio
    async def test_obtener_factura_por_id(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Obtener factura existente por UUID retorna 200."""
        response = await client.get(
            f"/api/v1/billing/invoices/{sample_invoice['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_invoice["id"]
        assert data["invoice_number"] == sample_invoice["invoice_number"]

    @pytest.mark.asyncio
    async def test_obtener_factura_inexistente_retorna_404(
        self, client: AsyncClient, auth_headers
    ):
        """Obtener factura inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/billing/invoices/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestListInvoices:
    """Tests para GET /api/v1/billing/invoices."""

    @pytest.mark.asyncio
    async def test_listar_facturas_sin_filtros(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Listar facturas sin filtros retorna 200."""
        response = await client.get(
            "/api/v1/billing/invoices",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) > 0

    @pytest.mark.asyncio
    async def test_listar_facturas_por_patient_id(
        self, client: AsyncClient, auth_headers, sample_patient, sample_invoice
    ):
        """Listar facturas filtradas por patient_id retorna resultados."""
        response = await client.get(
            f"/api/v1/billing/invoices?patient_id={sample_patient['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert all(inv["patient_id"] == sample_patient["id"] for inv in data["items"])

    @pytest.mark.asyncio
    async def test_listar_facturas_por_estado(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Listar facturas filtradas por estado retorna resultados."""
        response = await client.get(
            "/api/v1/billing/invoices?status=draft",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert all(inv["status"] == "draft" for inv in data["items"])


# =============================================
# Tests: Pagos
# =============================================

class TestRecordPayment:
    """Tests para POST /api/v1/billing/invoices/{id}/payments."""

    @pytest.mark.asyncio
    async def test_registrar_pago_exitoso(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Registrar pago con datos válidos retorna 201."""
        payment_data = {
            "amount": 500.00,
            "payment_method": "cash",
            "reference": "PAY-001",
        }

        response = await client.post(
            f"/api/v1/billing/invoices/{sample_invoice['id']}/payments",
            headers=auth_headers,
            json=payment_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["payment_method"] == "cash"
        assert float(data["amount"]) == 500.00

    @pytest.mark.asyncio
    async def test_registrar_pago_excede_balance_retorna_422(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Registrar pago que excede balance retorna 422."""
        payment_data = {
            "amount": 999999.00,  # Monto excesivo
            "payment_method": "cash",
        }

        response = await client.post(
            f"/api/v1/billing/invoices/{sample_invoice['id']}/payments",
            headers=auth_headers,
            json=payment_data,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_registrar_pago_con_monto_negativo_retorna_422(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Registrar pago con monto negativo retorna 422."""
        payment_data = {
            "amount": -100.00,
            "payment_method": "cash",
        }

        response = await client.post(
            f"/api/v1/billing/invoices/{sample_invoice['id']}/payments",
            headers=auth_headers,
            json=payment_data,
        )

        assert response.status_code == 422


class TestUpdateInvoiceStatus:
    """Tests para PATCH /api/v1/billing/invoices/{id}/status."""

    @pytest.mark.asyncio
    async def test_actualizar_estado_factura_exitoso(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Actualizar estado de factura retorna 200."""
        status_update = {"status": "sent"}

        response = await client.patch(
            f"/api/v1/billing/invoices/{sample_invoice['id']}/status",
            headers=auth_headers,
            json=status_update,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "sent"

    @pytest.mark.asyncio
    async def test_actualizar_estado_invalido_retorna_422(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Actualizar estado a valor inválido retorna 422."""
        status_update = {"status": "invalid_status"}

        response = await client.patch(
            f"/api/v1/billing/invoices/{sample_invoice['id']}/status",
            headers=auth_headers,
            json=status_update,
        )

        assert response.status_code == 422


# =============================================
# Tests: Compañías de Seguros
# =============================================

class TestCreateInsuranceCompany:
    """Tests para POST /api/v1/billing/insurance-companies."""

    @pytest.mark.asyncio
    async def test_crear_compania_seguro_exitoso(
        self, client: AsyncClient, auth_headers
    ):
        """Crear compañía de seguros con datos válidos retorna 201."""
        company_data = {
            "name": "Seguro Universal",
            "code": "SU001",
            "contact_name": "María Gómez",
            "phone": "8095551111",
            "email": "contacto@segurouniversal.com",
            "payment_terms_days": 45,
        }

        response = await client.post(
            "/api/v1/billing/insurance-companies",
            headers=auth_headers,
            json=company_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Seguro Universal"
        assert data["code"] == "SU001"
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_crear_compania_sin_nombre_retorna_422(
        self, client: AsyncClient, auth_headers
    ):
        """Crear compañía sin nombre retorna 422."""
        company_data = {
            "code": "SU001",
            "phone": "8095551111",
        }

        response = await client.post(
            "/api/v1/billing/insurance-companies",
            headers=auth_headers,
            json=company_data,
        )

        assert response.status_code == 422


class TestListInsuranceCompanies:
    """Tests para GET /api/v1/billing/insurance-companies."""

    @pytest.mark.asyncio
    async def test_listar_companias_seguro(
        self, client: AsyncClient, auth_headers
    ):
        """Listar compañías de seguro retorna 200."""
        # Crear una compañía primero
        company_data = {
            "name": "Seguro Test",
            "code": "ST001",
            "phone": "8095550000",
        }
        await client.post(
            "/api/v1/billing/insurance-companies",
            headers=auth_headers,
            json=company_data,
        )

        # Listar
        response = await client.get(
            "/api/v1/billing/insurance-companies",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0


# =============================================
# Tests: Estadísticas
# =============================================

class TestBillingStats:
    """Tests para GET /api/v1/billing/stats."""

    @pytest.mark.asyncio
    async def test_obtener_estadisticas_facturacion(
        self, client: AsyncClient, auth_headers, sample_invoice
    ):
        """Obtener estadísticas de facturación retorna 200."""
        response = await client.get(
            "/api/v1/billing/stats",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_billed" in data
        assert "total_collected" in data
        assert "total_pending" in data
        assert "invoices_count" in data
