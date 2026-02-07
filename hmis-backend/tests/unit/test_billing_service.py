"""
Tests unitarios para los servicios del modulo de Facturacion y Contabilidad.
Cubre: cargos, facturas, pagos, reclamaciones, contabilidad, anulaciones,
notas de credito y reversiones de pago.

Utiliza base de datos SQLite en memoria (fixture db_session) y mockea
la publicacion de eventos Redis (mock_event_publish autouse + patch local).
"""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

# =============================================
# Compatibilidad SQLite: registrar compiladores para tipos PostgreSQL
# SQLite no soporta JSONB ni UUID nativos; se mapean a JSON y CHAR(32).
# Estos registros se ejecutan al importar el modulo, antes de create_all.
# =============================================


@compiles(JSONB, "sqlite")
def _compile_jsonb_para_sqlite(element, compiler, **kw):
    """Renderiza columnas JSONB como JSON en SQLite."""
    return "JSON"


@compiles(PG_UUID, "sqlite")
def _compile_uuid_para_sqlite(element, compiler, **kw):
    """Renderiza columnas UUID de PostgreSQL como CHAR(32) en SQLite."""
    return "CHAR(32)"


from app.modules.billing.models import (
    Account,
    ChargeItem,
    CreditNote,
    CreditNoteLine,
    InsuranceClaim,
    Invoice,
    InvoiceLine,
    JournalEntry,
    JournalEntryLine,
    Payment,
    ServiceCatalog,
)
from app.modules.billing.schemas import (
    ChargeItemCreate,
    InsuranceClaimCreate,
    InsuranceClaimStatusUpdate,
    InvoiceCreate,
    PaymentCreate,
)
from app.modules.billing.service import (
    ChargeService,
    InsuranceClaimService,
    InvoiceService,
    InvoiceVoidService,
    PaymentReversalService,
    PaymentService,
)
from app.modules.billing.accounting_service import (
    AccountingService,
    CreditNoteService,
    DEFAULT_ACCOUNTS,
)


# =============================================
# Fixtures y helpers especificos de facturacion
# =============================================


@pytest.fixture
def mock_billing_publish():
    """Mockea la funcion publish importada en el modulo de servicio de facturacion."""
    with patch(
        "app.modules.billing.service.publish", new_callable=AsyncMock
    ) as mock_pub:
        yield mock_pub


async def _crear_servicio_catalogo(
    db: AsyncSession,
    code: str = "SRV-001",
    name: str = "Consulta General",
    category: str = "consulta",
    base_price: float = 1500.00,
    tax_rate: float = 0.18,
) -> ServiceCatalog:
    """Crea un servicio en el catalogo de prueba y lo persiste en BD."""
    servicio = ServiceCatalog(
        code=code,
        name=name,
        category=category,
        base_price=base_price,
        tax_rate=tax_rate,
        currency="DOP",
    )
    db.add(servicio)
    await db.flush()
    return servicio


async def _crear_factura(
    db: AsyncSession,
    patient_id: uuid.UUID | None = None,
    invoice_number: str = "FAC-00000001",
    subtotal: float = 1500.00,
    tax_total: float = 270.00,
    discount_total: float = 0.0,
    grand_total: float = 1770.00,
    status: str = "issued",
    country_code: str = "US",
    customer_name: str = "Paciente Prueba",
) -> Invoice:
    """Crea una factura directamente en BD para usar como dependencia en tests."""
    factura = Invoice(
        patient_id=patient_id or uuid.uuid4(),
        invoice_number=invoice_number,
        subtotal=subtotal,
        tax_total=tax_total,
        discount_total=discount_total,
        grand_total=grand_total,
        currency="DOP",
        status=status,
        country_code=country_code,
        customer_name=customer_name,
    )
    db.add(factura)
    await db.flush()
    return factura


async def _crear_cargo(
    db: AsyncSession,
    service_id: uuid.UUID,
    patient_id: uuid.UUID | None = None,
    encounter_id: uuid.UUID | None = None,
    unit_price: float = 1500.00,
    quantity: int = 1,
    discount: float = 0.0,
    tax: float = 270.00,
    total: float = 1770.00,
    patient_responsibility: float = 1770.00,
    status: str = "pending",
) -> ChargeItem:
    """Crea un cargo directamente en BD."""
    cargo = ChargeItem(
        encounter_id=encounter_id or uuid.uuid4(),
        patient_id=patient_id or uuid.uuid4(),
        service_id=service_id,
        description="Cargo de prueba",
        quantity=quantity,
        unit_price=unit_price,
        discount=discount,
        tax=tax,
        total=total,
        covered_by_insurance=0.0,
        patient_responsibility=patient_responsibility,
        status=status,
    )
    db.add(cargo)
    await db.flush()
    return cargo


async def _seed_plan_contable(db: AsyncSession) -> int:
    """Inicializa el plan de cuentas contables para tests de contabilidad."""
    svc = AccountingService(db)
    return await svc.seed_chart_of_accounts()


# =============================================
# Tests de ChargeService
# =============================================


class TestChargeService:
    """Tests del servicio de cargos medicos."""

    @pytest.mark.asyncio
    async def test_crear_cargo_calcula_impuesto_y_total(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Verifica que al crear un cargo se calculan impuesto, total
        y responsabilidad del paciente basandose en el tax_rate del servicio."""
        servicio = await _crear_servicio_catalogo(
            db_session, tax_rate=0.18, base_price=2000.00
        )
        patient_id = uuid.uuid4()
        encounter_id = uuid.uuid4()

        data = ChargeItemCreate(
            encounter_id=encounter_id,
            patient_id=patient_id,
            service_id=servicio.id,
            description="Consulta especialidad",
            quantity=1,
            unit_price=2000.00,
            discount=0.0,
            covered_by_insurance=0.0,
        )

        svc = ChargeService(db_session)
        cargo = await svc.create_charge(data, charged_by=uuid.uuid4())

        # subtotal = 1*2000 - 0 = 2000; tax = 2000 * 0.18 = 360
        assert float(cargo.tax) == 360.00, "El impuesto debe ser 18% del subtotal"
        assert float(cargo.total) == 2360.00, "El total incluye subtotal + impuesto"
        assert float(cargo.patient_responsibility) == 2360.00, (
            "Sin cobertura de seguro, el paciente asume el total"
        )
        assert cargo.status == "pending", "El cargo inicial debe estar en estado pendiente"

    @pytest.mark.asyncio
    async def test_crear_cargo_con_descuento_y_cobertura_seguro(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Verifica el calculo de responsabilidad del paciente cuando hay
        descuento y cobertura de seguro."""
        servicio = await _crear_servicio_catalogo(
            db_session, code="SRV-002", tax_rate=0.18
        )
        data = ChargeItemCreate(
            encounter_id=uuid.uuid4(),
            patient_id=uuid.uuid4(),
            service_id=servicio.id,
            description="Laboratorio con descuento",
            quantity=2,
            unit_price=500.00,
            discount=100.00,
            covered_by_insurance=300.00,
        )

        svc = ChargeService(db_session)
        cargo = await svc.create_charge(data)

        # subtotal = 2*500 - 100 = 900; tax = 900 * 0.18 = 162
        # total = 900 + 162 = 1062; responsabilidad = 1062 - 300 = 762
        assert float(cargo.tax) == 162.00, "El impuesto se calcula sobre el subtotal neto"
        assert float(cargo.total) == 1062.00, "Total = subtotal + impuesto"
        assert float(cargo.patient_responsibility) == 762.00, (
            "La responsabilidad descuenta la cobertura de seguro"
        )

    @pytest.mark.asyncio
    async def test_crear_cargo_sin_servicio_en_catalogo_impuesto_cero(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Si el service_id no corresponde a un servicio existente,
        el impuesto se calcula como 0."""
        servicio_fantasma = uuid.uuid4()
        data = ChargeItemCreate(
            encounter_id=uuid.uuid4(),
            patient_id=uuid.uuid4(),
            service_id=servicio_fantasma,
            description="Servicio inexistente",
            quantity=1,
            unit_price=1000.00,
            discount=0.0,
            covered_by_insurance=0.0,
        )

        svc = ChargeService(db_session)
        cargo = await svc.create_charge(data)

        assert float(cargo.tax) == 0.00, "Sin servicio en catalogo, impuesto debe ser 0"
        assert float(cargo.total) == 1000.00, "Total = subtotal cuando impuesto es 0"

    @pytest.mark.asyncio
    async def test_obtener_cargos_por_paciente(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Verifica que se pueden listar los cargos de un paciente especifico."""
        servicio = await _crear_servicio_catalogo(db_session, code="SRV-003")
        patient_id = uuid.uuid4()

        # Crear 2 cargos para el mismo paciente
        await _crear_cargo(db_session, service_id=servicio.id, patient_id=patient_id)
        await _crear_cargo(db_session, service_id=servicio.id, patient_id=patient_id)
        # Cargo de otro paciente (no debe aparecer)
        await _crear_cargo(db_session, service_id=servicio.id, patient_id=uuid.uuid4())

        svc = ChargeService(db_session)
        cargos = await svc.get_patient_charges(patient_id)

        assert len(cargos) == 2, "Solo debe retornar los cargos del paciente indicado"

    @pytest.mark.asyncio
    async def test_obtener_cargos_filtra_por_estado(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Verifica que el filtro por estado funciona correctamente."""
        servicio = await _crear_servicio_catalogo(db_session, code="SRV-004")
        patient_id = uuid.uuid4()

        await _crear_cargo(
            db_session, service_id=servicio.id, patient_id=patient_id, status="pending"
        )
        await _crear_cargo(
            db_session, service_id=servicio.id, patient_id=patient_id, status="invoiced"
        )

        svc = ChargeService(db_session)
        cargos_pending = await svc.get_patient_charges(patient_id, status="pending")
        cargos_invoiced = await svc.get_patient_charges(patient_id, status="invoiced")

        assert len(cargos_pending) == 1, "Debe haber 1 cargo pendiente"
        assert len(cargos_invoiced) == 1, "Debe haber 1 cargo facturado"


# =============================================
# Tests de InvoiceService
# =============================================


class TestInvoiceService:
    """Tests del servicio de facturacion."""

    @pytest.mark.asyncio
    async def test_crear_factura_sin_cargos(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Crea una factura sin cargos asociados; los totales deben ser cero."""
        data = InvoiceCreate(
            patient_id=uuid.uuid4(),
            charge_item_ids=[],
            currency="DOP",
            customer_name="Pedro Martinez",
            country_code="US",
        )

        svc = InvoiceService(db_session)
        factura = await svc.create_invoice(data, created_by=uuid.uuid4())

        assert factura.invoice_number.startswith("FAC-"), "El numero debe tener prefijo FAC-"
        assert float(factura.subtotal) == 0.0, "Sin cargos, subtotal debe ser 0"
        assert float(factura.grand_total) == 0.0, "Sin cargos, total debe ser 0"
        assert factura.status == "issued", "La factura recien creada debe estar emitida"

    @pytest.mark.asyncio
    async def test_crear_factura_con_cargos_calcula_totales(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Verifica que al crear una factura con cargos pendientes
        se calculan los totales y se cambia el estado de los cargos a invoiced."""
        servicio = await _crear_servicio_catalogo(db_session, code="SRV-FAC-001")
        patient_id = uuid.uuid4()

        cargo1 = await _crear_cargo(
            db_session,
            service_id=servicio.id,
            patient_id=patient_id,
            unit_price=1000.00,
            quantity=1,
            discount=0.0,
            tax=180.00,
            total=1180.00,
            status="pending",
        )
        cargo2 = await _crear_cargo(
            db_session,
            service_id=servicio.id,
            patient_id=patient_id,
            unit_price=500.00,
            quantity=2,
            discount=50.00,
            tax=171.00,
            total=1121.00,
            status="pending",
        )

        data = InvoiceCreate(
            patient_id=patient_id,
            charge_item_ids=[cargo1.id, cargo2.id],
            currency="DOP",
            customer_name="Ana Ramirez",
            country_code="US",
        )

        svc = InvoiceService(db_session)
        factura = await svc.create_invoice(data, created_by=uuid.uuid4())

        # subtotal = (1000*1 - 0) + (500*2 - 50) = 1000 + 950 = 1950
        # tax_total = 180 + 171 = 351
        # grand_total = 1950 + 351 = 2301
        assert float(factura.subtotal) == 1950.00, "Subtotal es la suma de (price*qty - discount)"
        assert float(factura.tax_total) == 351.00, "Impuesto es la suma de impuestos individuales"
        assert float(factura.grand_total) == 2301.00, "Grand total = subtotal + impuestos"

        # Los cargos deben pasar a estado 'invoiced'
        await db_session.refresh(cargo1)
        await db_session.refresh(cargo2)
        assert cargo1.status == "invoiced", "Cargo 1 debe cambiar a facturado"
        assert cargo2.status == "invoiced", "Cargo 2 debe cambiar a facturado"

    @pytest.mark.asyncio
    async def test_obtener_factura_por_id(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Verifica que se puede recuperar una factura por su UUID."""
        factura = await _crear_factura(db_session, invoice_number="FAC-GET-001")

        svc = InvoiceService(db_session)
        resultado = await svc.get_invoice(factura.id)

        assert resultado is not None, "Debe encontrar la factura"
        assert resultado.id == factura.id, "El ID debe coincidir"
        assert resultado.invoice_number == "FAC-GET-001", "El numero de factura debe coincidir"

    @pytest.mark.asyncio
    async def test_obtener_factura_inexistente_retorna_none(
        self, db_session: AsyncSession
    ):
        """Buscar una factura con UUID inexistente retorna None."""
        svc = InvoiceService(db_session)
        resultado = await svc.get_invoice(uuid.uuid4())

        assert resultado is None, "Una factura inexistente debe retornar None"

    @pytest.mark.asyncio
    async def test_listar_facturas_con_filtro_paciente(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Filtra la lista de facturas por patient_id."""
        patient_a = uuid.uuid4()
        patient_b = uuid.uuid4()

        await _crear_factura(
            db_session, patient_id=patient_a, invoice_number="FAC-LIST-001"
        )
        await _crear_factura(
            db_session, patient_id=patient_a, invoice_number="FAC-LIST-002"
        )
        await _crear_factura(
            db_session, patient_id=patient_b, invoice_number="FAC-LIST-003"
        )

        svc = InvoiceService(db_session)
        facturas, total = await svc.list_invoices(patient_id=patient_a)

        assert total == 2, "Debe haber 2 facturas del paciente A"
        assert len(facturas) == 2, "La lista debe contener 2 facturas"

    @pytest.mark.asyncio
    async def test_listar_facturas_con_filtro_estado(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Filtra la lista de facturas por estado."""
        await _crear_factura(
            db_session, invoice_number="FAC-ST-001", status="issued"
        )
        await _crear_factura(
            db_session, invoice_number="FAC-ST-002", status="paid"
        )
        await _crear_factura(
            db_session, invoice_number="FAC-ST-003", status="issued"
        )

        svc = InvoiceService(db_session)
        facturas_issued, total_issued = await svc.list_invoices(status="issued")
        facturas_paid, total_paid = await svc.list_invoices(status="paid")

        assert total_issued == 2, "Debe haber 2 facturas emitidas"
        assert total_paid == 1, "Debe haber 1 factura pagada"

    @pytest.mark.asyncio
    async def test_numero_factura_secuencial(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Cada factura debe tener un numero secuencial incrementado."""
        data1 = InvoiceCreate(
            patient_id=uuid.uuid4(),
            charge_item_ids=[],
            country_code="US",
        )
        data2 = InvoiceCreate(
            patient_id=uuid.uuid4(),
            charge_item_ids=[],
            country_code="US",
        )

        svc = InvoiceService(db_session)
        fac1 = await svc.create_invoice(data1)
        fac2 = await svc.create_invoice(data2)

        assert fac1.invoice_number == "FAC-00000001", "Primera factura debe ser 00000001"
        assert fac2.invoice_number == "FAC-00000002", "Segunda factura debe ser 00000002"


# =============================================
# Tests de PaymentService
# =============================================


class TestPaymentService:
    """Tests del servicio de pagos."""

    @pytest.mark.asyncio
    async def test_registrar_pago_completo_marca_factura_pagada(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Un pago que cubre el total de la factura cambia el estado a 'paid'."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-PAY-001",
            grand_total=1000.00,
            subtotal=1000.00,
            tax_total=0.0,
        )

        data = PaymentCreate(
            invoice_id=factura.id,
            amount=1000.00,
            payment_method="cash",
            reference_number="REC-001",
        )

        svc = PaymentService(db_session)
        pago = await svc.record_payment(data, received_by=uuid.uuid4())

        assert pago is not None, "Debe crear el pago exitosamente"
        assert float(pago.amount) == 1000.00, "El monto del pago debe coincidir"
        assert pago.payment_method == "cash", "El metodo de pago debe ser efectivo"

        # Verificar que la factura cambio a 'paid'
        await db_session.refresh(factura)
        assert factura.status == "paid", "La factura debe marcarse como pagada"
        assert factura.paid_date is not None, "Debe registrar la fecha de pago"

    @pytest.mark.asyncio
    async def test_registrar_pago_parcial_marca_factura_partial(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Un pago menor al total marca la factura como 'partial'."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-PAY-002",
            grand_total=2000.00,
            subtotal=2000.00,
            tax_total=0.0,
        )

        data = PaymentCreate(
            invoice_id=factura.id,
            amount=500.00,
            payment_method="card",
            reference_number="CARD-001",
        )

        svc = PaymentService(db_session)
        pago = await svc.record_payment(data)

        await db_session.refresh(factura)
        assert factura.status == "partial", (
            "Un pago que no cubre el total debe marcar la factura como parcial"
        )

    @pytest.mark.asyncio
    async def test_multiples_pagos_completan_factura(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Verifica que pagos acumulados que igualan o superan el total
        marcan la factura como pagada. Se crean los pagos directamente
        y luego se verifica el calculo del servicio con el ultimo pago."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-PAY-003",
            grand_total=1000.00,
            subtotal=1000.00,
            tax_total=0.0,
        )

        # Crear el primer pago directamente en BD (sin pasar por el servicio)
        # para evitar problemas de cache del identity map de SQLAlchemy.
        pago_previo = Payment(
            invoice_id=factura.id,
            amount=600.00,
            payment_method="cash",
            is_active=True,
        )
        db_session.add(pago_previo)
        await db_session.flush()

        # El segundo pago SI pasa por el servicio, que recalcula el total
        svc = PaymentService(db_session)
        pago2_data = PaymentCreate(
            invoice_id=factura.id,
            amount=400.00,
            payment_method="transfer",
            reference_number="TRN-001",
        )
        await svc.record_payment(pago2_data)

        await db_session.refresh(factura)
        assert factura.status == "paid", (
            "Pagos acumulados (600+400=1000) deben completar la factura"
        )


# =============================================
# Tests de InsuranceClaimService
# =============================================


class TestInsuranceClaimService:
    """Tests del servicio de reclamaciones a aseguradoras."""

    @pytest.mark.asyncio
    async def test_crear_reclamacion_genera_numero(
        self, db_session: AsyncSession
    ):
        """Crear una reclamacion genera un numero secuencial CLM-."""
        data = InsuranceClaimCreate(
            patient_id=uuid.uuid4(),
            encounter_id=uuid.uuid4(),
            insurer_name="ARS Humano",
            insurer_code="ARS-HUM",
            policy_number="POL-12345",
            total_claimed=15000.00,
            notes="Reclamacion de consulta",
        )

        svc = InsuranceClaimService(db_session)
        claim = await svc.create_claim(data, created_by=uuid.uuid4())

        assert claim.claim_number == "CLM-00000001", "El numero debe ser secuencial"
        assert claim.status == "draft", "La reclamacion inicial debe estar en borrador"
        assert float(claim.total_claimed) == 15000.00, "El monto reclamado debe coincidir"

    @pytest.mark.asyncio
    async def test_enviar_reclamacion_en_borrador(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Solo reclamaciones en estado draft pueden enviarse."""
        data = InsuranceClaimCreate(
            patient_id=uuid.uuid4(),
            encounter_id=uuid.uuid4(),
            insurer_name="ARS Palic",
            policy_number="POL-67890",
            total_claimed=8000.00,
        )

        svc = InsuranceClaimService(db_session)
        claim = await svc.create_claim(data)
        assert claim.status == "draft"

        # Enviar la reclamacion
        enviada = await svc.submit_claim(claim.id)

        assert enviada is not None, "Debe retornar la reclamacion enviada"
        assert enviada.status == "submitted", "El estado debe cambiar a enviada"
        assert enviada.submitted_at is not None, "Debe registrar la fecha de envio"

    @pytest.mark.asyncio
    async def test_enviar_reclamacion_no_borrador_retorna_none(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Intentar enviar una reclamacion que no esta en borrador retorna None."""
        # Crear y enviar la reclamacion (pasa a submitted)
        data = InsuranceClaimCreate(
            patient_id=uuid.uuid4(),
            encounter_id=uuid.uuid4(),
            insurer_name="Senasa",
            policy_number="POL-SEN-01",
            total_claimed=5000.00,
        )

        svc = InsuranceClaimService(db_session)
        claim = await svc.create_claim(data)
        await svc.submit_claim(claim.id)

        # Intentar enviar de nuevo
        resultado = await svc.submit_claim(claim.id)

        assert resultado is None, "No debe poder enviarse una reclamacion ya enviada"

    @pytest.mark.asyncio
    async def test_actualizar_estado_reclamacion_aprobada(
        self, db_session: AsyncSession
    ):
        """Actualiza el estado de una reclamacion a pagada/aprobada."""
        data = InsuranceClaimCreate(
            patient_id=uuid.uuid4(),
            encounter_id=uuid.uuid4(),
            insurer_name="Mapfre Salud",
            policy_number="POL-MAP-01",
            total_claimed=12000.00,
        )

        svc = InsuranceClaimService(db_session)
        claim = await svc.create_claim(data)

        update_data = InsuranceClaimStatusUpdate(
            status="paid",
            total_approved=12000.00,
            total_denied=0.0,
        )
        actualizada = await svc.update_claim_status(
            claim.id, update_data, updated_by=uuid.uuid4()
        )

        assert actualizada is not None, "Debe retornar la reclamacion actualizada"
        assert actualizada.status == "paid", "El estado debe ser pagada"
        assert float(actualizada.total_approved) == 12000.00, "Monto aprobado debe coincidir"
        assert actualizada.adjudicated_at is not None, "Debe registrar fecha de adjudicacion"

    @pytest.mark.asyncio
    async def test_actualizar_estado_reclamacion_denegada(
        self, db_session: AsyncSession
    ):
        """Actualiza el estado de una reclamacion a denegada con razon."""
        data = InsuranceClaimCreate(
            patient_id=uuid.uuid4(),
            encounter_id=uuid.uuid4(),
            insurer_name="ARS Universal",
            policy_number="POL-UNI-01",
            total_claimed=9000.00,
        )

        svc = InsuranceClaimService(db_session)
        claim = await svc.create_claim(data)

        update_data = InsuranceClaimStatusUpdate(
            status="denied",
            total_denied=9000.00,
            denial_reason="Cobertura no aplicable para el procedimiento",
        )
        denegada = await svc.update_claim_status(claim.id, update_data)

        assert denegada.status == "denied", "El estado debe ser denegada"
        assert denegada.denial_reason is not None, "Debe tener razon de denegacion"
        assert denegada.adjudicated_at is not None, "Debe registrar fecha de adjudicacion"

    @pytest.mark.asyncio
    async def test_actualizar_reclamacion_inexistente_retorna_none(
        self, db_session: AsyncSession
    ):
        """Actualizar una reclamacion con ID inexistente retorna None."""
        svc = InsuranceClaimService(db_session)
        update_data = InsuranceClaimStatusUpdate(status="paid")

        resultado = await svc.update_claim_status(uuid.uuid4(), update_data)

        assert resultado is None, "Reclamacion inexistente debe retornar None"

    @pytest.mark.asyncio
    async def test_listar_reclamaciones_con_filtros(
        self, db_session: AsyncSession
    ):
        """Lista reclamaciones filtradas por paciente y estado."""
        patient_id = uuid.uuid4()

        svc = InsuranceClaimService(db_session)
        for i in range(3):
            data = InsuranceClaimCreate(
                patient_id=patient_id,
                encounter_id=uuid.uuid4(),
                insurer_name=f"Aseguradora {i}",
                policy_number=f"POL-{i:03d}",
                total_claimed=5000.00 * (i + 1),
            )
            await svc.create_claim(data)

        claims, total = await svc.list_claims(patient_id=patient_id)

        assert total == 3, "Debe encontrar 3 reclamaciones del paciente"
        assert len(claims) == 3, "La lista debe contener 3 reclamaciones"


# =============================================
# Tests de AccountingService
# =============================================


class TestAccountingService:
    """Tests del servicio de contabilidad general (libro mayor)."""

    @pytest.mark.asyncio
    async def test_seed_plan_contable_crea_cuentas(
        self, db_session: AsyncSession
    ):
        """Verifica que el seed crea todas las cuentas predefinidas."""
        svc = AccountingService(db_session)
        count = await svc.seed_chart_of_accounts()

        assert count == len(DEFAULT_ACCOUNTS), (
            f"Debe crear {len(DEFAULT_ACCOUNTS)} cuentas, creo {count}"
        )

        # Verificar que se pueden consultar
        cuentas = await svc.list_accounts()
        assert len(cuentas) == len(DEFAULT_ACCOUNTS), "Todas las cuentas deben ser listables"

    @pytest.mark.asyncio
    async def test_seed_plan_contable_no_duplica(
        self, db_session: AsyncSession
    ):
        """Si ya existen cuentas, el seed no las duplica."""
        svc = AccountingService(db_session)
        primera_vez = await svc.seed_chart_of_accounts()
        segunda_vez = await svc.seed_chart_of_accounts()

        assert primera_vez > 0, "La primera ejecucion debe crear cuentas"
        assert segunda_vez == 0, "La segunda ejecucion no debe crear cuentas"

    @pytest.mark.asyncio
    async def test_crear_asiento_contable_balanceado(
        self, db_session: AsyncSession
    ):
        """Un asiento con debitos == creditos se crea exitosamente."""
        await _seed_plan_contable(db_session)

        svc = AccountingService(db_session)
        cxc = await svc.get_account_by_type("cuentas_por_cobrar")
        ingreso = await svc.get_account_by_type("ingreso_servicios")

        assert cxc is not None, "Debe existir la cuenta de CxC"
        assert ingreso is not None, "Debe existir la cuenta de ingresos"

        entry = await svc.create_journal_entry(
            description="Asiento de prueba balanceado",
            lines=[
                {"account_id": cxc.id, "debit": 5000.00, "credit": 0, "description": "Debito CxC"},
                {"account_id": ingreso.id, "debit": 0, "credit": 5000.00, "description": "Credito ingreso"},
            ],
            entry_date=date.today(),
            posted_by=uuid.uuid4(),
        )

        assert entry.entry_number.startswith("AST-"), "Numero de asiento debe tener prefijo AST-"
        assert float(entry.total_debit) == 5000.00, "Total debito debe ser 5000"
        assert float(entry.total_credit) == 5000.00, "Total credito debe ser 5000"
        assert entry.status == "posted", "El asiento debe quedar publicado"

    @pytest.mark.asyncio
    async def test_crear_asiento_desbalanceado_lanza_error(
        self, db_session: AsyncSession
    ):
        """Un asiento con debitos != creditos lanza ValueError."""
        await _seed_plan_contable(db_session)

        svc = AccountingService(db_session)
        cxc = await svc.get_account_by_type("cuentas_por_cobrar")
        ingreso = await svc.get_account_by_type("ingreso_servicios")

        with pytest.raises(ValueError, match="desbalanceado"):
            await svc.create_journal_entry(
                description="Asiento desbalanceado intencional",
                lines=[
                    {"account_id": cxc.id, "debit": 5000.00, "credit": 0},
                    {"account_id": ingreso.id, "debit": 0, "credit": 3000.00},
                ],
            )

    @pytest.mark.asyncio
    async def test_reversar_asiento_contable(
        self, db_session: AsyncSession
    ):
        """Al reversar un asiento, se crea uno inverso y el original se marca reversed."""
        await _seed_plan_contable(db_session)

        svc = AccountingService(db_session)
        cxc = await svc.get_account_by_type("cuentas_por_cobrar")
        ingreso = await svc.get_account_by_type("ingreso_servicios")

        original = await svc.create_journal_entry(
            description="Asiento original a reversar",
            lines=[
                {"account_id": cxc.id, "debit": 3000.00, "credit": 0, "description": "Debito CxC"},
                {"account_id": ingreso.id, "debit": 0, "credit": 3000.00, "description": "Credito ingreso"},
            ],
            posted_by=uuid.uuid4(),
        )

        reversa = await svc.reverse_journal_entry(
            original.id, "Correccion de error", posted_by=uuid.uuid4()
        )

        assert reversa.reversal_of == original.id, "La reversa debe referenciar al original"
        assert float(reversa.total_debit) == 3000.00, "Debitos de la reversa deben coincidir"
        assert float(reversa.total_credit) == 3000.00, "Creditos de la reversa deben coincidir"

        # Verificar que el original se marco como reversado
        original_actualizado = await svc.get_journal_entry(original.id)
        assert original_actualizado.status == "reversed", "El original debe estar reversado"
        assert original_actualizado.reversed_by == reversa.id, (
            "Debe referenciar al asiento de reversa"
        )

    @pytest.mark.asyncio
    async def test_reversar_asiento_ya_reversado_lanza_error(
        self, db_session: AsyncSession
    ):
        """No se puede reversar un asiento que ya fue reversado."""
        await _seed_plan_contable(db_session)

        svc = AccountingService(db_session)
        cxc = await svc.get_account_by_type("cuentas_por_cobrar")
        ingreso = await svc.get_account_by_type("ingreso_servicios")

        original = await svc.create_journal_entry(
            description="Asiento a reversar dos veces",
            lines=[
                {"account_id": cxc.id, "debit": 1000.00, "credit": 0},
                {"account_id": ingreso.id, "debit": 0, "credit": 1000.00},
            ],
        )

        await svc.reverse_journal_entry(original.id, "Primera reversa")

        with pytest.raises(ValueError, match="ya fue reversado"):
            await svc.reverse_journal_entry(original.id, "Segunda reversa")

    @pytest.mark.asyncio
    async def test_balance_comprobacion_cuadra(
        self, db_session: AsyncSession
    ):
        """El balance de comprobacion debe tener debitos == creditos."""
        await _seed_plan_contable(db_session)

        svc = AccountingService(db_session)
        cxc = await svc.get_account_by_type("cuentas_por_cobrar")
        ingreso = await svc.get_account_by_type("ingreso_servicios")
        itbis = await svc.get_account_by_type("impuesto_por_pagar")

        # Crear un asiento de ejemplo
        await svc.create_journal_entry(
            description="Factura prueba balance",
            lines=[
                {"account_id": cxc.id, "debit": 11800.00, "credit": 0},
                {"account_id": ingreso.id, "debit": 0, "credit": 10000.00},
                {"account_id": itbis.id, "debit": 0, "credit": 1800.00},
            ],
        )

        balance = await svc.get_trial_balance(as_of_date=date.today())

        assert balance["total_debits"] == balance["total_credits"], (
            "El balance de comprobacion debe cuadrar (debitos == creditos)"
        )
        assert balance["total_debits"] == 11800.00, "Los debitos totales deben ser 11800"
        assert len(balance["lines"]) > 0, "Debe contener lineas con movimiento"


# =============================================
# Tests de InvoiceVoidService
# =============================================


class TestInvoiceVoidService:
    """Tests del servicio de anulacion de facturas."""

    @pytest.mark.asyncio
    async def test_anular_factura_emitida(
        self, db_session: AsyncSession
    ):
        """Una factura en estado 'issued' se puede anular correctamente."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-VOID-001",
            status="issued",
            country_code="US",
        )

        svc = InvoiceVoidService(db_session)
        anulada = await svc.void_invoice(
            factura.id, reason="Error en datos del cliente", voided_by=uuid.uuid4()
        )

        assert anulada.status == "cancelled", "La factura debe quedar cancelada"

    @pytest.mark.asyncio
    async def test_anular_factura_draft(
        self, db_session: AsyncSession
    ):
        """Una factura en estado 'draft' tambien puede anularse."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-VOID-002",
            status="draft",
        )

        svc = InvoiceVoidService(db_session)
        anulada = await svc.void_invoice(factura.id, reason="Factura creada por error")

        assert anulada.status == "cancelled", "La factura draft debe quedar cancelada"

    @pytest.mark.asyncio
    async def test_anular_factura_pagada_lanza_error(
        self, db_session: AsyncSession
    ):
        """No se puede anular una factura que ya fue pagada."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-VOID-003",
            status="paid",
        )

        svc = InvoiceVoidService(db_session)

        with pytest.raises(ValueError, match="No se puede anular"):
            await svc.void_invoice(factura.id, reason="Intento invalido")

    @pytest.mark.asyncio
    async def test_anular_factura_inexistente_lanza_error(
        self, db_session: AsyncSession
    ):
        """Intentar anular una factura con ID inexistente lanza error."""
        svc = InvoiceVoidService(db_session)

        with pytest.raises(ValueError, match="no encontrada"):
            await svc.void_invoice(uuid.uuid4(), reason="Factura fantasma")

    @pytest.mark.asyncio
    async def test_anular_factura_libera_cargos(
        self, db_session: AsyncSession
    ):
        """Al anular una factura, los cargos vinculados vuelven a estado pending."""
        servicio = await _crear_servicio_catalogo(db_session, code="SRV-VOID-01")
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-VOID-004",
            status="issued",
        )

        # Crear un cargo facturado y vincularlo con una linea de factura
        cargo = await _crear_cargo(
            db_session,
            service_id=servicio.id,
            status="invoiced",
        )
        linea = InvoiceLine(
            invoice_id=factura.id,
            charge_item_id=cargo.id,
            description="Cargo vinculado",
            quantity=1,
            unit_price=1500.00,
            discount=0.0,
            tax=270.00,
            line_total=1770.00,
        )
        db_session.add(linea)
        await db_session.flush()

        svc = InvoiceVoidService(db_session)
        await svc.void_invoice(factura.id, reason="Anulacion para liberar cargos")

        await db_session.refresh(cargo)
        assert cargo.status == "pending", (
            "Los cargos vinculados deben volver a estado pendiente al anular la factura"
        )


# =============================================
# Tests de PaymentReversalService
# =============================================


class TestPaymentReversalService:
    """Tests del servicio de reversion de pagos."""

    @pytest.mark.asyncio
    async def test_reversar_pago_desactiva_y_recalcula(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Reversar un pago lo desactiva y recalcula el estado de la factura."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-REV-001",
            grand_total=1000.00,
            subtotal=1000.00,
            tax_total=0.0,
            status="paid",
        )

        # Crear pago activo
        pago = Payment(
            invoice_id=factura.id,
            amount=1000.00,
            payment_method="cash",
            reference_number="REF-REV-001",
            is_active=True,
        )
        db_session.add(pago)
        await db_session.flush()

        svc = PaymentReversalService(db_session)
        resultado = await svc.reverse_payment(
            pago.id, reason="Devolucion solicitada por paciente", reversed_by=uuid.uuid4()
        )

        assert resultado["reversal_amount"] == 1000.00, "El monto reversado debe coincidir"
        assert resultado["new_invoice_status"] == "issued", (
            "Sin pagos activos, la factura debe volver a emitida"
        )
        assert "reversado exitosamente" in resultado["mensaje"], (
            "El mensaje debe confirmar la reversion"
        )

        # Verificar que el pago se desactivo
        await db_session.refresh(pago)
        assert pago.is_active is False, "El pago debe estar desactivado"
        assert "REVERSADO" in (pago.notes or ""), "Las notas deben indicar la reversion"

    @pytest.mark.asyncio
    async def test_reversar_pago_inexistente_lanza_error(
        self, db_session: AsyncSession
    ):
        """Intentar reversar un pago inexistente lanza ValueError."""
        svc = PaymentReversalService(db_session)

        with pytest.raises(ValueError, match="no encontrado"):
            await svc.reverse_payment(uuid.uuid4(), reason="Pago fantasma")

    @pytest.mark.asyncio
    async def test_reversar_pago_parcial_cambia_estado_factura(
        self, db_session: AsyncSession, mock_billing_publish
    ):
        """Si hay multiples pagos y se reversa uno, la factura
        pasa a partial o issued segun el saldo restante."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-REV-002",
            grand_total=2000.00,
            subtotal=2000.00,
            tax_total=0.0,
            status="paid",
        )

        # Crear dos pagos
        pago1 = Payment(
            invoice_id=factura.id,
            amount=1200.00,
            payment_method="cash",
            is_active=True,
        )
        pago2 = Payment(
            invoice_id=factura.id,
            amount=800.00,
            payment_method="card",
            is_active=True,
        )
        db_session.add(pago1)
        db_session.add(pago2)
        await db_session.flush()

        # Reversar solo el segundo pago
        svc = PaymentReversalService(db_session)
        resultado = await svc.reverse_payment(
            pago2.id, reason="Error en cobro de tarjeta"
        )

        assert resultado["new_invoice_status"] == "partial", (
            "Con un pago activo que no cubre el total, el estado debe ser parcial"
        )


# =============================================
# Tests de CreditNoteService
# =============================================


class TestCreditNoteService:
    """Tests del servicio de notas de credito."""

    @pytest.mark.asyncio
    async def test_crear_nota_credito_parcial(
        self, db_session: AsyncSession
    ):
        """Crea una nota de credito parcial con lineas especificas."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-NC-001",
            subtotal=5000.00,
            tax_total=900.00,
            grand_total=5900.00,
            status="issued",
            country_code="US",
        )

        svc = CreditNoteService(db_session)
        nc = await svc.create_credit_note(
            original_invoice_id=factura.id,
            reason="Devolucion parcial de servicio",
            lines=[
                {
                    "description": "Ajuste consulta",
                    "quantity": 1,
                    "unit_price": 2000.00,
                    "tax": 360.00,
                },
            ],
            full_reversal=False,
            created_by=uuid.uuid4(),
        )

        assert nc.credit_note_number.startswith("NC-"), "El numero debe tener prefijo NC-"
        assert float(nc.subtotal) == 2000.00, "Subtotal de la NC debe coincidir"
        assert float(nc.tax_total) == 360.00, "Impuesto de la NC debe coincidir"
        assert float(nc.grand_total) == 2360.00, "Grand total = subtotal + tax"
        assert nc.reason == "Devolucion parcial de servicio", "La razon debe almacenarse"

    @pytest.mark.asyncio
    async def test_crear_nota_credito_reversa_completa(
        self, db_session: AsyncSession
    ):
        """Una nota de credito con full_reversal copia las lineas de la factura
        y marca la factura como credit_note."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-NC-002",
            subtotal=3000.00,
            tax_total=540.00,
            grand_total=3540.00,
            status="issued",
            country_code="US",
        )

        # Agregar lineas a la factura original
        linea1 = InvoiceLine(
            invoice_id=factura.id,
            description="Servicio A",
            quantity=1,
            unit_price=2000.00,
            discount=0.0,
            tax=360.00,
            line_total=2360.00,
        )
        linea2 = InvoiceLine(
            invoice_id=factura.id,
            description="Servicio B",
            quantity=1,
            unit_price=1000.00,
            discount=0.0,
            tax=180.00,
            line_total=1180.00,
        )
        db_session.add(linea1)
        db_session.add(linea2)
        await db_session.flush()

        svc = CreditNoteService(db_session)
        nc = await svc.create_credit_note(
            original_invoice_id=factura.id,
            reason="Cancelacion total del servicio",
            full_reversal=True,
            created_by=uuid.uuid4(),
        )

        assert float(nc.subtotal) == 3000.00, (
            "La NC por reversa completa debe tener el mismo subtotal que la factura"
        )
        assert float(nc.grand_total) == 3540.00, (
            "La NC debe tener el mismo grand_total que la factura"
        )

        # La factura original debe cambiar de estado
        await db_session.refresh(factura)
        assert factura.status == "credit_note", (
            "Una reversa completa debe marcar la factura como credit_note"
        )

    @pytest.mark.asyncio
    async def test_crear_nota_credito_factura_inexistente_lanza_error(
        self, db_session: AsyncSession
    ):
        """Crear una NC para una factura inexistente lanza ValueError."""
        svc = CreditNoteService(db_session)

        with pytest.raises(ValueError, match="no encontrada"):
            await svc.create_credit_note(
                original_invoice_id=uuid.uuid4(),
                reason="Factura fantasma",
            )

    @pytest.mark.asyncio
    async def test_crear_nota_credito_factura_cancelada_lanza_error(
        self, db_session: AsyncSession
    ):
        """No se puede crear una NC para una factura ya anulada."""
        factura = await _crear_factura(
            db_session,
            invoice_number="FAC-NC-003",
            status="cancelled",
            country_code="US",
        )

        svc = CreditNoteService(db_session)

        with pytest.raises(ValueError, match="anulada"):
            await svc.create_credit_note(
                original_invoice_id=factura.id,
                reason="Intento invalido sobre factura cancelada",
            )
