"""
Rutas API del modulo de Facturacion y Seguros.
Catalogo, cargos, facturas, pagos y reclamaciones.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, current_tenant
from app.modules.auth.dependencies import get_current_active_user, require_permissions
from app.modules.auth.models import User
from app.modules.billing.schemas import (
    ChargeItemCreate,
    ChargeItemResponse,
    FiscalConfigCreate,
    FiscalConfigResponse,
    InsuranceClaimCreate,
    InsuranceClaimResponse,
    InsuranceClaimStatusUpdate,
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    PaymentCreate,
    PaymentResponse,
    ServiceCatalogCreate,
    ServiceCatalogResponse,
)
from app.modules.billing.service import (
    ChargeService,
    InsuranceClaimService,
    InvoiceService,
    PaymentService,
    ServiceCatalogService,
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
