"""
Schemas Pydantic del modulo de Facturacion y Seguros.
"""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


# =============================================
# Catalogo de Servicios
# =============================================

class ServiceCatalogCreate(BaseModel):
    """Creacion de servicio en catalogo."""
    code: str = Field(max_length=20)
    name: str = Field(max_length=300)
    description: str | None = None
    category: str
    base_price: float = Field(ge=0)
    tax_rate: float = Field(default=0.0, ge=0, le=1)
    currency: str = "DOP"
    cpt_code: str | None = None
    cups_code: str | None = None


class ServiceCatalogResponse(BaseModel):
    """Respuesta de servicio."""
    id: uuid.UUID
    code: str
    name: str
    description: str | None = None
    category: str
    base_price: float
    tax_rate: float
    currency: str
    cpt_code: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Cargos
# =============================================

class ChargeItemCreate(BaseModel):
    """Creacion de cargo."""
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    service_id: uuid.UUID
    description: str = Field(max_length=300)
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(ge=0)
    discount: float = Field(default=0.0, ge=0)
    covered_by_insurance: float = Field(default=0.0, ge=0)


class ChargeItemResponse(BaseModel):
    """Respuesta de cargo."""
    id: uuid.UUID
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    service_id: uuid.UUID
    description: str
    quantity: int
    unit_price: float
    discount: float
    tax: float
    total: float
    covered_by_insurance: float
    patient_responsibility: float
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Facturas
# =============================================

class InvoiceCreate(BaseModel):
    """Creacion de factura."""
    patient_id: uuid.UUID
    encounter_id: uuid.UUID | None = None
    charge_item_ids: list[uuid.UUID] = []
    currency: str = "DOP"
    customer_name: str | None = None
    customer_tax_id: str | None = None
    customer_address: str | None = None
    due_date: date | None = None
    country_code: str = "DO"
    fiscal_type: str | None = None


class InvoiceLineResponse(BaseModel):
    """Respuesta de linea de factura."""
    id: uuid.UUID
    description: str
    quantity: int
    unit_price: float
    discount: float
    tax: float
    line_total: float

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    """Respuesta de factura completa."""
    id: uuid.UUID
    patient_id: uuid.UUID
    invoice_number: str
    fiscal_number: str | None = None
    subtotal: float
    tax_total: float
    discount_total: float
    grand_total: float
    currency: str
    status: str
    due_date: date | None = None
    paid_date: date | None = None
    country_code: str
    customer_name: str | None = None
    customer_tax_id: str | None = None
    lines: list[InvoiceLineResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    """Respuesta resumida de factura."""
    id: uuid.UUID
    invoice_number: str
    fiscal_number: str | None = None
    patient_id: uuid.UUID
    grand_total: float
    currency: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Pagos
# =============================================

class PaymentCreate(BaseModel):
    """Registro de pago."""
    invoice_id: uuid.UUID
    amount: float = Field(gt=0)
    payment_method: str = Field(description="cash, card, transfer, insurance, check")
    reference_number: str | None = None
    notes: str | None = None


class PaymentResponse(BaseModel):
    """Respuesta de pago."""
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: float
    payment_method: str
    reference_number: str | None = None
    received_at: datetime
    reconciled: bool
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Reclamaciones de Seguros
# =============================================

class InsuranceClaimCreate(BaseModel):
    """Creacion de reclamacion."""
    patient_id: uuid.UUID
    encounter_id: uuid.UUID
    insurer_name: str
    insurer_code: str | None = None
    policy_number: str
    total_claimed: float = Field(gt=0)
    claim_details: dict[str, Any] | None = None
    notes: str | None = None


class InsuranceClaimStatusUpdate(BaseModel):
    """Actualizacion de estado de reclamacion."""
    status: str
    total_approved: float | None = None
    total_denied: float | None = None
    denial_reason: str | None = None


class InsuranceClaimResponse(BaseModel):
    """Respuesta de reclamacion."""
    id: uuid.UUID
    patient_id: uuid.UUID
    encounter_id: uuid.UUID
    insurer_name: str
    claim_number: str
    total_claimed: float
    total_approved: float
    total_denied: float
    status: str
    submitted_at: datetime | None = None
    adjudicated_at: datetime | None = None
    denial_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Configuracion Fiscal
# =============================================

class FiscalConfigCreate(BaseModel):
    """Configuracion fiscal."""
    country_code: str = Field(max_length=2)
    tax_id: str = Field(max_length=30)
    fiscal_regime: str | None = None
    business_name: str = Field(max_length=200)
    business_address: str | None = None
    sequence_prefix: str | None = None
    default_tax_rate: float = 0.18
    tax_name: str = "ITBIS"


class FiscalConfigResponse(BaseModel):
    """Respuesta de configuracion fiscal."""
    id: uuid.UUID
    country_code: str
    tax_id: str
    fiscal_regime: str | None = None
    business_name: str
    default_tax_rate: float
    tax_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Notas de Credito
# =============================================

class CreditNoteLineCreate(BaseModel):
    """Linea de nota de credito."""
    original_invoice_line_id: uuid.UUID | None = None
    description: str = Field(max_length=300)
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(ge=0)
    tax: float = Field(default=0.0, ge=0)


class CreditNoteCreate(BaseModel):
    """Creacion de nota de credito."""
    original_invoice_id: uuid.UUID
    reason: str = Field(max_length=500)
    lines: list[CreditNoteLineCreate] = []
    full_reversal: bool = False


class CreditNoteLineResponse(BaseModel):
    """Respuesta de linea de nota de credito."""
    id: uuid.UUID
    description: str
    quantity: int
    unit_price: float
    tax: float
    line_total: float

    model_config = {"from_attributes": True}


class CreditNoteResponse(BaseModel):
    """Respuesta de nota de credito."""
    id: uuid.UUID
    credit_note_number: str
    fiscal_number: str | None = None
    original_invoice_id: uuid.UUID
    patient_id: uuid.UUID
    reason: str
    subtotal: float
    tax_total: float
    grand_total: float
    currency: str
    status: str
    lines: list[CreditNoteLineResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Anulacion y Reversiones
# =============================================

class InvoiceVoidRequest(BaseModel):
    """Solicitud de anulacion de factura."""
    reason: str = Field(min_length=10, max_length=500)


class PaymentReversalRequest(BaseModel):
    """Solicitud de reversion de pago."""
    reason: str = Field(min_length=10, max_length=500)


class PaymentReversalResponse(BaseModel):
    """Respuesta de reversion de pago."""
    original_payment_id: uuid.UUID
    reversal_amount: float
    reason: str
    invoice_id: uuid.UUID
    new_invoice_status: str
    mensaje: str


# =============================================
# Contabilidad General (GL)
# =============================================

class AccountCreate(BaseModel):
    """Creacion de cuenta contable."""
    code: str = Field(max_length=20)
    name: str = Field(max_length=200)
    description: str | None = None
    category: str = Field(description="activo, pasivo, patrimonio, ingreso, gasto")
    account_type: str = Field(max_length=50)
    parent_code: str | None = None
    is_detail: bool = True
    normal_balance: str = "debit"
    currency: str = "DOP"


class AccountResponse(BaseModel):
    """Respuesta de cuenta contable."""
    id: uuid.UUID
    code: str
    name: str
    description: str | None = None
    category: str
    account_type: str
    parent_code: str | None = None
    is_detail: bool
    normal_balance: str
    currency: str
    created_at: datetime

    model_config = {"from_attributes": True}


class JournalEntryLineResponse(BaseModel):
    """Respuesta de linea de asiento."""
    id: uuid.UUID
    account_id: uuid.UUID
    description: str | None = None
    debit: float
    credit: float

    model_config = {"from_attributes": True}


class JournalEntryResponse(BaseModel):
    """Respuesta de asiento contable."""
    id: uuid.UUID
    entry_number: str
    entry_date: date
    description: str
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    total_debit: float
    total_credit: float
    status: str
    lines: list[JournalEntryLineResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Reportes Financieros
# =============================================

class ARAgingItem(BaseModel):
    """Item del reporte de antiguedad de cuentas por cobrar."""
    patient_id: uuid.UUID
    patient_name: str
    invoice_id: uuid.UUID
    invoice_number: str
    fiscal_number: str | None = None
    invoice_date: date
    due_date: date | None = None
    grand_total: float
    total_paid: float
    balance: float
    days_outstanding: int
    aging_bucket: str


class ARAgingReport(BaseModel):
    """Reporte de antiguedad de cuentas por cobrar."""
    generated_at: datetime
    currency: str = "DOP"
    items: list[ARAgingItem]
    summary: dict
    total_receivable: float


class TrialBalanceLine(BaseModel):
    """Linea del balance de comprobacion."""
    account_code: str
    account_name: str
    category: str
    debit_balance: float
    credit_balance: float


class TrialBalance(BaseModel):
    """Balance de comprobacion."""
    as_of_date: date
    currency: str = "DOP"
    lines: list[TrialBalanceLine]
    total_debits: float
    total_credits: float


# =============================================
# Validacion Fiscal
# =============================================

class RNCValidationRequest(BaseModel):
    """Solicitud de validacion de RNC/Cedula."""
    tax_id: str = Field(max_length=30)
    country_code: str = Field(default="DO", max_length=2)


class RNCValidationResponse(BaseModel):
    """Respuesta de validacion de RNC/Cedula."""
    tax_id: str
    valid: bool
    document_type: str
    formatted: str | None = None
    business_name: str | None = None
    message: str | None = None
