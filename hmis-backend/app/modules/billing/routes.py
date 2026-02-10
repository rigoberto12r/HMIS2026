"""
Rutas API del modulo de Facturacion, Contabilidad y Cumplimiento Fiscal.
Catalogo, cargos, facturas, pagos, notas de credito, contabilidad general,
reclamaciones, reportes fiscales y financieros.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, current_tenant
from app.modules.auth.dependencies import get_current_active_user, require_permissions
from app.modules.auth.models import User
from app.modules.billing.schemas import (
    AccountCreate,
    AccountResponse,
    ARAgingReport,
    ChargeItemCreate,
    ChargeItemResponse,
    CreditNoteCreate,
    CreditNoteResponse,
    FiscalConfigCreate,
    FiscalConfigResponse,
    InsuranceClaimCreate,
    InsuranceClaimResponse,
    InsuranceClaimStatusUpdate,
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceVoidRequest,
    JournalEntryResponse,
    PaymentCreate,
    PaymentResponse,
    PaymentReversalRequest,
    PaymentReversalResponse,
    RNCValidationRequest,
    RNCValidationResponse,
    ServiceCatalogCreate,
    ServiceCatalogResponse,
    TrialBalance,
)
from app.modules.billing.service import (
    ChargeService,
    InsuranceClaimService,
    InvoiceService,
    InvoiceVoidService,
    PaymentReversalService,
    PaymentService,
    ServiceCatalogService,
)
from app.modules.billing.accounting_service import (
    AccountingService,
    CreditNoteService,
)
from app.shared.schemas import MessageResponse, PaginatedResponse, PaginationParams

router = APIRouter()


# =============================================
# Catalogo de Servicios
# =============================================

@router.post("/services", response_model=ServiceCatalogResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCatalogCreate,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear un servicio en el catalogo."""
    service = ServiceCatalogService(db)
    item = await service.create_service(**data.model_dump())
    return ServiceCatalogResponse.model_validate(item)


@router.get("/services", response_model=PaginatedResponse[ServiceCatalogResponse])
async def list_services(
    query: str | None = None,
    category: str | None = None,
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Buscar servicios en el catalogo."""
    if pagination is None:
        pagination = PaginationParams()
    service = ServiceCatalogService(db)
    items, total = await service.search_services(
        query=query, category=category,
        offset=pagination.offset, limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[ServiceCatalogResponse.model_validate(i) for i in items],
        total=total, page=pagination.page, page_size=pagination.page_size,
    )


# =============================================
# Cargos
# =============================================

@router.post("/charges", response_model=ChargeItemResponse, status_code=status.HTTP_201_CREATED)
async def create_charge(
    data: ChargeItemCreate,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear un cargo por servicio medico."""
    service = ChargeService(db)
    charge = await service.create_charge(data, charged_by=current_user.id)
    return ChargeItemResponse.model_validate(charge)


@router.get("/charges/patient/{patient_id}", response_model=list[ChargeItemResponse])
async def get_patient_charges(
    patient_id: uuid.UUID,
    charge_status: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener cargos de un paciente."""
    service = ChargeService(db)
    charges = await service.get_patient_charges(patient_id, status=charge_status)
    return [ChargeItemResponse.model_validate(c) for c in charges]


# =============================================
# Facturas
# =============================================

@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Generar una factura fiscal a partir de cargos pendientes."""
    service = InvoiceService(db)
    invoice = await service.create_invoice(
        data, created_by=current_user.id, tenant_id=current_tenant.get()
    )
    invoice = await service.get_invoice(invoice.id)
    return InvoiceResponse.model_validate(invoice)


@router.get("/invoices", response_model=PaginatedResponse[InvoiceListResponse])
async def list_invoices(
    patient_id: uuid.UUID | None = None,
    invoice_status: str | None = Query(default=None, alias="status"),
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar facturas con filtros."""
    if pagination is None:
        pagination = PaginationParams()
    service = InvoiceService(db)
    invoices, total = await service.list_invoices(
        patient_id=patient_id, status=invoice_status,
        offset=pagination.offset, limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[InvoiceListResponse.model_validate(i) for i in invoices],
        total=total, page=pagination.page, page_size=pagination.page_size,
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener factura completa con lineas y pagos."""
    service = InvoiceService(db)
    invoice = await service.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return InvoiceResponse.model_validate(invoice)


@router.post("/invoices/{invoice_id}/void")
async def void_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceVoidRequest,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Anular una factura. Solo facturas sin pagos pueden anularse."""
    service = InvoiceVoidService(db)
    try:
        invoice = await service.void_invoice(
            invoice_id, data.reason,
            voided_by=current_user.id, tenant_id=current_tenant.get(),
        )
        return {
            "mensaje": f"Factura {invoice.invoice_number} anulada exitosamente",
            "invoice_id": str(invoice.id),
            "status": invoice.status,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Descargar PDF de una factura."""
    service = InvoiceService(db)
    invoice = await service.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    try:
        from app.integrations.pdf.invoice_generator import InvoicePDFGenerator

        generator = InvoicePDFGenerator({
            "hospital_name": "HMIS Hospital",
            "hospital_rnc": "",
            "hospital_address": "",
            "hospital_phone": "",
        })

        invoice_data = {
            "invoice_number": invoice.invoice_number,
            "fiscal_number": invoice.fiscal_number,
            "date": invoice.created_at.strftime("%d/%m/%Y") if invoice.created_at else "",
            "due_date": invoice.due_date.strftime("%d/%m/%Y") if invoice.due_date else "",
            "customer_name": invoice.customer_name or "N/A",
            "customer_tax_id": invoice.customer_tax_id or "",
            "customer_address": invoice.customer_address or "",
            "lines": [
                {
                    "description": line.description,
                    "quantity": line.quantity,
                    "unit_price": float(line.unit_price),
                    "discount": float(line.discount),
                    "tax": float(line.tax),
                    "line_total": float(line.line_total),
                }
                for line in invoice.lines
            ],
            "subtotal": float(invoice.subtotal),
            "discount_total": float(invoice.discount_total),
            "tax_total": float(invoice.tax_total),
            "grand_total": float(invoice.grand_total),
            "currency": invoice.currency,
            "fiscal_type": invoice.fiscal_type,
            "country_code": invoice.country_code,
            "payments": [],
        }

        pdf_bytes = await generator.generate_invoice_pdf(invoice_data)

        import io
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=factura_{invoice.invoice_number}.pdf"
            },
        )
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Generador de PDF no disponible. Instale reportlab.",
        )


# =============================================
# Pagos
# =============================================

@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    data: PaymentCreate,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Registrar un pago contra una factura."""
    service = PaymentService(db)
    payment = await service.record_payment(data, received_by=current_user.id)
    return PaymentResponse.model_validate(payment)


@router.post("/payments/{payment_id}/reverse")
async def reverse_payment(
    payment_id: uuid.UUID,
    data: PaymentReversalRequest,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Reversar un pago. Recalcula el estado de la factura."""
    service = PaymentReversalService(db)
    try:
        result = await service.reverse_payment(
            payment_id, data.reason, reversed_by=current_user.id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# Notas de Credito
# =============================================

@router.post("/credit-notes", response_model=CreditNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_credit_note(
    data: CreditNoteCreate,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear nota de credito contra una factura."""
    service = CreditNoteService(db)
    try:
        cn = await service.create_credit_note(
            original_invoice_id=data.original_invoice_id,
            reason=data.reason,
            lines=[line.model_dump() for line in data.lines] if data.lines else None,
            full_reversal=data.full_reversal,
            created_by=current_user.id,
            tenant_id=current_tenant.get(),
        )
        cn = await service.get_credit_note(cn.id)
        return CreditNoteResponse.model_validate(cn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/credit-notes", response_model=PaginatedResponse[CreditNoteResponse])
async def list_credit_notes(
    patient_id: uuid.UUID | None = None,
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar notas de credito."""
    if pagination is None:
        pagination = PaginationParams()
    service = CreditNoteService(db)
    notes, total = await service.list_credit_notes(
        patient_id=patient_id,
        offset=pagination.offset, limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[CreditNoteResponse.model_validate(cn) for cn in notes],
        total=total, page=pagination.page, page_size=pagination.page_size,
    )


@router.get("/credit-notes/{cn_id}", response_model=CreditNoteResponse)
async def get_credit_note(
    cn_id: uuid.UUID,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener nota de credito con detalle."""
    service = CreditNoteService(db)
    cn = await service.get_credit_note(cn_id)
    if not cn:
        raise HTTPException(status_code=404, detail="Nota de credito no encontrada")
    return CreditNoteResponse.model_validate(cn)


# =============================================
# Reclamaciones de Seguros
# =============================================

@router.post("/claims", response_model=InsuranceClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    data: InsuranceClaimCreate,
    current_user: User = Depends(require_permissions("claims:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear una reclamacion a aseguradora."""
    service = InsuranceClaimService(db)
    claim = await service.create_claim(data, created_by=current_user.id)
    return InsuranceClaimResponse.model_validate(claim)


@router.post("/claims/{claim_id}/submit", response_model=InsuranceClaimResponse)
async def submit_claim(
    claim_id: uuid.UUID,
    current_user: User = Depends(require_permissions("claims:write")),
    db: AsyncSession = Depends(get_db),
):
    """Enviar reclamacion a la aseguradora."""
    service = InsuranceClaimService(db)
    claim = await service.submit_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Reclamacion no encontrada o ya enviada")
    return InsuranceClaimResponse.model_validate(claim)


@router.patch("/claims/{claim_id}/status", response_model=InsuranceClaimResponse)
async def update_claim_status(
    claim_id: uuid.UUID,
    data: InsuranceClaimStatusUpdate,
    current_user: User = Depends(require_permissions("claims:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar estado de reclamacion (adjudicacion)."""
    service = InsuranceClaimService(db)
    claim = await service.update_claim_status(claim_id, data, updated_by=current_user.id)
    if not claim:
        raise HTTPException(status_code=404, detail="Reclamacion no encontrada")
    return InsuranceClaimResponse.model_validate(claim)


@router.get("/claims", response_model=PaginatedResponse[InsuranceClaimResponse])
async def list_claims(
    patient_id: uuid.UUID | None = None,
    claim_status: str | None = Query(default=None, alias="status"),
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("claims:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar reclamaciones con filtros."""
    if pagination is None:
        pagination = PaginationParams()
    service = InsuranceClaimService(db)
    claims, total = await service.list_claims(
        patient_id=patient_id, status=claim_status,
        offset=pagination.offset, limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[InsuranceClaimResponse.model_validate(c) for c in claims],
        total=total, page=pagination.page, page_size=pagination.page_size,
    )


# =============================================
# Contabilidad General (GL)
# =============================================

@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear una cuenta en el plan contable."""
    service = AccountingService(db)
    account = await service.create_account(**data.model_dump())
    return AccountResponse.model_validate(account)


@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    category: str | None = None,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar plan de cuentas contables."""
    service = AccountingService(db)
    accounts = await service.list_accounts(category=category)
    return [AccountResponse.model_validate(a) for a in accounts]


@router.post("/accounts/seed")
async def seed_chart_of_accounts(
    current_user: User = Depends(require_permissions("billing:write")),
    db: AsyncSession = Depends(get_db),
):
    """Inicializar plan de cuentas predeterminado para hospitales."""
    service = AccountingService(db)
    count = await service.seed_chart_of_accounts()
    if count == 0:
        return {"mensaje": "El plan de cuentas ya existe", "cuentas_creadas": 0}
    return {"mensaje": f"Plan de cuentas inicializado con {count} cuentas", "cuentas_creadas": count}


@router.get("/journal-entries", response_model=PaginatedResponse[JournalEntryResponse])
async def list_journal_entries(
    start_date: date | None = None,
    end_date: date | None = None,
    reference_type: str | None = None,
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar asientos contables del libro diario."""
    if pagination is None:
        pagination = PaginationParams()
    service = AccountingService(db)
    entries, total = await service.list_journal_entries(
        start_date=start_date, end_date=end_date,
        reference_type=reference_type,
        offset=pagination.offset, limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[JournalEntryResponse.model_validate(e) for e in entries],
        total=total, page=pagination.page, page_size=pagination.page_size,
    )


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
async def get_journal_entry(
    entry_id: uuid.UUID,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener asiento contable con lineas de detalle."""
    service = AccountingService(db)
    entry = await service.get_journal_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Asiento contable no encontrado")
    return JournalEntryResponse.model_validate(entry)


# =============================================
# Reportes Financieros
# =============================================

@router.get("/reports/ar-aging")
async def get_ar_aging_report(
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Reporte de antiguedad de cuentas por cobrar."""
    service = AccountingService(db)
    return await service.get_ar_aging_report()


@router.get("/reports/trial-balance")
async def get_trial_balance(
    as_of_date: date | None = None,
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """Balance de comprobacion a una fecha determinada."""
    service = AccountingService(db)
    return await service.get_trial_balance(as_of_date=as_of_date)


@router.get("/reports/dgii/{report_type}")
async def generate_dgii_report(
    report_type: str,
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Generar reporte DGII (Republica Dominicana).
    report_type: 607 (ventas), 608 (compras), 609 (anulaciones)
    """
    if report_type not in ("607", "608", "609"):
        raise HTTPException(status_code=400, detail="Tipo de reporte debe ser 607, 608 o 609")

    try:
        from app.integrations.fiscal.dgii_reports import (
            generar_reporte_607,
            generar_reporte_608,
            generar_reporte_609,
        )
    except ImportError:
        raise HTTPException(status_code=501, detail="Modulo de reportes DGII no disponible")

    # Obtener facturas del periodo
    from sqlalchemy import select as sa_select
    from app.modules.billing.models import Invoice

    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    stmt = sa_select(Invoice).where(
        Invoice.is_active == True,
        Invoice.created_at >= start_date,
        Invoice.created_at < end_date,
    )
    result = await db.execute(stmt)
    invoices = list(result.scalars().all())

    invoice_dicts = [
        {
            "rnc_cedula_comprador": inv.customer_tax_id or "",
            "tipo_identificacion": 1 if len(inv.customer_tax_id or "") == 9 else 2,
            "ncf": inv.fiscal_number or inv.invoice_number,
            "fecha_comprobante": inv.created_at.strftime("%Y%m%d") if inv.created_at else "",
            "monto_facturado": float(inv.grand_total),
            "itbis_facturado": float(inv.tax_total),
            "status": inv.status,
        }
        for inv in invoices
    ]

    # Obtener RNC del tenant
    rnc = ""
    from app.modules.billing.models import FiscalConfig
    fc_stmt = sa_select(FiscalConfig).where(
        FiscalConfig.country_code == "DO",
        FiscalConfig.is_active == True,
    ).limit(1)
    fc_result = await db.execute(fc_stmt)
    fc = fc_result.scalar_one_or_none()
    if fc:
        rnc = fc.tax_id

    periodo = f"{year}{month:02d}"

    if report_type == "607":
        content = generar_reporte_607(rnc, periodo, invoice_dicts)
    elif report_type == "608":
        content = generar_reporte_608(rnc, periodo, invoice_dicts)
    else:
        cancelled = [d for d in invoice_dicts if d["status"] == "cancelled"]
        content = generar_reporte_609(rnc, periodo, cancelled)

    import io
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename=DGII_{report_type}_{periodo}.txt"
        },
    )


# =============================================
# Validacion Fiscal
# =============================================

@router.post("/fiscal/validate-rnc", response_model=RNCValidationResponse)
async def validate_rnc(
    data: RNCValidationRequest,
    current_user: User = Depends(require_permissions("billing:read")),
):
    """Validar RNC o Cedula dominicana."""
    try:
        from app.integrations.fiscal.engine import get_fiscal_engine
        engine = get_fiscal_engine(data.country_code)
        result = await engine.validate_tax_id(data.tax_id)
        return RNCValidationResponse(
            tax_id=result["tax_id"],
            valid=result["valid"],
            document_type=result.get("type", "desconocido"),
            formatted=result.get("formatted"),
            message="RNC/Cedula valido" if result["valid"] else "RNC/Cedula invalido",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
# Estadísticas
# ============================================================

@router.get("/stats")
async def get_billing_stats(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtener estadísticas de facturación.
    Retorna totales facturados, cobrados y pendientes.
    """
    from sqlalchemy import func, select
    from app.modules.billing.models import Invoice, Payment
    from datetime import datetime, timezone

    # Base query para facturas
    invoice_stmt = select(Invoice).where(Invoice.is_active == True)
    
    if date_from:
        start_dt = datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc)
        invoice_stmt = invoice_stmt.where(Invoice.created_at >= start_dt)
    
    if date_to:
        end_dt = datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc)
        invoice_stmt = invoice_stmt.where(Invoice.created_at <= end_dt)
    
    # Total facturado
    total_billed_stmt = select(func.sum(Invoice.grand_total)).select_from(
        invoice_stmt.subquery()
    )
    total_billed_result = await db.execute(total_billed_stmt)
    total_billed = float(total_billed_result.scalar_one() or 0)
    
    # Total cobrado (facturas pagadas)
    paid_stmt = select(func.sum(Invoice.grand_total)).select_from(
        invoice_stmt.where(Invoice.status == "paid").subquery()
    )
    paid_result = await db.execute(paid_stmt)
    total_collected = float(paid_result.scalar_one() or 0)
    
    # Pendiente de cobro
    total_pending = total_billed - total_collected
    
    # Conteo de facturas
    count_stmt = select(func.count(Invoice.id)).select_from(invoice_stmt.subquery())
    count_result = await db.execute(count_stmt)
    invoices_count = count_result.scalar_one() or 0
    
    return {
        "total_billed": total_billed,
        "total_collected": total_collected,
        "total_pending": total_pending,
        "invoices_count": invoices_count,
    }
