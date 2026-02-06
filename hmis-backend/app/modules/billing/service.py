"""
Servicio de Facturacion y Seguros.
Logica de negocio: cargos, facturas, pagos, reclamaciones y motor fiscal.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.billing.models import (
    ChargeItem,
    FiscalConfig,
    InsuranceClaim,
    Invoice,
    InvoiceLine,
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
from app.shared.events import (
    CHARGE_CREATED,
    CLAIM_SUBMITTED,
    INVOICE_GENERATED,
    PAYMENT_RECEIVED,
    DomainEvent,
    publish,
)


class ServiceCatalogService:
    """Servicio del catalogo de servicios medicos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_service(self, **kwargs) -> ServiceCatalog:
        service = ServiceCatalog(**kwargs)
        self.db.add(service)
        await self.db.flush()
        return service

    async def get_service(self, service_id: uuid.UUID) -> ServiceCatalog | None:
        stmt = select(ServiceCatalog).where(
            ServiceCatalog.id == service_id, ServiceCatalog.is_active == True
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def search_services(
        self, query: str | None = None, category: str | None = None,
        offset: int = 0, limit: int = 20
    ) -> tuple[list[ServiceCatalog], int]:
        stmt = select(ServiceCatalog).where(ServiceCatalog.is_active == True)
        count_stmt = select(func.count()).select_from(ServiceCatalog).where(ServiceCatalog.is_active == True)

        if query:
            filter_q = ServiceCatalog.name.ilike(f"%{query}%")
            stmt = stmt.where(filter_q)
            count_stmt = count_stmt.where(filter_q)
        if category:
            stmt = stmt.where(ServiceCatalog.category == category)
            count_stmt = count_stmt.where(ServiceCatalog.category == category)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(ServiceCatalog.name)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total


class ChargeService:
    """Servicio de gestion de cargos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_charge(
        self, data: ChargeItemCreate, charged_by: uuid.UUID | None = None
    ) -> ChargeItem:
        """
        Crea un cargo calculando impuestos y responsabilidad del paciente.
        """
        # Obtener servicio para calcular impuestos
        stmt = select(ServiceCatalog).where(ServiceCatalog.id == data.service_id)
        result = await self.db.execute(stmt)
        service = result.scalar_one_or_none()

        subtotal = data.quantity * data.unit_price - data.discount
        tax = subtotal * (service.tax_rate if service else 0)
        total = subtotal + tax
        patient_responsibility = total - data.covered_by_insurance

        charge = ChargeItem(
            encounter_id=data.encounter_id,
            patient_id=data.patient_id,
            service_id=data.service_id,
            description=data.description,
            quantity=data.quantity,
            unit_price=data.unit_price,
            discount=data.discount,
            tax=round(tax, 2),
            total=round(total, 2),
            covered_by_insurance=data.covered_by_insurance,
            patient_responsibility=round(max(patient_responsibility, 0), 2),
            charged_by=charged_by,
            created_by=charged_by,
        )
        self.db.add(charge)
        await self.db.flush()

        await publish(DomainEvent(
            event_type=CHARGE_CREATED,
            aggregate_type="charge_item",
            aggregate_id=str(charge.id),
            data={
                "patient_id": str(data.patient_id),
                "total": float(charge.total),
            },
            user_id=str(charged_by) if charged_by else None,
        ))

        return charge

    async def get_patient_charges(
        self, patient_id: uuid.UUID, status: str | None = None
    ) -> list[ChargeItem]:
        stmt = (
            select(ChargeItem)
            .where(ChargeItem.patient_id == patient_id, ChargeItem.is_active == True)
        )
        if status:
            stmt = stmt.where(ChargeItem.status == status)
        stmt = stmt.order_by(ChargeItem.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class InvoiceService:
    """Servicio de facturacion."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_invoice(
        self, data: InvoiceCreate, created_by: uuid.UUID | None = None,
        tenant_id: str | None = None,
    ) -> Invoice:
        """
        Genera una factura a partir de cargos pendientes.
        Incluye calculo de totales y generacion de numero secuencial.
        """
        # Obtener cargos pendientes
        charges = []
        if data.charge_item_ids:
            stmt = select(ChargeItem).where(
                ChargeItem.id.in_(data.charge_item_ids),
                ChargeItem.status == "pending",
            )
            result = await self.db.execute(stmt)
            charges = list(result.scalars().all())

        # Generar numero de factura
        invoice_number = await self._generate_invoice_number(tenant_id)

        # Calcular totales
        subtotal = sum(c.unit_price * c.quantity - c.discount for c in charges)
        tax_total = sum(c.tax for c in charges)
        discount_total = sum(c.discount for c in charges)
        grand_total = subtotal + tax_total

        # Intentar obtener numero fiscal
        fiscal_number = None
        if data.country_code:
            fiscal_number = await self._get_fiscal_number(tenant_id, data.country_code)

        invoice = Invoice(
            patient_id=data.patient_id,
            encounter_id=data.encounter_id,
            invoice_number=invoice_number,
            fiscal_number=fiscal_number,
            subtotal=round(subtotal, 2),
            tax_total=round(tax_total, 2),
            discount_total=round(discount_total, 2),
            grand_total=round(grand_total, 2),
            currency=data.currency,
            country_code=data.country_code,
            fiscal_type=data.fiscal_type,
            customer_name=data.customer_name,
            customer_tax_id=data.customer_tax_id,
            customer_address=data.customer_address,
            due_date=data.due_date,
            status="issued",
            created_by=created_by,
        )
        self.db.add(invoice)
        await self.db.flush()

        # Crear lineas de factura
        for charge in charges:
            line = InvoiceLine(
                invoice_id=invoice.id,
                charge_item_id=charge.id,
                description=charge.description,
                quantity=charge.quantity,
                unit_price=float(charge.unit_price),
                discount=float(charge.discount),
                tax=float(charge.tax),
                line_total=float(charge.total),
            )
            self.db.add(line)
            charge.status = "invoiced"

        await self.db.flush()

        await publish(DomainEvent(
            event_type=INVOICE_GENERATED,
            aggregate_type="invoice",
            aggregate_id=str(invoice.id),
            data={
                "patient_id": str(data.patient_id),
                "grand_total": float(invoice.grand_total),
                "invoice_number": invoice_number,
            },
            user_id=str(created_by) if created_by else None,
        ))

        return invoice

    async def get_invoice(self, invoice_id: uuid.UUID) -> Invoice | None:
        stmt = (
            select(Invoice)
            .where(Invoice.id == invoice_id, Invoice.is_active == True)
            .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_invoices(
        self, patient_id: uuid.UUID | None = None, status: str | None = None,
        offset: int = 0, limit: int = 20,
    ) -> tuple[list[Invoice], int]:
        stmt = select(Invoice).where(Invoice.is_active == True)
        count_stmt = select(func.count()).select_from(Invoice).where(Invoice.is_active == True)

        if patient_id:
            stmt = stmt.where(Invoice.patient_id == patient_id)
            count_stmt = count_stmt.where(Invoice.patient_id == patient_id)
        if status:
            stmt = stmt.where(Invoice.status == status)
            count_stmt = count_stmt.where(Invoice.status == status)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(Invoice.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def _generate_invoice_number(self, tenant_id: str | None) -> str:
        """Genera numero de factura secuencial."""
        prefix = "FAC"
        stmt = select(func.count()).select_from(Invoice)
        result = await self.db.execute(stmt)
        count = (result.scalar() or 0) + 1
        return f"{prefix}-{count:08d}"

    async def _get_fiscal_number(self, tenant_id: str | None, country_code: str) -> str | None:
        """Obtiene siguiente numero fiscal segun configuracion del pais."""
        if not tenant_id:
            return None

        stmt = select(FiscalConfig).where(
            FiscalConfig.tenant_id == tenant_id,
            FiscalConfig.country_code == country_code,
        )
        result = await self.db.execute(stmt)
        config = result.scalar_one_or_none()

        if not config:
            return None

        config.current_sequence += 1
        prefix = config.sequence_prefix or ""
        return f"{prefix}{config.current_sequence:08d}"


class PaymentService:
    """Servicio de pagos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_payment(
        self, data: PaymentCreate, received_by: uuid.UUID | None = None
    ) -> Payment:
        """Registra un pago y actualiza el estado de la factura."""
        payment = Payment(
            invoice_id=data.invoice_id,
            amount=data.amount,
            payment_method=data.payment_method,
            reference_number=data.reference_number,
            received_by=received_by,
            notes=data.notes,
            created_by=received_by,
        )
        self.db.add(payment)
        await self.db.flush()

        # Actualizar estado de factura
        stmt = (
            select(Invoice)
            .where(Invoice.id == data.invoice_id)
            .options(selectinload(Invoice.payments))
        )
        result = await self.db.execute(stmt)
        invoice = result.scalar_one_or_none()

        if invoice:
            total_paid = sum(float(p.amount) for p in invoice.payments)
            if total_paid >= float(invoice.grand_total):
                invoice.status = "paid"
                invoice.paid_date = datetime.now(timezone.utc).date()
            elif total_paid > 0:
                invoice.status = "partial"

        await self.db.flush()

        await publish(DomainEvent(
            event_type=PAYMENT_RECEIVED,
            aggregate_type="payment",
            aggregate_id=str(payment.id),
            data={
                "invoice_id": str(data.invoice_id),
                "amount": float(data.amount),
                "method": data.payment_method,
            },
            user_id=str(received_by) if received_by else None,
        ))

        return payment


class InsuranceClaimService:
    """Servicio de reclamaciones a aseguradoras."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_claim(
        self, data: InsuranceClaimCreate, created_by: uuid.UUID | None = None
    ) -> InsuranceClaim:
        """Crea una reclamacion a aseguradora."""
        claim_number = await self._generate_claim_number()

        claim = InsuranceClaim(
            patient_id=data.patient_id,
            encounter_id=data.encounter_id,
            insurer_name=data.insurer_name,
            insurer_code=data.insurer_code,
            policy_number=data.policy_number,
            claim_number=claim_number,
            total_claimed=data.total_claimed,
            claim_details=data.claim_details,
            notes=data.notes,
            created_by=created_by,
        )
        self.db.add(claim)
        await self.db.flush()
        return claim

    async def submit_claim(self, claim_id: uuid.UUID) -> InsuranceClaim | None:
        """Envia una reclamacion a la aseguradora."""
        stmt = select(InsuranceClaim).where(InsuranceClaim.id == claim_id)
        result = await self.db.execute(stmt)
        claim = result.scalar_one_or_none()

        if not claim or claim.status != "draft":
            return None

        claim.status = "submitted"
        claim.submitted_at = datetime.now(timezone.utc)
        await self.db.flush()

        await publish(DomainEvent(
            event_type=CLAIM_SUBMITTED,
            aggregate_type="insurance_claim",
            aggregate_id=str(claim.id),
            data={
                "insurer": claim.insurer_name,
                "total_claimed": float(claim.total_claimed),
            },
        ))

        return claim

    async def update_claim_status(
        self, claim_id: uuid.UUID, data: InsuranceClaimStatusUpdate,
        updated_by: uuid.UUID | None = None,
    ) -> InsuranceClaim | None:
        stmt = select(InsuranceClaim).where(InsuranceClaim.id == claim_id)
        result = await self.db.execute(stmt)
        claim = result.scalar_one_or_none()

        if not claim:
            return None

        claim.status = data.status
        claim.updated_by = updated_by
        if data.total_approved is not None:
            claim.total_approved = data.total_approved
        if data.total_denied is not None:
            claim.total_denied = data.total_denied
        if data.denial_reason:
            claim.denial_reason = data.denial_reason
        if data.status in ("paid", "denied", "partial"):
            claim.adjudicated_at = datetime.now(timezone.utc)

        await self.db.flush()
        return claim

    async def list_claims(
        self, patient_id: uuid.UUID | None = None, status: str | None = None,
        offset: int = 0, limit: int = 20,
    ) -> tuple[list[InsuranceClaim], int]:
        stmt = select(InsuranceClaim).where(InsuranceClaim.is_active == True)
        count_stmt = select(func.count()).select_from(InsuranceClaim).where(InsuranceClaim.is_active == True)

        if patient_id:
            stmt = stmt.where(InsuranceClaim.patient_id == patient_id)
            count_stmt = count_stmt.where(InsuranceClaim.patient_id == patient_id)
        if status:
            stmt = stmt.where(InsuranceClaim.status == status)
            count_stmt = count_stmt.where(InsuranceClaim.status == status)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(InsuranceClaim.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def _generate_claim_number(self) -> str:
        stmt = select(func.count()).select_from(InsuranceClaim)
        result = await self.db.execute(stmt)
        count = (result.scalar() or 0) + 1
        return f"CLM-{count:08d}"
