"""
Tests de integración para las rutas de Billing (/api/v1/billing).
Valida CRUD de facturas, pagos, reclamaciones de seguros y reportes.
"""

import uuid
from datetime import date, datetime, timezone

import pytest
from httpx import AsyncClient


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def sample_invoice_data(sample_patient):
    """Datos de ejemplo para crear una factura."""
    return {
        "patient_id": str(sample_patient.id),
        "currency": "DOP",
        "fiscal_type": "B01",
        "lines": [
            {
                "service_code": "CONS001",
                "description": "Consulta general",
                "quantity": 1,
                "unit_price": 1000.00,
            }
        ],
    }


@pytest.fixture
def sample_payment_data():
    """Datos de ejemplo para registrar un pago."""
    return {
        "amount": 500.00,
        "payment_method": "cash",
        "payment_date": datetime.now(timezone.utc).isoformat(),
        "reference_number": "PAY-TEST-001",
    }


# ============================================================
# Tests: Facturas
# ============================================================

class TestCreateInvoice:
    """Tests para POST /api/v1/billing/invoices."""

    @pytest.mark.asyncio
    async def test_crear_factura_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_invoice_data
    ):
        """Crear factura con datos válidos retorna 201."""
        response = await client.post(
            "/api/v1/billing/invoices",
            headers=admin_auth_headers,
            json=sample_invoice_data,
        )
        assert response.status_code == 201
        data = response.json()
        assert "invoice_number" in data
        assert data["status"] == "draft"
        assert data["currency"] == "DOP"
        assert float(data["subtotal"]) > 0

    @pytest.mark.asyncio
    async def test_crear_factura_sin_lineas_retorna_422(
        self, client: AsyncClient, admin_auth_headers, sample_invoice_data
    ):
        """Crear factura sin líneas retorna 422."""
        invalid_data = sample_invoice_data.copy()
        invalid_data["lines"] = []

        response = await client.post(
            "/api/v1/billing/invoices",
            headers=admin_auth_headers,
            json=invalid_data,
        )
        assert response.status_code == 422


class TestGetInvoice:
    """Tests para GET /api/v1/billing/invoices/{id}."""

    @pytest.mark.asyncio
    async def test_obtener_factura_existente(
        self, client: AsyncClient, admin_auth_headers, sample_invoice_data
    ):
        """Obtener factura existente retorna 200."""
        # Crear factura
        create_resp = await client.post(
            "/api/v1/billing/invoices",
            headers=admin_auth_headers,
            json=sample_invoice_data,
        )
        invoice_id = create_resp.json()["id"]

        # Obtener factura
        response = await client.get(
            f"/api/v1/billing/invoices/{invoice_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == invoice_id

    @pytest.mark.asyncio
    async def test_obtener_factura_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Obtener factura inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/billing/invoices/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404


class TestIssueInvoice:
    """Tests para POST /api/v1/billing/invoices/{id}/issue."""

    @pytest.mark.asyncio
    async def test_emitir_factura_draft_exitoso(
        self, client: AsyncClient, admin_auth_headers, sample_invoice_data
    ):
        """Emitir factura en estado draft retorna 200."""
        # Crear factura
        create_resp = await client.post(
            "/api/v1/billing/invoices",
            headers=admin_auth_headers,
            json=sample_invoice_data,
        )
        invoice_id = create_resp.json()["id"]

        # Emitir factura
        response = await client.post(
            f"/api/v1/billing/invoices/{invoice_id}/issue",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "issued"
        assert data["fiscal_number"] is not None


# ============================================================
# Tests: Pagos
# ============================================================

class TestRecordPayment:
    """Tests para POST /api/v1/billing/invoices/{id}/payments."""

    @pytest.mark.asyncio
    async def test_registrar_pago_exitoso(
        self,
        client: AsyncClient,
        admin_auth_headers,
        sample_invoice_data,
        sample_payment_data,
    ):
        """Registrar pago a factura retorna 201."""
        # Crear y emitir factura
        create_resp = await client.post(
            "/api/v1/billing/invoices",
            headers=admin_auth_headers,
            json=sample_invoice_data,
        )
        invoice_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/billing/invoices/{invoice_id}/issue",
            headers=admin_auth_headers,
        )

        # Registrar pago
        response = await client.post(
            f"/api/v1/billing/invoices/{invoice_id}/payments",
            headers=admin_auth_headers,
            json=sample_payment_data,
        )
        assert response.status_code == 201
        data = response.json()
        assert float(data["amount"]) == 500.00
        assert data["payment_method"] == "cash"


# ============================================================
# Tests: Reportes
# ============================================================

class TestARAgingReport:
    """Tests para GET /api/v1/billing/reports/ar-aging."""

    @pytest.mark.asyncio
    async def test_obtener_reporte_ar_aging(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Obtener reporte de cuentas por cobrar retorna 200."""
        response = await client.get(
            "/api/v1/billing/reports/ar-aging",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_receivable" in data
        assert "summary" in data
        assert "items" in data


class TestListInvoices:
    """Tests para GET /api/v1/billing/invoices."""

    @pytest.mark.asyncio
    async def test_listar_facturas_con_paginacion(
        self, client: AsyncClient, admin_auth_headers, sample_invoice_data
    ):
        """Listar facturas retorna paginación correcta."""
        # Crear 2 facturas
        for _ in range(2):
            await client.post(
                "/api/v1/billing/invoices",
                headers=admin_auth_headers,
                json=sample_invoice_data,
            )

        # Listar
        response = await client.get(
            "/api/v1/billing/invoices?page=1&page_size=10",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 2
