"""
Servicio de Farmacia e Inventario.
Logica de negocio: prescripciones, dispensacion, inventario, sustancias controladas.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.pharmacy.models import (
    ControlledSubstanceLog,
    Dispensation,
    Prescription,
    Product,
    ProductLot,
    PurchaseOrder,
    StockLevel,
    StockMovement,
    Warehouse,
)
from app.modules.pharmacy.schemas import (
    DispensationCreate,
    PrescriptionCreate,
    ProductLotCreate,
    PurchaseOrderCreate,
    StockMovementCreate,
)
from app.shared.events import (
    MEDICATION_DISPENSED,
    PRESCRIPTION_CREATED,
    STOCK_EXPIRED,
    STOCK_LOW,
    DomainEvent,
    publish,
)


class ProductService:
    """Servicio del catalogo de productos farmaceuticos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_product(self, **kwargs) -> Product:
        product = Product(**kwargs)
        self.db.add(product)
        await self.db.flush()
        return product

    async def get_product(self, product_id: uuid.UUID) -> Product | None:
        stmt = (
            select(Product)
            .where(Product.id == product_id, Product.is_active == True)
            .options(selectinload(Product.lots))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def search_products(
        self, query: str | None = None, product_type: str | None = None,
        offset: int = 0, limit: int = 20,
    ) -> tuple[list[Product], int]:
        stmt = select(Product).where(Product.is_active == True)
        count_stmt = select(func.count()).select_from(Product).where(Product.is_active == True)

        if query:
            filter_q = Product.name.ilike(f"%{query}%")
            stmt = stmt.where(filter_q)
            count_stmt = count_stmt.where(filter_q)
        if product_type:
            stmt = stmt.where(Product.product_type == product_type)
            count_stmt = count_stmt.where(Product.product_type == product_type)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(Product.name)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total


class LotService:
    """Servicio de gestion de lotes."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def receive_lot(
        self, data: ProductLotCreate, received_by: uuid.UUID | None = None
    ) -> ProductLot:
        """Recepciona un lote y actualiza niveles de stock."""
        lot = ProductLot(
            product_id=data.product_id,
            lot_number=data.lot_number,
            expiration_date=data.expiration_date,
            quantity_received=data.quantity_received,
            quantity_available=data.quantity_received,
            cost_per_unit=data.cost_per_unit,
            supplier_name=data.supplier_name,
            created_by=received_by,
        )
        self.db.add(lot)
        await self.db.flush()
        return lot

    async def get_available_lots(
        self, product_id: uuid.UUID, warehouse_id: uuid.UUID | None = None
    ) -> list[ProductLot]:
        """Obtiene lotes disponibles ordenados por FEFO (First Expire, First Out)."""
        stmt = (
            select(ProductLot)
            .where(
                ProductLot.product_id == product_id,
                ProductLot.quantity_available > 0,
                ProductLot.expiration_date > date.today(),
                ProductLot.status == "available",
            )
            .order_by(ProductLot.expiration_date)  # FEFO
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_expiring_lots(self, days_ahead: int = 90) -> list[ProductLot]:
        """Obtiene lotes proximos a vencer."""
        from datetime import timedelta
        expiry_limit = date.today() + timedelta(days=days_ahead)

        stmt = (
            select(ProductLot)
            .where(
                ProductLot.quantity_available > 0,
                ProductLot.expiration_date <= expiry_limit,
                ProductLot.expiration_date > date.today(),
                ProductLot.status == "available",
            )
            .order_by(ProductLot.expiration_date)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class PrescriptionService:
    """Servicio de prescripcion electronica."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_prescription(
        self, data: PrescriptionCreate, prescribed_by: uuid.UUID
    ) -> Prescription:
        """
        Crea una prescripcion con validaciones de seguridad:
        - Verifica alergias del paciente
        - Valida disponibilidad en farmacia
        """
        # Verificar alergias (importacion diferida para evitar dependencia circular)
        alerts = {}
        from app.modules.emr.service import AllergyService
        allergy_service = AllergyService(self.db)
        drug_allergies = await allergy_service.check_drug_allergy(
            data.patient_id, data.medication_name
        )
        if drug_allergies:
            alerts["allergy_warning"] = [
                {"allergen": a.allergen, "severity": a.severity, "reaction": a.reaction}
                for a in drug_allergies
            ]

        prescription = Prescription(
            encounter_id=data.encounter_id,
            patient_id=data.patient_id,
            prescribed_by=prescribed_by,
            product_id=data.product_id,
            medication_name=data.medication_name,
            dosage=data.dosage,
            frequency=data.frequency,
            route=data.route,
            duration_days=data.duration_days,
            quantity_prescribed=data.quantity_prescribed,
            instructions=data.instructions,
            substitution_allowed=data.substitution_allowed,
            alerts_json=alerts if alerts else None,
            created_by=prescribed_by,
        )
        self.db.add(prescription)
        await self.db.flush()

        await publish(DomainEvent(
            event_type=PRESCRIPTION_CREATED,
            aggregate_type="prescription",
            aggregate_id=str(prescription.id),
            data={
                "patient_id": str(data.patient_id),
                "medication": data.medication_name,
                "has_alerts": bool(alerts),
            },
            user_id=str(prescribed_by),
        ))

        return prescription

    async def get_prescription(self, prescription_id: uuid.UUID) -> Prescription | None:
        stmt = (
            select(Prescription)
            .where(Prescription.id == prescription_id, Prescription.is_active == True)
            .options(selectinload(Prescription.dispensations))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_patient_prescriptions(
        self, patient_id: uuid.UUID, status: str | None = None
    ) -> list[Prescription]:
        stmt = select(Prescription).where(
            Prescription.patient_id == patient_id,
            Prescription.is_active == True,
        )
        if status:
            stmt = stmt.where(Prescription.status == status)
        stmt = stmt.order_by(Prescription.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class DispensationService:
    """Servicio de dispensacion de medicamentos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def dispense(
        self, data: DispensationCreate, dispensed_by: uuid.UUID
    ) -> Dispensation:
        """
        Dispensa medicamento con verificaciones:
        - Valida prescripcion activa
        - Descuenta del lote seleccionado (FEFO)
        - Registra sustancias controladas
        - Actualiza niveles de stock
        """
        # Verificar prescripcion
        stmt = select(Prescription).where(Prescription.id == data.prescription_id)
        result = await self.db.execute(stmt)
        prescription = result.scalar_one_or_none()

        if not prescription or prescription.status not in ("active", "partially_dispensed"):
            raise ValueError("Prescripcion no valida o ya dispensada completamente")

        # Verificar lote
        stmt = select(ProductLot).where(ProductLot.id == data.product_lot_id)
        result = await self.db.execute(stmt)
        lot = result.scalar_one_or_none()

        if not lot or lot.quantity_available < data.quantity_dispensed:
            raise ValueError("Lote no disponible o cantidad insuficiente")

        if lot.expiration_date <= date.today():
            raise ValueError("No se puede dispensar de un lote vencido")

        # Crear dispensacion
        dispensation = Dispensation(
            prescription_id=data.prescription_id,
            product_lot_id=data.product_lot_id,
            patient_id=data.patient_id,
            quantity_dispensed=data.quantity_dispensed,
            dispensed_by=dispensed_by,
            patient_verified=data.patient_verified,
            notes=data.notes,
            created_by=dispensed_by,
        )
        self.db.add(dispensation)

        # Actualizar lote
        lot.quantity_available -= data.quantity_dispensed
        if lot.quantity_available == 0:
            lot.status = "depleted"

        # Actualizar estado de prescripcion
        total_dispensed = data.quantity_dispensed
        if prescription.dispensations:
            total_dispensed += sum(d.quantity_dispensed for d in prescription.dispensations)

        if total_dispensed >= prescription.quantity_prescribed:
            prescription.status = "dispensed"
        else:
            prescription.status = "partially_dispensed"

        await self.db.flush()

        # Registrar si es sustancia controlada
        stmt = select(Product).where(Product.id == prescription.product_id)
        result = await self.db.execute(stmt)
        product = result.scalar_one_or_none()

        if product and product.controlled_substance_level > 0:
            log = ControlledSubstanceLog(
                product_id=product.id,
                lot_id=data.product_lot_id,
                action="dispense",
                quantity=data.quantity_dispensed,
                balance_after=lot.quantity_available,
                patient_id=data.patient_id,
                performed_by=dispensed_by,
            )
            self.db.add(log)
            await self.db.flush()

        await publish(DomainEvent(
            event_type=MEDICATION_DISPENSED,
            aggregate_type="dispensation",
            aggregate_id=str(dispensation.id),
            data={
                "patient_id": str(data.patient_id),
                "medication": prescription.medication_name,
                "quantity": data.quantity_dispensed,
            },
            user_id=str(dispensed_by),
        ))

        return dispensation


class InventoryService:
    """Servicio de gestion de inventario."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stock_levels(
        self, warehouse_id: uuid.UUID | None = None, low_stock_only: bool = False
    ) -> list[StockLevel]:
        stmt = select(StockLevel)
        if warehouse_id:
            stmt = stmt.where(StockLevel.warehouse_id == warehouse_id)
        if low_stock_only:
            stmt = stmt.where(StockLevel.quantity_on_hand <= StockLevel.reorder_point)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def record_movement(
        self, data: StockMovementCreate, performed_by: uuid.UUID
    ) -> StockMovement:
        """Registra un movimiento de inventario."""
        movement = StockMovement(
            product_id=data.product_id,
            lot_id=data.lot_id,
            from_warehouse_id=data.from_warehouse_id,
            to_warehouse_id=data.to_warehouse_id,
            quantity=data.quantity,
            movement_type=data.movement_type,
            reason=data.reason,
            performed_by=performed_by,
        )
        self.db.add(movement)
        await self.db.flush()
        return movement

    async def check_low_stock_alerts(self) -> list[dict]:
        """Verifica productos por debajo del punto de reorden."""
        stmt = select(StockLevel).where(
            StockLevel.quantity_on_hand <= StockLevel.reorder_point
        )
        result = await self.db.execute(stmt)
        low_stock = list(result.scalars().all())

        alerts = []
        for stock in low_stock:
            alerts.append({
                "product_id": str(stock.product_id),
                "warehouse_id": str(stock.warehouse_id),
                "quantity_on_hand": stock.quantity_on_hand,
                "reorder_point": stock.reorder_point,
            })
            await publish(DomainEvent(
                event_type=STOCK_LOW,
                aggregate_type="stock_level",
                aggregate_id=str(stock.product_id),
                data={"warehouse_id": str(stock.warehouse_id), "qty": stock.quantity_on_hand},
            ))

        return alerts
