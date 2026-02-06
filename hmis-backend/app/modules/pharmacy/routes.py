"""
Rutas API del modulo de Farmacia e Inventario.
Productos, prescripciones, dispensacion, inventario y ordenes de compra.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions, require_roles
from app.modules.auth.models import User
from app.modules.pharmacy.schemas import (
    DispensationCreate,
    DispensationResponse,
    PrescriptionCreate,
    PrescriptionResponse,
    ProductCreate,
    ProductLotCreate,
    ProductLotResponse,
    ProductResponse,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    StockLevelResponse,
    StockMovementCreate,
    StockMovementResponse,
)
from app.modules.pharmacy.service import (
    DispensationService,
    InventoryService,
    LotService,
    PrescriptionService,
    ProductService,
)
from app.shared.schemas import MessageResponse, PaginatedResponse, PaginationParams

router = APIRouter()


# =============================================
# Productos
# =============================================

@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(require_permissions("pharmacy:write")),
    db: AsyncSession = Depends(get_db),
):
    """Registrar un producto en el catalogo farmaceutico."""
    service = ProductService(db)
    product = await service.create_product(**data.model_dump(), created_by=current_user.id)
    return ProductResponse.model_validate(product)


@router.get("/products", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    query: str | None = None,
    product_type: str | None = None,
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("pharmacy:read")),
    db: AsyncSession = Depends(get_db),
):
    """Buscar productos farmaceuticos."""
    if pagination is None:
        pagination = PaginationParams()
    service = ProductService(db)
    products, total = await service.search_products(
        query=query, product_type=product_type,
        offset=pagination.offset, limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total, page=pagination.page, page_size=pagination.page_size,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    current_user: User = Depends(require_permissions("pharmacy:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener producto por ID con lotes disponibles."""
    service = ProductService(db)
    product = await service.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return ProductResponse.model_validate(product)


# =============================================
# Lotes
# =============================================

@router.post("/lots", response_model=ProductLotResponse, status_code=status.HTTP_201_CREATED)
async def receive_lot(
    data: ProductLotCreate,
    current_user: User = Depends(require_permissions("inventory:write")),
    db: AsyncSession = Depends(get_db),
):
    """Recepcionar un lote de producto."""
    service = LotService(db)
    lot = await service.receive_lot(data, received_by=current_user.id)
    return ProductLotResponse.model_validate(lot)


@router.get("/products/{product_id}/lots", response_model=list[ProductLotResponse])
async def get_product_lots(
    product_id: uuid.UUID,
    current_user: User = Depends(require_permissions("inventory:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener lotes disponibles de un producto (ordenados FEFO)."""
    service = LotService(db)
    lots = await service.get_available_lots(product_id)
    return [ProductLotResponse.model_validate(l) for l in lots]


@router.get("/lots/expiring", response_model=list[ProductLotResponse])
async def get_expiring_lots(
    days: int = Query(default=90, ge=1, le=365, description="Dias hacia adelante"),
    current_user: User = Depends(require_permissions("inventory:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener lotes proximos a vencer."""
    service = LotService(db)
    lots = await service.get_expiring_lots(days_ahead=days)
    return [ProductLotResponse.model_validate(l) for l in lots]


# =============================================
# Prescripciones
# =============================================

@router.post("/prescriptions", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    data: PrescriptionCreate,
    current_user: User = Depends(require_roles("medico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Crear prescripcion medica electronica.
    Valida automaticamente alergias e interacciones.
    """
    service = PrescriptionService(db)
    prescription = await service.create_prescription(data, prescribed_by=current_user.id)
    return PrescriptionResponse.model_validate(prescription)


@router.get("/prescriptions/{prescription_id}", response_model=PrescriptionResponse)
async def get_prescription(
    prescription_id: uuid.UUID,
    current_user: User = Depends(require_permissions("prescriptions:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener prescripcion por ID."""
    service = PrescriptionService(db)
    prescription = await service.get_prescription(prescription_id)
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescripcion no encontrada")
    return PrescriptionResponse.model_validate(prescription)


@router.get("/prescriptions/patient/{patient_id}", response_model=list[PrescriptionResponse])
async def get_patient_prescriptions(
    patient_id: uuid.UUID,
    prescription_status: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_permissions("prescriptions:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener prescripciones de un paciente."""
    service = PrescriptionService(db)
    prescriptions = await service.get_patient_prescriptions(
        patient_id, status=prescription_status
    )
    return [PrescriptionResponse.model_validate(p) for p in prescriptions]


# =============================================
# Dispensacion
# =============================================

@router.post("/dispensations", response_model=DispensationResponse, status_code=status.HTTP_201_CREATED)
async def dispense_medication(
    data: DispensationCreate,
    current_user: User = Depends(require_roles("farmaceutico", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Dispensar medicamento con verificaciones de seguridad.
    Valida prescripcion, lote, vencimiento y registra sustancias controladas.
    """
    service = DispensationService(db)
    try:
        dispensation = await service.dispense(data, dispensed_by=current_user.id)
        return DispensationResponse.model_validate(dispensation)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# Inventario
# =============================================

@router.get("/inventory/stock", response_model=list[StockLevelResponse])
async def get_stock_levels(
    warehouse_id: uuid.UUID | None = None,
    low_stock_only: bool = False,
    current_user: User = Depends(require_permissions("inventory:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener niveles de inventario con filtro por almacen y stock bajo."""
    service = InventoryService(db)
    levels = await service.get_stock_levels(
        warehouse_id=warehouse_id, low_stock_only=low_stock_only
    )
    return [StockLevelResponse.model_validate(l) for l in levels]


@router.post("/inventory/movements", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
async def record_stock_movement(
    data: StockMovementCreate,
    current_user: User = Depends(require_permissions("inventory:write")),
    db: AsyncSession = Depends(get_db),
):
    """Registrar movimiento de inventario (transferencia, ajuste, devolucion, merma)."""
    service = InventoryService(db)
    movement = await service.record_movement(data, performed_by=current_user.id)
    return StockMovementResponse.model_validate(movement)


@router.get("/inventory/alerts", response_model=list[dict])
async def check_stock_alerts(
    current_user: User = Depends(require_permissions("inventory:read")),
    db: AsyncSession = Depends(get_db),
):
    """Verificar alertas de stock bajo y productos por vencer."""
    service = InventoryService(db)
    return await service.check_low_stock_alerts()
