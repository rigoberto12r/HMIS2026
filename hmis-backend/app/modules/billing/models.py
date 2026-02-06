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
