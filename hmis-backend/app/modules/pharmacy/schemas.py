"""
Schemas Pydantic del modulo de Farmacia e Inventario.
"""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


# =============================================
# Productos
# =============================================

class ProductCreate(BaseModel):
    """Creacion de producto farmaceutico."""
    name: str = Field(max_length=300)
    generic_name: str | None = None
    active_ingredient: str | None = None
    presentation: str | None = None
    concentration: str | None = None
    unit_of_measure: str = "unidad"
    product_type: str = Field(description="medication, supply, device")
    atc_code: str | None = None
    therapeutic_group: str | None = None
    controlled_substance_level: int = Field(default=0, ge=0, le=5)
    requires_cold_chain: bool = False
    requires_prescription: bool = True
    barcode: str | None = None
    manufacturer: str | None = None


class ProductResponse(BaseModel):
    """Respuesta de producto."""
    id: uuid.UUID
    name: str
    generic_name: str | None = None
    active_ingredient: str | None = None
    presentation: str | None = None
    concentration: str | None = None
    unit_of_measure: str
    product_type: str
    atc_code: str | None = None
    controlled_substance_level: int
    requires_cold_chain: bool
    requires_prescription: bool
    barcode: str | None = None
    manufacturer: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Lotes
# =============================================

class ProductLotCreate(BaseModel):
    """Recepcion de lote."""
    product_id: uuid.UUID
    lot_number: str = Field(max_length=50)
    expiration_date: date
    quantity_received: int = Field(gt=0)
    cost_per_unit: float = Field(default=0.0, ge=0)
    supplier_name: str | None = None


class ProductLotResponse(BaseModel):
    """Respuesta de lote."""
    id: uuid.UUID
    product_id: uuid.UUID
    lot_number: str
    expiration_date: date
    quantity_received: int
    quantity_available: int
    cost_per_unit: float
    supplier_name: str | None = None
    status: str
    received_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Prescripciones
# =============================================

class PrescriptionCreate(BaseModel):
    """Creacion de prescripcion medica."""
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    product_id: uuid.UUID
    medication_name: str = Field(max_length=300)
    dosage: str = Field(max_length=100, description="Ej: 500mg")
    frequency: str = Field(max_length=100, description="Ej: cada 8 horas")
    route: str = Field(max_length=50, description="oral, IV, IM, topico")
    duration_days: int | None = None
    quantity_prescribed: int = Field(gt=0)
    instructions: str | None = None
    substitution_allowed: bool = True


class PrescriptionResponse(BaseModel):
    """Respuesta de prescripcion."""
    id: uuid.UUID
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    prescribed_by: uuid.UUID
    product_id: uuid.UUID
    medication_name: str
    dosage: str
    frequency: str
    route: str
    duration_days: int | None = None
    quantity_prescribed: int
    instructions: str | None = None
    substitution_allowed: bool
    status: str
    alerts_json: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Dispensacion
# =============================================

class DispensationCreate(BaseModel):
    """Registro de dispensacion."""
    prescription_id: uuid.UUID
    product_lot_id: uuid.UUID
    patient_id: uuid.UUID
    quantity_dispensed: int = Field(gt=0)
    patient_verified: bool = False
    notes: str | None = None


class DispensationResponse(BaseModel):
    """Respuesta de dispensacion."""
    id: uuid.UUID
    prescription_id: uuid.UUID
    product_lot_id: uuid.UUID
    patient_id: uuid.UUID
    quantity_dispensed: int
    dispensed_by: uuid.UUID
    dispensed_at: datetime
    patient_verified: bool
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Inventario
# =============================================

class StockLevelResponse(BaseModel):
    """Nivel de stock."""
    product_id: uuid.UUID
    warehouse_id: uuid.UUID
    quantity_on_hand: int
    quantity_reserved: int
    reorder_point: int
    max_level: int
    available: int = 0

    model_config = {"from_attributes": True}


class StockMovementCreate(BaseModel):
    """Movimiento de inventario."""
    product_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    from_warehouse_id: uuid.UUID | None = None
    to_warehouse_id: uuid.UUID | None = None
    quantity: int = Field(gt=0)
    movement_type: str = Field(description="transfer, adjustment, return, waste, receipt")
    reason: str | None = None


class StockMovementResponse(BaseModel):
    """Respuesta de movimiento."""
    id: uuid.UUID
    product_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    from_warehouse_id: uuid.UUID | None = None
    to_warehouse_id: uuid.UUID | None = None
    quantity: int
    movement_type: str
    reason: str | None = None
    performed_by: uuid.UUID
    performed_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Ordenes de Compra
# =============================================

class PurchaseOrderCreate(BaseModel):
    """Creacion de orden de compra."""
    supplier_name: str = Field(max_length=200)
    supplier_code: str | None = None
    warehouse_id: uuid.UUID
    expected_delivery: date | None = None
    items_json: list[dict[str, Any]] = []
    notes: str | None = None


class PurchaseOrderResponse(BaseModel):
    """Respuesta de orden de compra."""
    id: uuid.UUID
    supplier_name: str
    warehouse_id: uuid.UUID
    status: str
    order_date: date | None = None
    expected_delivery: date | None = None
    total_amount: float
    items_json: list | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Almacenes
# =============================================

class WarehouseCreate(BaseModel):
    """Creacion de almacen."""
    name: str = Field(max_length=200)
    warehouse_type: str = Field(default="central", description="central, satellite, floor_stock, emergency_cart")
    location_description: str | None = None
    manager_id: uuid.UUID | None = None


class WarehouseResponse(BaseModel):
    """Respuesta de almacen."""
    id: uuid.UUID
    name: str
    warehouse_type: str
    location_description: str | None = None
    manager_id: uuid.UUID | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Actualizaciones
# =============================================

class ProductUpdate(BaseModel):
    """Actualizacion de producto."""
    name: str | None = None
    generic_name: str | None = None
    presentation: str | None = None
    concentration: str | None = None
    controlled_substance_level: int | None = Field(default=None, ge=0, le=5)
    requires_cold_chain: bool | None = None
    requires_prescription: bool | None = None
    status: str | None = Field(default=None, description="active, discontinued, recalled")


class PrescriptionCancel(BaseModel):
    """Cancelacion de prescripcion."""
    reason: str = Field(max_length=500)


class PurchaseOrderStatusUpdate(BaseModel):
    """Actualizacion de estado de orden de compra."""
    status: str = Field(description="approved, ordered, received, cancelled")
    notes: str | None = None


# =============================================
# Sustancias Controladas
# =============================================

class ControlledSubstanceLogResponse(BaseModel):
    """Respuesta de registro de sustancia controlada."""
    id: uuid.UUID
    product_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    action: str
    quantity: int
    balance_after: int
    patient_id: uuid.UUID | None = None
    performed_by: uuid.UUID
    witnessed_by: uuid.UUID | None = None
    performed_at: datetime
    notes: str | None = None

    model_config = {"from_attributes": True}


# =============================================
# Stock
# =============================================

class StockLevelCreate(BaseModel):
    """Inicializacion de nivel de stock."""
    product_id: uuid.UUID
    warehouse_id: uuid.UUID
    quantity_on_hand: int = Field(default=0, ge=0)
    reorder_point: int = Field(default=10, ge=0)
    max_level: int = Field(default=100, ge=0)
