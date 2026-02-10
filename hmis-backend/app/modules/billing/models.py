"""
Modelos de datos del modulo de Facturacion y Seguros.
Catalogo de servicios, cargos, facturas, pagos, reclamaciones e integraciones fiscales.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_models import BaseEntity, TimestampMixin, UUIDMixin


class ServiceCatalog(Base, BaseEntity):
    """
    Catalogo maestro de servicios medicos con precios base.
    Incluye codificacion CPT/CUPS para interoperabilidad.
    """

    __tablename__ = "service_catalog"

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # consulta, laboratorio, imagen, procedimiento, medicamento
    base_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.0)  # ITBIS/IVA
    currency: Mapped[str] = mapped_column(String(3), default="DOP")
    cpt_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    cups_code: Mapped[str | None] = mapped_column(String(10), nullable=True)  # Colombia


class ChargeItem(Base, BaseEntity):
    """
    Cargo individual generado por servicios medicos.
    Se acumula en la cuenta del paciente hasta generar factura.
    """

    __tablename__ = "charge_items"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("service_catalog.id"), nullable=False
    )

    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Cobertura de seguro
    covered_by_insurance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    patient_responsibility: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, invoiced, paid, cancelled
    charged_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Relaciones
    service: Mapped["ServiceCatalog"] = relationship()


class Invoice(Base, BaseEntity):
    """
    Factura fiscal con numeracion secuencial segun pais.
    Soporta NCF (RD), CFDI (MX), FEL (CO), DTE (CL), CPE (PE).
    """

    __tablename__ = "invoices"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Numeracion
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    fiscal_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )  # NCF, CFDI, etc.

    # Montos
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    tax_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    discount_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="DOP")

    # Estado
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, issued, paid, partial, cancelled, credit_note
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Datos fiscales
    fiscal_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), default="DO")
    tax_id: Mapped[str | None] = mapped_column(String(30), nullable=True)  # RNC/Cedula del cliente

    # Datos del receptor
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_tax_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    customer_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Metadata fiscal
    fiscal_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relaciones
    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceLine(Base, UUIDMixin, TimestampMixin):
    """Linea de detalle de factura."""

    __tablename__ = "invoice_lines"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False
    )
    charge_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Relaciones
    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class Payment(Base, BaseEntity):
    """
    Registro de pagos con soporte multi-metodo.
    Un pago puede aplicarse a una o multiples facturas.
    """

    __tablename__ = "payments"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # cash, card, transfer, insurance, check
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    received_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reconciled: Mapped[bool] = mapped_column(default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relaciones
    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class InsuranceClaim(Base, BaseEntity):
    """
    Reclamacion a aseguradora con ciclo de vida completo.
    Desde la presentacion hasta el cobro o denegacion.
    """

    __tablename__ = "insurance_claims"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    insurer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    insurer_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    policy_number: Mapped[str] = mapped_column(String(50), nullable=False)

    claim_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    total_claimed: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total_approved: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_denied: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)

    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, submitted, pending, partial, paid, denied, appealed

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    adjudicated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Detalle de la reclamacion
    claim_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    denial_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class FiscalConfig(Base, BaseEntity):
    """
    Configuracion fiscal por tenant y pais.
    Contiene credenciales de API y secuencias de numeracion.
    """

    __tablename__ = "fiscal_configs"

    tenant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    tax_id: Mapped[str] = mapped_column(String(30), nullable=False)  # RNC, RFC, NIT, RUT
    fiscal_regime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    business_name: Mapped[str] = mapped_column(String(200), nullable=False)
    business_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Secuencias de numeracion
    sequence_prefix: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_sequence: Mapped[int] = mapped_column(Integer, default=0)

    # Credenciales API del ente fiscal (encriptadas)
    api_credentials: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Configuracion de impuestos
    default_tax_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.18)  # ITBIS 18%
    tax_name: Mapped[str] = mapped_column(String(20), default="ITBIS")

    __table_args__ = (
        Index("ix_fiscal_config_tenant_country", "tenant_id", "country_code", unique=True),
    )


class InsurerContract(Base, BaseEntity):
    """Contrato con aseguradora con tarifario negociado."""

    __tablename__ = "insurer_contracts"

    insurer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    insurer_code: Mapped[str] = mapped_column(String(50), nullable=False)
    contract_number: Mapped[str] = mapped_column(String(50), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Tarifario negociado por servicio
    terms_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Reglas de adjudicacion
    adjudication_rules_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="active")


# =============================================
# Contabilidad General (General Ledger)
# =============================================


class AccountCategory:
    """Categorias de cuentas contables."""
    ASSET = "activo"
    LIABILITY = "pasivo"
    EQUITY = "patrimonio"
    REVENUE = "ingreso"
    EXPENSE = "gasto"


class Account(Base, BaseEntity):
    """
    Cuenta del plan contable (Chart of Accounts).
    Estructura jerarquica con codigo padre para subcuentas.
    """

    __tablename__ = "accounts"

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # activo, pasivo, patrimonio, ingreso, gasto
    account_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # cuentas_por_cobrar, caja, banco, ingreso_servicios, etc.
    parent_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    is_detail: Mapped[bool] = mapped_column(default=True)  # Solo las de detalle aceptan movimientos
    normal_balance: Mapped[str] = mapped_column(
        String(10), default="debit"
    )  # debit o credit
    currency: Mapped[str] = mapped_column(String(3), default="DOP")

    __table_args__ = (
        Index("ix_accounts_category", "category"),
    )


class JournalEntry(Base, BaseEntity):
    """
    Asiento contable de partida doble.
    Todo movimiento financiero genera un asiento con debitos = creditos.
    """

    __tablename__ = "journal_entries"

    entry_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    reference_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # invoice, payment, credit_note, adjustment
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    total_debit: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total_credit: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="posted"
    )  # draft, posted, reversed
    reversed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reversal_of: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    posted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Relaciones
    lines: Mapped[list["JournalEntryLine"]] = relationship(
        back_populates="journal_entry", cascade="all, delete-orphan"
    )


class JournalEntryLine(Base, UUIDMixin, TimestampMixin):
    """
    Linea de asiento contable.
    Cada linea afecta una cuenta con debito o credito (nunca ambos).
    """

    __tablename__ = "journal_entry_lines"

    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    debit: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    credit: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)

    # Relaciones
    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")
    account: Mapped["Account"] = relationship()


class CreditNote(Base, BaseEntity):
    """
    Nota de credito vinculada a factura original.
    Genera NCF tipo 04 y asiento contable de reversa.
    """

    __tablename__ = "credit_notes"

    credit_note_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    fiscal_number: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    original_invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(String(500), nullable=False)

    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    tax_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="DOP")

    status: Mapped[str] = mapped_column(
        String(20), default="issued"
    )  # issued, applied, cancelled

    # Datos fiscales
    country_code: Mapped[str] = mapped_column(String(2), default="DO")
    fiscal_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relacion con factura original
    original_invoice: Mapped["Invoice"] = relationship()
    lines: Mapped[list["CreditNoteLine"]] = relationship(
        back_populates="credit_note", cascade="all, delete-orphan"
    )


class CreditNoteLine(Base, UUIDMixin, TimestampMixin):
    """Linea de detalle de nota de credito."""

    __tablename__ = "credit_note_lines"

    credit_note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_notes.id"), nullable=False
    )
    original_invoice_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    credit_note: Mapped["CreditNote"] = relationship(back_populates="lines")


# =============================================
# Stripe Payment Integration Models
# =============================================


class StripeCustomer(Base, BaseEntity):
    """
    Stripe customer mapping for patients.
    Links HMIS patients to Stripe customer IDs for payment processing.
    """

    __tablename__ = "stripe_customers"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True
    )
    stripe_customer_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    default_payment_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stripe_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (Index("ix_stripe_customers_patient", "patient_id"),)


class StripePaymentMethod(Base, BaseEntity):
    """
    Saved payment methods from Stripe.
    Stores tokenized payment method details for future use.
    """

    __tablename__ = "stripe_payment_methods"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    stripe_customer_id: Mapped[str] = mapped_column(String(100), nullable=False)
    stripe_payment_method_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # card, bank_account, etc.
    card_brand: Mapped[str | None] = mapped_column(String(20), nullable=True)  # visa, mastercard, etc.
    card_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    card_exp_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    card_exp_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False)
    stripe_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class StripePaymentIntent(Base, BaseEntity):
    """
    Stripe payment intent tracking.
    Links Stripe payment intents to HMIS invoices for reconciliation.
    """

    __tablename__ = "stripe_payment_intents"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    stripe_payment_intent_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # requires_payment_method, requires_confirmation, requires_action, processing, succeeded, canceled
    payment_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_secret: Mapped[str | None] = mapped_column(String(200), nullable=True)
    last_payment_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    webhook_received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class StripeRefund(Base, BaseEntity):
    """
    Stripe refund tracking.
    Records refunds processed through Stripe.
    """

    __tablename__ = "stripe_refunds"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False, index=True
    )
    stripe_refund_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    stripe_payment_intent_id: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # pending, succeeded, failed, canceled
    stripe_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
