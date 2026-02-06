"""
Modelos de datos del modulo de Farmacia e Inventario.
Productos, lotes, prescripciones, dispensacion, almacenes, sustancias controladas.
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
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_models import BaseEntity, TimestampMixin, UUIDMixin


class Product(Base, BaseEntity):
    """
    Catalogo maestro de productos farmaceuticos e insumos medicos.
    Incluye clasificacion ATC, control de sustancias y cadena de frio.
    """

    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    generic_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    active_ingredient: Mapped[str | None] = mapped_column(String(200), nullable=True)
    presentation: Mapped[str | None] = mapped_column(String(100), nullable=True)  # tableta, ampolla, frasco
    concentration: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 500mg, 10ml
    unit_of_measure: Mapped[str] = mapped_column(String(20), default="unidad")
    product_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # medication, supply, device

    # Clasificacion
    atc_code: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    therapeutic_group: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Control
    controlled_substance_level: Mapped[int] = mapped_column(
        SmallInteger, default=0
    )  # 0=no controlada, 1-5=nivel de control
    requires_cold_chain: Mapped[bool] = mapped_column(default=False)
    requires_prescription: Mapped[bool] = mapped_column(default=True)

    # Identificacion
    barcode: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    manufacturer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="active")

    # Relaciones
    lots: Mapped[list["ProductLot"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class ProductLot(Base, BaseEntity):
    """
    Lote de producto con control de vencimiento y FEFO.
    """

    __tablename__ = "product_lots"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    lot_number: Mapped[str] = mapped_column(String(50), nullable=False)
    expiration_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_per_unit: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    supplier_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(20), default="available")  # available, depleted, expired, quarantine

    # Relaciones
    product: Mapped["Product"] = relationship(back_populates="lots")

    __table_args__ = (
        Index("ix_product_lots_expiration", "product_id", "expiration_date"),
    )


class Warehouse(Base, BaseEntity):
    """Almacen o punto de dispensacion."""

    __tablename__ = "warehouses"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    warehouse_type: Mapped[str] = mapped_column(
        String(30), default="central"
    )  # central, satellite, floor_stock, emergency_cart
    location_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")


class StockLevel(Base, UUIDMixin, TimestampMixin):
    """Nivel de inventario por producto y almacen."""

    __tablename__ = "stock_levels"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False
    )
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    reorder_point: Mapped[int] = mapped_column(Integer, default=10)
    max_level: Mapped[int] = mapped_column(Integer, default=100)
    last_counted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_stock_product_warehouse", "product_id", "warehouse_id", unique=True),
    )


class Prescription(Base, BaseEntity):
    """
    Prescripcion medica electronica con validacion inteligente.
    Verifica alergias, interacciones, dosis y disponibilidad.
    """

    __tablename__ = "prescriptions"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    prescribed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Medicamento
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    medication_name: Mapped[str] = mapped_column(String(300), nullable=False)

    # Posologia
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)  # "500mg"
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)  # "cada 8 horas"
    route: Mapped[str] = mapped_column(String(50), nullable=False)  # oral, IV, IM, topico
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quantity_prescribed: Mapped[int] = mapped_column(Integer, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Control
    substitution_allowed: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, dispensed, partially_dispensed, cancelled, expired

    # Alertas generadas
    alerts_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {"allergy_warning": true, "interaction_warning": [...], "dose_warning": null}

    # Relaciones
    product: Mapped["Product"] = relationship()
    dispensations: Mapped[list["Dispensation"]] = relationship(
        back_populates="prescription", cascade="all, delete-orphan"
    )


class Dispensation(Base, BaseEntity):
    """
    Registro de dispensacion con trazabilidad completa.
    Vincula prescripcion, lote y paciente.
    """

    __tablename__ = "dispensations"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=False
    )
    product_lot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_lots.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    quantity_dispensed: Mapped[int] = mapped_column(Integer, nullable=False)
    dispensed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    dispensed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    patient_verified: Mapped[bool] = mapped_column(default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relaciones
    prescription: Mapped["Prescription"] = relationship(back_populates="dispensations")
    product_lot: Mapped["ProductLot"] = relationship()


class PurchaseOrder(Base, BaseEntity):
    """Orden de compra a proveedores."""

    __tablename__ = "purchase_orders"

    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    supplier_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="draft"
    )  # draft, approved, ordered, received, cancelled
    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_delivery: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    items_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class StockMovement(Base, UUIDMixin, TimestampMixin):
    """Trazabilidad de movimientos entre almacenes."""

    __tablename__ = "stock_movements"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    lot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_lots.id"), nullable=True
    )
    from_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    to_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    movement_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # transfer, adjustment, return, waste, receipt, dispensation
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    performed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ControlledSubstanceLog(Base, UUIDMixin, TimestampMixin):
    """
    Registro especial para sustancias controladas.
    Requiere doble firma y balance de libro.
    """

    __tablename__ = "controlled_substance_logs"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    lot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    action: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # receive, dispense, waste, return, adjust
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    performed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    witnessed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
