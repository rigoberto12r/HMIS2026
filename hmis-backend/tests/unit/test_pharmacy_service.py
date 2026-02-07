"""
Tests unitarios para el modulo de Farmacia.
Cubre todos los servicios: ProductService, LotService, PrescriptionService,
DispensationService, InventoryService, WarehouseService, PurchaseOrderService
y ControlledSubstanceAuditService.

Usa la base de datos SQLite en memoria (fixture db_session) y mockea
la publicacion de eventos de dominio (Redis) para aislamiento.
"""

# ---------------------------------------------------------------------------
# Compatibilidad JSONB de PostgreSQL con SQLite para tests.
# Se debe registrar ANTES de que SQLAlchemy intente compilar DDL.
# ---------------------------------------------------------------------------
import sqlalchemy.dialects.sqlite.base as _sqlite_base  # noqa: E402

if not hasattr(_sqlite_base.SQLiteTypeCompiler, "visit_JSONB"):
    _sqlite_base.SQLiteTypeCompiler.visit_JSONB = (
        _sqlite_base.SQLiteTypeCompiler.visit_JSON
    )
# ---------------------------------------------------------------------------

import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pharmacy.service import (
    ControlledSubstanceAuditService,
    DispensationService,
    InventoryService,
    LotService,
    PrescriptionService,
    ProductService,
    PurchaseOrderService,
    WarehouseService,
)
from app.modules.pharmacy.schemas import (
    DispensationCreate,
    PrescriptionCreate,
    ProductLotCreate,
    PurchaseOrderCreate,
    StockMovementCreate,
)
from app.modules.pharmacy.models import (
    ControlledSubstanceLog,
    Prescription,
    Product,
    ProductLot,
    StockLevel,
    Warehouse,
)
from app.modules.emr.models import Allergy


# =============================================
# Fixture para mockear publish en el servicio de farmacia.
# La referencia local importada con 'from ... import publish'
# debe parchearse en el modulo que la consume.
# =============================================

@pytest.fixture(autouse=True)
def _mock_pharmacy_events():
    """Mockea la funcion publish dentro del modulo de servicio de farmacia."""
    with patch("app.modules.pharmacy.service.publish", new_callable=AsyncMock):
        yield


# =============================================
# Helpers asincronos para crear entidades base
# =============================================

async def _crear_producto(db: AsyncSession, **overrides) -> Product:
    """Crea un producto farmaceutico de prueba en la base de datos."""
    datos = {
        "name": "Amoxicilina 500mg",
        "generic_name": "Amoxicilina",
        "active_ingredient": "Amoxicilina trihidrato",
        "presentation": "tableta",
        "concentration": "500mg",
        "product_type": "medication",
        "controlled_substance_level": 0,
        "requires_prescription": True,
    }
    datos.update(overrides)
    svc = ProductService(db)
    return await svc.create_product(**datos)


async def _crear_almacen(db: AsyncSession, **overrides) -> Warehouse:
    """Crea un almacen de prueba en la base de datos."""
    datos = {
        "name": "Farmacia Central",
        "warehouse_type": "central",
        "location_description": "Edificio principal, planta baja",
    }
    datos.update(overrides)
    svc = WarehouseService(db)
    return await svc.create_warehouse(datos)


async def _crear_lote(
    db: AsyncSession,
    product_id: uuid.UUID,
    dias_hasta_vencimiento: int = 365,
    cantidad: int = 100,
    **overrides,
) -> ProductLot:
    """Crea un lote de producto con fecha de vencimiento configurable."""
    datos_lote = ProductLotCreate(
        product_id=product_id,
        lot_number=overrides.pop(
            "lot_number", f"LOT-{uuid.uuid4().hex[:8].upper()}"
        ),
        expiration_date=overrides.pop(
            "expiration_date",
            date.today() + timedelta(days=dias_hasta_vencimiento),
        ),
        quantity_received=cantidad,
        cost_per_unit=overrides.pop("cost_per_unit", 15.50),
        supplier_name=overrides.pop(
            "supplier_name", "Distribuidora Farmaceutica SRL"
        ),
    )
    svc = LotService(db)
    return await svc.receive_lot(datos_lote, received_by=uuid.uuid4())


async def _crear_prescripcion(
    db: AsyncSession,
    product_id: uuid.UUID,
    patient_id: uuid.UUID | None = None,
    **overrides,
):
    """Crea una prescripcion de prueba en la base de datos.

    Despues de crear, pre-carga la relacion 'dispensations' para evitar
    errores de lazy-loading (MissingGreenlet) en contexto async.
    """
    from sqlalchemy import select as sa_select
    from sqlalchemy.orm import selectinload

    pid = patient_id or uuid.uuid4()
    datos = PrescriptionCreate(
        encounter_id=overrides.pop("encounter_id", uuid.uuid4()),
        patient_id=pid,
        product_id=product_id,
        medication_name=overrides.pop("medication_name", "Amoxicilina 500mg"),
        dosage=overrides.pop("dosage", "500mg"),
        frequency=overrides.pop("frequency", "cada 8 horas"),
        route=overrides.pop("route", "oral"),
        duration_days=overrides.pop("duration_days", 7),
        quantity_prescribed=overrides.pop("quantity_prescribed", 21),
        instructions=overrides.pop("instructions", "Tomar con alimentos"),
        substitution_allowed=overrides.pop("substitution_allowed", True),
    )
    svc = PrescriptionService(db)
    rx = await svc.create_prescription(datos, prescribed_by=uuid.uuid4())

    # Pre-cargar dispensations en el identity map para evitar lazy-loading async
    stmt = (
        sa_select(Prescription)
        .options(selectinload(Prescription.dispensations))
        .where(Prescription.id == rx.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


async def _crear_stock_level(
    db: AsyncSession,
    product_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    quantity_on_hand: int = 100,
    reorder_point: int = 10,
    max_level: int = 500,
) -> StockLevel:
    """Crea un registro de nivel de stock directamente en la BD."""
    stock = StockLevel(
        product_id=product_id,
        warehouse_id=warehouse_id,
        quantity_on_hand=quantity_on_hand,
        reorder_point=reorder_point,
        max_level=max_level,
    )
    db.add(stock)
    await db.flush()
    return stock


# =============================================
# Tests de ProductService
# =============================================

class TestProductService:
    """Tests para el servicio de catalogo de productos farmaceuticos."""

    @pytest.mark.asyncio
    async def test_crear_producto_exitoso(self, db_session):
        """Verifica que se crea un producto con todos sus campos correctamente."""
        producto = await _crear_producto(
            db_session,
            name="Ibuprofeno 400mg",
            product_type="medication",
            controlled_substance_level=0,
        )

        assert producto is not None, "Debe crear el producto exitosamente"
        assert producto.id is not None, "Debe generar un UUID automaticamente"
        assert producto.name == "Ibuprofeno 400mg"
        assert producto.product_type == "medication"
        assert producto.is_active is True, "El producto debe estar activo por defecto"

    @pytest.mark.asyncio
    async def test_obtener_producto_por_id(self, db_session):
        """Verifica la obtencion de un producto existente por su UUID."""
        producto = await _crear_producto(db_session)

        svc = ProductService(db_session)
        encontrado = await svc.get_product(producto.id)

        assert encontrado is not None, "Debe encontrar el producto creado"
        assert encontrado.id == producto.id
        assert encontrado.name == producto.name

    @pytest.mark.asyncio
    async def test_obtener_producto_inexistente_retorna_none(self, db_session):
        """Verifica que un ID inexistente retorna None."""
        svc = ProductService(db_session)

        resultado = await svc.get_product(uuid.uuid4())

        assert resultado is None, "Un producto inexistente debe retornar None"

    @pytest.mark.asyncio
    async def test_buscar_productos_por_nombre(self, db_session):
        """Verifica la busqueda parcial de productos por nombre."""
        await _crear_producto(db_session, name="Amoxicilina 500mg")
        await _crear_producto(db_session, name="Amoxicilina 250mg")
        await _crear_producto(db_session, name="Ibuprofeno 400mg")

        svc = ProductService(db_session)
        productos, total = await svc.search_products(query="Amoxicilina")

        assert total == 2, "Debe encontrar exactamente 2 productos con Amoxicilina"
        assert len(productos) == 2

    @pytest.mark.asyncio
    async def test_buscar_productos_por_tipo(self, db_session):
        """Verifica el filtrado de productos por tipo (medication, supply, device)."""
        await _crear_producto(
            db_session, name="Jeringa 5ml", product_type="supply"
        )
        await _crear_producto(
            db_session, name="Paracetamol 500mg", product_type="medication"
        )

        svc = ProductService(db_session)
        productos, total = await svc.search_products(product_type="supply")

        assert total == 1, "Debe encontrar solo 1 insumo"
        assert productos[0].name == "Jeringa 5ml"

    @pytest.mark.asyncio
    async def test_actualizar_producto(self, db_session):
        """Verifica la actualizacion parcial de campos de un producto."""
        producto = await _crear_producto(db_session)
        svc = ProductService(db_session)
        usuario = uuid.uuid4()

        actualizado = await svc.update_product(
            producto.id,
            {"name": "Amoxicilina 750mg", "concentration": "750mg"},
            updated_by=usuario,
        )

        assert actualizado is not None
        assert actualizado.name == "Amoxicilina 750mg"
        assert actualizado.concentration == "750mg"
        assert actualizado.updated_by == usuario

    @pytest.mark.asyncio
    async def test_actualizar_producto_inexistente_retorna_none(self, db_session):
        """Verifica que actualizar un producto inexistente retorna None."""
        svc = ProductService(db_session)

        resultado = await svc.update_product(uuid.uuid4(), {"name": "No existe"})

        assert resultado is None


# =============================================
# Tests de LotService
# =============================================

class TestLotService:
    """Tests para el servicio de gestion de lotes con FEFO."""

    @pytest.mark.asyncio
    async def test_recibir_lote_exitoso(self, db_session):
        """Verifica la recepcion correcta de un lote con cantidad disponible igual a la recibida."""
        producto = await _crear_producto(db_session)
        lote = await _crear_lote(db_session, producto.id, cantidad=200)

        assert lote is not None
        assert lote.product_id == producto.id
        assert lote.quantity_received == 200
        assert lote.quantity_available == 200, (
            "La cantidad disponible debe igualar la recibida"
        )
        assert lote.status == "available"

    @pytest.mark.asyncio
    async def test_recibir_lote_sincroniza_stock_level(self, db_session):
        """Verifica que recibir un lote incrementa el nivel de stock existente."""
        producto = await _crear_producto(db_session)
        almacen = await _crear_almacen(db_session)

        # Crear nivel de stock inicial con 50 unidades
        stock = await _crear_stock_level(
            db_session, producto.id, almacen.id, quantity_on_hand=50
        )

        # Recibir lote de 100 unidades
        await _crear_lote(db_session, producto.id, cantidad=100)

        assert stock.quantity_on_hand == 150, (
            "El nivel de stock debe incrementarse con la cantidad del lote recibido"
        )

    @pytest.mark.asyncio
    async def test_obtener_lotes_disponibles_orden_fefo(self, db_session):
        """Verifica que los lotes se ordenan por FEFO (primero en vencer, primero en salir)."""
        producto = await _crear_producto(db_session)

        # Crear lotes con diferentes fechas de vencimiento (orden intencionalmente desordenado)
        await _crear_lote(
            db_session, producto.id,
            dias_hasta_vencimiento=365,
            lot_number="LOT-LEJANO",
        )
        await _crear_lote(
            db_session, producto.id,
            dias_hasta_vencimiento=30,
            lot_number="LOT-CERCANO",
        )
        await _crear_lote(
            db_session, producto.id,
            dias_hasta_vencimiento=180,
            lot_number="LOT-MEDIO",
        )

        svc = LotService(db_session)
        lotes = await svc.get_available_lots(producto.id)

        assert len(lotes) == 3, "Debe retornar los 3 lotes disponibles"
        assert lotes[0].lot_number == "LOT-CERCANO", (
            "El primer lote debe ser el que vence primero (FEFO)"
        )
        assert lotes[1].lot_number == "LOT-MEDIO"
        assert lotes[2].lot_number == "LOT-LEJANO"

    @pytest.mark.asyncio
    async def test_obtener_lotes_proximos_a_vencer(self, db_session):
        """Verifica la deteccion de lotes que vencen dentro del periodo especificado."""
        producto = await _crear_producto(db_session)

        # Lote que vence en 30 dias (dentro del umbral de 90)
        await _crear_lote(
            db_session, producto.id,
            dias_hasta_vencimiento=30,
            lot_number="LOT-PROXIMO",
        )
        # Lote que vence en 180 dias (fuera del umbral)
        await _crear_lote(
            db_session, producto.id,
            dias_hasta_vencimiento=180,
            lot_number="LOT-LEJANO",
        )

        svc = LotService(db_session)
        proximos = await svc.get_expiring_lots(days_ahead=90)

        assert len(proximos) == 1, "Solo 1 lote debe estar proximo a vencer"
        assert proximos[0].lot_number == "LOT-PROXIMO"


# =============================================
# Tests de PrescriptionService
# =============================================

class TestPrescriptionService:
    """Tests para el servicio de prescripcion electronica con validacion de alergias."""

    @pytest.mark.asyncio
    async def test_crear_prescripcion_exitosa(self, db_session):
        """Verifica la creacion de una prescripcion sin alertas de alergia."""
        producto = await _crear_producto(db_session)

        prescripcion = await _crear_prescripcion(db_session, producto.id)

        assert prescripcion is not None
        assert prescripcion.status == "active"
        assert prescripcion.product_id == producto.id
        assert prescripcion.medication_name == "Amoxicilina 500mg"
        assert prescripcion.alerts_json is None, (
            "No debe haber alertas si el paciente no tiene alergias registradas"
        )

    @pytest.mark.asyncio
    async def test_crear_prescripcion_con_alerta_alergia(self, db_session):
        """Verifica que se generan alertas cuando el paciente tiene alergia al medicamento.

        El servicio usa Allergy.allergen.ilike('%medication_name%'), por lo que
        el nombre del alergeno debe contener el nombre del medicamento buscado.
        """
        producto = await _crear_producto(
            db_session, name="Penicilina V 500mg",
            active_ingredient="Penicilina",
        )
        patient_id = uuid.uuid4()

        # Registrar alergia del paciente. El alergeno debe contener el nombre
        # que se usara en medication_name para que el ILIKE coincida.
        alergia = Allergy(
            patient_id=patient_id,
            allergen="Penicilina V",
            allergen_type="drug",
            reaction="Anafilaxia",
            severity="severe",
            status="active",
        )
        db_session.add(alergia)
        await db_session.flush()

        # Usar medication_name que sea substring del allergen registrado
        prescripcion = await _crear_prescripcion(
            db_session,
            producto.id,
            patient_id=patient_id,
            medication_name="Penicilina V",
        )

        assert prescripcion.alerts_json is not None, (
            "Debe generar alertas de alergia"
        )
        assert "allergy_warning" in prescripcion.alerts_json
        alertas = prescripcion.alerts_json["allergy_warning"]
        assert len(alertas) >= 1
        assert alertas[0]["allergen"] == "Penicilina V"
        assert alertas[0]["severity"] == "severe"

    @pytest.mark.asyncio
    async def test_obtener_prescripcion_por_id(self, db_session):
        """Verifica la obtencion de una prescripcion existente con sus dispensaciones cargadas."""
        producto = await _crear_producto(db_session)
        prescripcion = await _crear_prescripcion(db_session, producto.id)

        svc = PrescriptionService(db_session)
        encontrada = await svc.get_prescription(prescripcion.id)

        assert encontrada is not None
        assert encontrada.id == prescripcion.id

    @pytest.mark.asyncio
    async def test_obtener_prescripciones_por_paciente_con_filtro(self, db_session):
        """Verifica el listado de prescripciones filtrado por paciente y estado."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()

        # Crear 2 prescripciones activas
        rx1 = await _crear_prescripcion(
            db_session, producto.id, patient_id=patient_id
        )
        rx2 = await _crear_prescripcion(
            db_session, producto.id, patient_id=patient_id
        )

        # Cancelar la segunda
        svc = PrescriptionService(db_session)
        await svc.cancel_prescription(rx2.id, "Cambio de tratamiento")

        activas = await svc.get_patient_prescriptions(patient_id, status="active")

        assert len(activas) == 1, "Debe retornar solo la prescripcion activa"
        assert activas[0].id == rx1.id

    @pytest.mark.asyncio
    async def test_cancelar_prescripcion_activa(self, db_session):
        """Verifica la cancelacion exitosa de una prescripcion activa."""
        producto = await _crear_producto(db_session)
        prescripcion = await _crear_prescripcion(db_session, producto.id)

        svc = PrescriptionService(db_session)
        cancelada = await svc.cancel_prescription(
            prescripcion.id, "Reaccion adversa", cancelled_by=uuid.uuid4()
        )

        assert cancelada is not None
        assert cancelada.status == "cancelled"

    @pytest.mark.asyncio
    async def test_cancelar_prescripcion_ya_cancelada_lanza_error(self, db_session):
        """Verifica que no se puede cancelar una prescripcion que ya fue cancelada."""
        producto = await _crear_producto(db_session)
        prescripcion = await _crear_prescripcion(db_session, producto.id)

        svc = PrescriptionService(db_session)
        await svc.cancel_prescription(prescripcion.id, "Primera cancelacion")

        with pytest.raises(ValueError, match="Solo se pueden cancelar"):
            await svc.cancel_prescription(prescripcion.id, "Segunda cancelacion")

    @pytest.mark.asyncio
    async def test_cancelar_prescripcion_inexistente_retorna_none(self, db_session):
        """Verifica que cancelar una prescripcion inexistente retorna None."""
        svc = PrescriptionService(db_session)

        resultado = await svc.cancel_prescription(uuid.uuid4(), "No existe")

        assert resultado is None


# =============================================
# Tests de DispensationService
# =============================================

class TestDispensationService:
    """Tests para el servicio de dispensacion de medicamentos con trazabilidad."""

    @pytest.mark.asyncio
    async def test_dispensar_medicamento_exitoso(self, db_session):
        """Verifica la dispensacion completa: descuenta lote y actualiza prescripcion."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=100)
        prescripcion = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id, quantity_prescribed=10,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=10,
            patient_verified=True,
            notes="Verificado con cedula",
        )
        svc = DispensationService(db_session)
        dispensacion = await svc.dispense(datos, dispensed_by=uuid.uuid4())

        assert dispensacion is not None
        assert dispensacion.quantity_dispensed == 10
        assert dispensacion.patient_verified is True
        assert lote.quantity_available == 90, (
            "La cantidad disponible del lote debe decrementarse"
        )

    @pytest.mark.asyncio
    async def test_dispensar_actualiza_stock_level(self, db_session):
        """Verifica que la dispensacion sincroniza el nivel de stock global."""
        producto = await _crear_producto(db_session)
        almacen = await _crear_almacen(db_session)
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=100)
        stock = await _crear_stock_level(
            db_session, producto.id, almacen.id, quantity_on_hand=100,
        )
        prescripcion = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id, quantity_prescribed=20,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=20,
            patient_verified=True,
        )
        svc = DispensationService(db_session)
        await svc.dispense(datos, dispensed_by=uuid.uuid4())

        assert stock.quantity_on_hand == 80, (
            "El stock on-hand debe reducirse en la cantidad dispensada"
        )

    @pytest.mark.asyncio
    async def test_dispensar_paciente_no_coincide_lanza_error(self, db_session):
        """Verifica que no se puede dispensar si el paciente no coincide con la prescripcion."""
        producto = await _crear_producto(db_session)
        patient_real = uuid.uuid4()
        patient_falso = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=100)
        prescripcion = await _crear_prescripcion(
            db_session, producto.id, patient_id=patient_real,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_falso,
            quantity_dispensed=5,
            patient_verified=True,
        )
        svc = DispensationService(db_session)

        with pytest.raises(ValueError, match="paciente no coincide"):
            await svc.dispense(datos, dispensed_by=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_dispensar_lote_cantidad_insuficiente_lanza_error(self, db_session):
        """Verifica que no se puede dispensar mas de lo disponible en el lote."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=5)
        prescripcion = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id, quantity_prescribed=50,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=10,
            patient_verified=True,
        )
        svc = DispensationService(db_session)

        with pytest.raises(ValueError, match="cantidad insuficiente"):
            await svc.dispense(datos, dispensed_by=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_dispensar_lote_vencido_lanza_error(self, db_session):
        """Verifica que no se puede dispensar de un lote con fecha de vencimiento pasada."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()

        # Crear lote ya vencido (vencio ayer)
        lote_datos = ProductLotCreate(
            product_id=producto.id,
            lot_number="LOT-VENCIDO",
            expiration_date=date.today() - timedelta(days=1),
            quantity_received=100,
            cost_per_unit=10.0,
            supplier_name="Proveedor Test",
        )
        svc_lot = LotService(db_session)
        lote = await svc_lot.receive_lot(lote_datos)

        prescripcion = await _crear_prescripcion(
            db_session, producto.id, patient_id=patient_id,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=5,
            patient_verified=True,
        )
        svc = DispensationService(db_session)

        with pytest.raises(ValueError, match="lote vencido"):
            await svc.dispense(datos, dispensed_by=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_dispensar_prescripcion_cancelada_lanza_error(self, db_session):
        """Verifica que no se puede dispensar una prescripcion que fue cancelada."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=100)
        prescripcion = await _crear_prescripcion(
            db_session, producto.id, patient_id=patient_id,
        )

        # Cancelar la prescripcion antes de intentar dispensar
        svc_rx = PrescriptionService(db_session)
        await svc_rx.cancel_prescription(prescripcion.id, "Cambio de tratamiento")

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=5,
            patient_verified=True,
        )
        svc = DispensationService(db_session)

        with pytest.raises(ValueError, match="no valida"):
            await svc.dispense(datos, dispensed_by=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_obtener_dispensacion_por_id(self, db_session):
        """Verifica la obtencion de una dispensacion existente por su UUID."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=100)
        prescripcion = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id, quantity_prescribed=10,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=10,
            patient_verified=True,
        )
        svc = DispensationService(db_session)
        dispensacion = await svc.dispense(datos, dispensed_by=uuid.uuid4())

        encontrada = await svc.get_dispensation(dispensacion.id)

        assert encontrada is not None
        assert encontrada.id == dispensacion.id

    @pytest.mark.asyncio
    async def test_obtener_dispensaciones_paciente(self, db_session):
        """Verifica el historial de dispensaciones de un paciente con multiples registros."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=200)
        rx1 = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id, quantity_prescribed=10,
        )
        rx2 = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id, quantity_prescribed=10,
        )

        svc = DispensationService(db_session)
        await svc.dispense(
            DispensationCreate(
                prescription_id=rx1.id,
                product_lot_id=lote.id,
                patient_id=patient_id,
                quantity_dispensed=10,
                patient_verified=True,
            ),
            dispensed_by=uuid.uuid4(),
        )
        await svc.dispense(
            DispensationCreate(
                prescription_id=rx2.id,
                product_lot_id=lote.id,
                patient_id=patient_id,
                quantity_dispensed=10,
                patient_verified=True,
            ),
            dispensed_by=uuid.uuid4(),
        )

        historial = await svc.get_patient_dispensations(patient_id)

        assert len(historial) == 2, (
            "Debe retornar las 2 dispensaciones del paciente"
        )

    @pytest.mark.asyncio
    async def test_dispensar_lote_agotado_cambia_status_a_depleted(self, db_session):
        """Verifica que un lote cuya cantidad llega a 0 cambia su estado a 'depleted'."""
        producto = await _crear_producto(db_session)
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=10)
        prescripcion = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id, quantity_prescribed=10,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=10,
            patient_verified=True,
        )
        svc = DispensationService(db_session)
        await svc.dispense(datos, dispensed_by=uuid.uuid4())

        assert lote.quantity_available == 0
        assert lote.status == "depleted", (
            "Un lote sin unidades disponibles debe marcarse como agotado"
        )


# =============================================
# Tests de InventoryService
# =============================================

class TestInventoryService:
    """Tests para el servicio de gestion de inventario y alertas."""

    @pytest.mark.asyncio
    async def test_obtener_niveles_stock_por_almacen(self, db_session):
        """Verifica la consulta de niveles de stock filtrada por almacen."""
        producto = await _crear_producto(db_session)
        almacen = await _crear_almacen(db_session)
        await _crear_stock_level(
            db_session, producto.id, almacen.id, quantity_on_hand=75,
        )

        svc = InventoryService(db_session)
        niveles = await svc.get_stock_levels(warehouse_id=almacen.id)

        assert len(niveles) == 1
        assert niveles[0].quantity_on_hand == 75

    @pytest.mark.asyncio
    async def test_obtener_stock_bajo_solamente(self, db_session):
        """Verifica el filtro de productos con stock por debajo del punto de reorden."""
        producto_bajo = await _crear_producto(db_session, name="Producto Bajo")
        producto_ok = await _crear_producto(db_session, name="Producto OK")
        almacen = await _crear_almacen(db_session)

        # Stock bajo: 5 unidades con reorder_point de 10
        await _crear_stock_level(
            db_session, producto_bajo.id, almacen.id,
            quantity_on_hand=5, reorder_point=10,
        )
        # Stock normal: 50 unidades con reorder_point de 10
        await _crear_stock_level(
            db_session, producto_ok.id, almacen.id,
            quantity_on_hand=50, reorder_point=10,
        )

        svc = InventoryService(db_session)
        bajos = await svc.get_stock_levels(low_stock_only=True)

        assert len(bajos) == 1, "Solo 1 producto debe tener stock bajo"
        assert bajos[0].product_id == producto_bajo.id

    @pytest.mark.asyncio
    async def test_registrar_movimiento_inventario(self, db_session):
        """Verifica el registro de un movimiento de transferencia entre almacenes."""
        producto = await _crear_producto(db_session)
        almacen_origen = await _crear_almacen(db_session, name="Origen")
        almacen_destino = await _crear_almacen(db_session, name="Destino")

        datos = StockMovementCreate(
            product_id=producto.id,
            from_warehouse_id=almacen_origen.id,
            to_warehouse_id=almacen_destino.id,
            quantity=25,
            movement_type="transfer",
            reason="Transferencia por demanda en piso 3",
        )
        svc = InventoryService(db_session)
        movimiento = await svc.record_movement(datos, performed_by=uuid.uuid4())

        assert movimiento is not None
        assert movimiento.quantity == 25
        assert movimiento.movement_type == "transfer"
        assert movimiento.from_warehouse_id == almacen_origen.id
        assert movimiento.to_warehouse_id == almacen_destino.id

    @pytest.mark.asyncio
    async def test_verificar_alertas_stock_bajo(self, db_session):
        """Verifica la deteccion de productos con stock bajo y emision de alertas."""
        producto = await _crear_producto(db_session)
        almacen = await _crear_almacen(db_session)

        await _crear_stock_level(
            db_session, producto.id, almacen.id,
            quantity_on_hand=3, reorder_point=10,
        )

        svc = InventoryService(db_session)
        alertas = await svc.check_low_stock_alerts()

        assert len(alertas) >= 1, "Debe generar al menos 1 alerta de stock bajo"
        alerta_stock = [
            a for a in alertas if a.get("product_id") == str(producto.id)
        ]
        assert len(alerta_stock) == 1
        assert alerta_stock[0]["quantity_on_hand"] == 3

    @pytest.mark.asyncio
    async def test_detectar_lotes_vencidos_y_marcarlos(self, db_session):
        """Verifica que check_low_stock_alerts detecta lotes vencidos y cambia su estado."""
        producto = await _crear_producto(db_session)

        # Crear lote ya vencido directamente (con status=available)
        lote_vencido = ProductLot(
            product_id=producto.id,
            lot_number="LOT-EXPIRADO",
            expiration_date=date.today() - timedelta(days=5),
            quantity_received=50,
            quantity_available=30,
            cost_per_unit=10.0,
            status="available",
        )
        db_session.add(lote_vencido)
        await db_session.flush()

        svc = InventoryService(db_session)
        alertas = await svc.check_low_stock_alerts()

        alertas_exp = [a for a in alertas if a.get("type") == "expired"]
        assert len(alertas_exp) >= 1, "Debe detectar al menos 1 lote vencido"
        assert alertas_exp[0]["lot_number"] == "LOT-EXPIRADO"
        assert lote_vencido.status == "expired", (
            "El estado del lote debe cambiar a 'expired'"
        )


# =============================================
# Tests de WarehouseService
# =============================================

class TestWarehouseService:
    """Tests para el servicio de gestion de almacenes y puntos de dispensacion."""

    @pytest.mark.asyncio
    async def test_crear_almacen_exitoso(self, db_session):
        """Verifica la creacion de un almacen con sus atributos correctos."""
        almacen = await _crear_almacen(
            db_session,
            name="Farmacia Emergencias",
            warehouse_type="emergency_cart",
        )

        assert almacen is not None
        assert almacen.name == "Farmacia Emergencias"
        assert almacen.warehouse_type == "emergency_cart"
        assert almacen.is_active is True

    @pytest.mark.asyncio
    async def test_obtener_almacen_por_id(self, db_session):
        """Verifica la obtencion de un almacen existente por su UUID."""
        almacen = await _crear_almacen(db_session)

        svc = WarehouseService(db_session)
        encontrado = await svc.get_warehouse(almacen.id)

        assert encontrado is not None
        assert encontrado.id == almacen.id
        assert encontrado.name == "Farmacia Central"

    @pytest.mark.asyncio
    async def test_listar_almacenes_por_tipo(self, db_session):
        """Verifica el listado de almacenes filtrado por tipo."""
        await _crear_almacen(
            db_session, name="Central 1", warehouse_type="central",
        )
        await _crear_almacen(
            db_session, name="Satelite 1", warehouse_type="satellite",
        )
        await _crear_almacen(
            db_session, name="Central 2", warehouse_type="central",
        )

        svc = WarehouseService(db_session)
        centrales = await svc.list_warehouses(warehouse_type="central")

        assert len(centrales) == 2, "Debe listar solo los almacenes centrales"

    @pytest.mark.asyncio
    async def test_obtener_almacen_inexistente_retorna_none(self, db_session):
        """Verifica que buscar un almacen inexistente retorna None."""
        svc = WarehouseService(db_session)

        resultado = await svc.get_warehouse(uuid.uuid4())

        assert resultado is None


# =============================================
# Tests de PurchaseOrderService
# =============================================

class TestPurchaseOrderService:
    """Tests para el servicio de ordenes de compra a proveedores."""

    @pytest.mark.asyncio
    async def test_crear_orden_compra_calcula_total(self, db_session):
        """Verifica que el total se calcula automaticamente a partir de los items."""
        almacen = await _crear_almacen(db_session)

        datos = PurchaseOrderCreate(
            supplier_name="Laboratorios Rowe",
            supplier_code="ROWE-001",
            warehouse_id=almacen.id,
            expected_delivery=date.today() + timedelta(days=15),
            items_json=[
                {"product_name": "Amoxicilina 500mg", "quantity": 100, "unit_cost": 15.50},
                {"product_name": "Ibuprofeno 400mg", "quantity": 200, "unit_cost": 8.75},
            ],
            notes="Orden urgente para farmacia central",
        )
        svc = PurchaseOrderService(db_session)
        orden = await svc.create_order(datos, created_by=uuid.uuid4())

        # 100 * 15.50 + 200 * 8.75 = 1550 + 1750 = 3300
        total_esperado = 3300.0

        assert orden is not None
        assert orden.status == "draft", (
            "La orden debe iniciar en estado borrador"
        )
        assert float(orden.total_amount) == total_esperado, (
            f"El total calculado debe ser {total_esperado}"
        )

    @pytest.mark.asyncio
    async def test_obtener_orden_por_id(self, db_session):
        """Verifica la obtencion de una orden de compra existente."""
        almacen = await _crear_almacen(db_session)
        datos = PurchaseOrderCreate(
            supplier_name="Proveedor Test",
            warehouse_id=almacen.id,
            items_json=[],
        )
        svc = PurchaseOrderService(db_session)
        orden = await svc.create_order(datos)

        encontrada = await svc.get_order(orden.id)

        assert encontrada is not None
        assert encontrada.id == orden.id

    @pytest.mark.asyncio
    async def test_listar_ordenes_con_filtro_estado(self, db_session):
        """Verifica el listado de ordenes filtrado por estado."""
        almacen = await _crear_almacen(db_session)
        svc = PurchaseOrderService(db_session)

        # Crear orden borrador
        await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Proveedor A",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )
        # Crear orden y aprobarla
        orden2 = await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Proveedor B",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )
        await svc.update_status(orden2.id, "approved", updated_by=uuid.uuid4())

        borradores = await svc.list_orders(status_filter="draft")

        assert len(borradores) == 1, "Debe haber solo 1 orden en borrador"

    @pytest.mark.asyncio
    async def test_transicion_estado_valida_draft_a_approved(self, db_session):
        """Verifica la transicion de borrador a aprobada y que se registra la fecha."""
        almacen = await _crear_almacen(db_session)
        svc = PurchaseOrderService(db_session)
        orden = await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Test",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )
        aprobador = uuid.uuid4()

        actualizada = await svc.update_status(
            orden.id, "approved",
            notes="Aprobada por gerencia",
            updated_by=aprobador,
        )

        assert actualizada is not None
        assert actualizada.status == "approved"
        assert actualizada.approved_by == aprobador
        assert actualizada.order_date == date.today(), (
            "La fecha de orden debe establecerse al aprobar"
        )

    @pytest.mark.asyncio
    async def test_transicion_estado_valida_approved_a_ordered(self, db_session):
        """Verifica la transicion de aprobada a ordenada (enviada al proveedor)."""
        almacen = await _crear_almacen(db_session)
        svc = PurchaseOrderService(db_session)
        orden = await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Test",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )
        await svc.update_status(orden.id, "approved", updated_by=uuid.uuid4())

        actualizada = await svc.update_status(orden.id, "ordered")

        assert actualizada.status == "ordered"

    @pytest.mark.asyncio
    async def test_transicion_estado_invalida_lanza_error(self, db_session):
        """Verifica que una transicion no permitida (draft -> received) lanza ValueError."""
        almacen = await _crear_almacen(db_session)
        svc = PurchaseOrderService(db_session)
        orden = await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Test",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )

        with pytest.raises(ValueError, match="no permitida"):
            await svc.update_status(orden.id, "received")

    @pytest.mark.asyncio
    async def test_transicion_desde_estado_terminal_lanza_error(self, db_session):
        """Verifica que no se puede transicionar desde estado received (terminal)."""
        almacen = await _crear_almacen(db_session)
        svc = PurchaseOrderService(db_session)
        orden = await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Test",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )

        # Llevar a received: draft -> approved -> ordered -> received
        await svc.update_status(orden.id, "approved", updated_by=uuid.uuid4())
        await svc.update_status(orden.id, "ordered")
        await svc.update_status(orden.id, "received")

        with pytest.raises(ValueError, match="no permitida"):
            await svc.update_status(orden.id, "approved")

    @pytest.mark.asyncio
    async def test_listar_ordenes_por_almacen(self, db_session):
        """Verifica el filtrado de ordenes por almacen destino."""
        almacen_a = await _crear_almacen(db_session, name="Almacen A")
        almacen_b = await _crear_almacen(db_session, name="Almacen B")
        svc = PurchaseOrderService(db_session)

        await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Proveedor",
                warehouse_id=almacen_a.id,
                items_json=[],
            )
        )
        await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Proveedor",
                warehouse_id=almacen_b.id,
                items_json=[],
            )
        )
        await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Proveedor",
                warehouse_id=almacen_a.id,
                items_json=[],
            )
        )

        ordenes_a = await svc.list_orders(warehouse_id=almacen_a.id)

        assert len(ordenes_a) == 2, "Debe listar solo las ordenes del almacen A"

    @pytest.mark.asyncio
    async def test_cancelar_orden_desde_cualquier_estado_activo(self, db_session):
        """Verifica que se puede cancelar una orden desde draft, approved u ordered."""
        almacen = await _crear_almacen(db_session)
        svc = PurchaseOrderService(db_session)

        # Cancelar desde draft
        orden_draft = await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Test",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )
        cancelada = await svc.update_status(orden_draft.id, "cancelled")
        assert cancelada.status == "cancelled"

        # Cancelar desde approved
        orden_aprobada = await svc.create_order(
            PurchaseOrderCreate(
                supplier_name="Test",
                warehouse_id=almacen.id,
                items_json=[],
            )
        )
        await svc.update_status(
            orden_aprobada.id, "approved", updated_by=uuid.uuid4()
        )
        cancelada2 = await svc.update_status(orden_aprobada.id, "cancelled")
        assert cancelada2.status == "cancelled"


# =============================================
# Tests de ControlledSubstanceAuditService
# =============================================

class TestControlledSubstanceAuditService:
    """Tests para el servicio de auditoria de sustancias controladas."""

    @pytest.mark.asyncio
    async def test_obtener_registro_sustancia_controlada(self, db_session):
        """Verifica la consulta del registro de movimientos de una sustancia controlada."""
        producto = await _crear_producto(
            db_session,
            name="Morfina 10mg",
            controlled_substance_level=2,
        )

        # Crear registros de auditoria manualmente
        for action, qty, balance in [
            ("receive", 100, 100),
            ("dispense", 10, 90),
            ("dispense", 5, 85),
        ]:
            log = ControlledSubstanceLog(
                product_id=producto.id,
                action=action,
                quantity=qty,
                balance_after=balance,
                performed_by=uuid.uuid4(),
            )
            db_session.add(log)
        await db_session.flush()

        svc = ControlledSubstanceAuditService(db_session)
        registros = await svc.get_product_log(producto.id)

        assert len(registros) == 3, "Debe retornar los 3 registros de auditoria"

    @pytest.mark.asyncio
    async def test_obtener_balance_sustancia_controlada(self, db_session):
        """Verifica que se obtiene el balance actual (balance_after del ultimo registro)."""
        producto = await _crear_producto(
            db_session,
            name="Fentanilo 50mcg",
            controlled_substance_level=3,
        )

        log = ControlledSubstanceLog(
            product_id=producto.id,
            action="receive",
            quantity=200,
            balance_after=200,
            performed_by=uuid.uuid4(),
        )
        db_session.add(log)
        await db_session.flush()

        svc = ControlledSubstanceAuditService(db_session)
        balance = await svc.get_balance(producto.id)

        assert balance == 200, "El balance debe ser el del ultimo registro"

    @pytest.mark.asyncio
    async def test_obtener_balance_sin_registros_retorna_cero(self, db_session):
        """Verifica que un producto sin registros de auditoria retorna balance cero."""
        svc = ControlledSubstanceAuditService(db_session)

        balance = await svc.get_balance(uuid.uuid4())

        assert balance == 0, "Sin registros, el balance debe ser 0"

    @pytest.mark.asyncio
    async def test_dispensar_sustancia_controlada_genera_log(self, db_session):
        """Verifica que dispensar una sustancia controlada crea un registro de auditoria automatico."""
        producto = await _crear_producto(
            db_session,
            name="Tramadol 50mg",
            controlled_substance_level=4,
        )
        patient_id = uuid.uuid4()
        lote = await _crear_lote(db_session, producto.id, cantidad=100)
        prescripcion = await _crear_prescripcion(
            db_session, producto.id,
            patient_id=patient_id,
            medication_name="Tramadol 50mg",
            quantity_prescribed=10,
        )

        datos = DispensationCreate(
            prescription_id=prescripcion.id,
            product_lot_id=lote.id,
            patient_id=patient_id,
            quantity_dispensed=10,
            patient_verified=True,
        )
        svc_disp = DispensationService(db_session)
        await svc_disp.dispense(datos, dispensed_by=uuid.uuid4())

        # Verificar que se creo un registro en el log de sustancias controladas
        svc_audit = ControlledSubstanceAuditService(db_session)
        registros = await svc_audit.get_product_log(producto.id)

        assert len(registros) >= 1, (
            "Dispensar una sustancia controlada debe generar un registro de auditoria"
        )
        assert registros[0].action == "dispense"
        assert registros[0].quantity == 10
        assert registros[0].patient_id == patient_id
