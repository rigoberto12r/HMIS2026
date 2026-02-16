"""
Repositorios para el módulo de Laboratorio.
Capa de acceso a datos con queries optimizados.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.shared.utils import escape_like_pattern, parse_int_safe

from app.modules.laboratory.models import (
    LabCriticalValue,
    LabOrder,
    LabOrderTest,
    LabResult,
    LabSpecimen,
    LabTest,
)
from app.shared.repository import BaseRepository


class LabTestRepository(BaseRepository[LabTest]):
    """Repositorio para pruebas de laboratorio."""

    def __init__(self, db: AsyncSession):
        super().__init__(LabTest, db)

    async def find_by_category(
        self, category: str, *, include_inactive: bool = False
    ) -> Sequence[LabTest]:
        """
        Buscar pruebas por categoría.

        Args:
            category: Categoría de la prueba
            include_inactive: Si se incluyen pruebas inactivas

        Returns:
            Lista de pruebas en la categoría
        """
        filters = {"category": category}
        return await self.find_by(
            include_deleted=include_inactive,
            order_by=LabTest.name,
            **filters,
        )

    async def find_by_code(self, code: str) -> LabTest | None:
        """
        Buscar prueba por código único.

        Args:
            code: Código de la prueba

        Returns:
            Prueba o None si no existe
        """
        return await self.find_one_by(code=code)

    async def find_panels(self, *, include_inactive: bool = False) -> Sequence[LabTest]:
        """
        Buscar todas las pruebas que son paneles.

        Args:
            include_inactive: Si se incluyen paneles inactivos

        Returns:
            Lista de paneles
        """
        return await self.find_by(
            include_deleted=include_inactive,
            is_panel=True,
            order_by=LabTest.category,
        )

    async def search_by_name(
        self, search: str, *, limit: int = 50
    ) -> Sequence[LabTest]:
        """
        Búsqueda de pruebas por nombre (para autocompletado).

        Args:
            search: Término de búsqueda
            limit: Máximo de resultados

        Returns:
            Lista de pruebas que coinciden
        """
        safe_search = escape_like_pattern(search)
        stmt = (
            select(LabTest)
            .where(
                and_(
                    LabTest.is_active == True,
                    or_(
                        LabTest.name.ilike(f"%{safe_search}%", escape="\\"),
                        LabTest.code.ilike(f"%{safe_search}%", escape="\\"),
                    ),
                )
            )
            .order_by(LabTest.name)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()


class LabOrderRepository(BaseRepository[LabOrder]):
    """Repositorio para órdenes de laboratorio."""

    def __init__(self, db: AsyncSession):
        super().__init__(LabOrder, db)

    async def get_with_relations(self, order_id: uuid.UUID) -> LabOrder | None:
        """
        Obtener orden con todas sus relaciones cargadas.

        Args:
            order_id: ID de la orden

        Returns:
            Orden con tests, specimens y results, o None
        """
        stmt = (
            select(LabOrder)
            .where(LabOrder.id == order_id, LabOrder.is_active == True)
            .options(
                selectinload(LabOrder.order_tests).selectinload(LabOrderTest.test),
                selectinload(LabOrder.order_tests).selectinload(LabOrderTest.specimens),
                selectinload(LabOrder.order_tests).selectinload(LabOrderTest.results),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_patient(
        self,
        patient_id: uuid.UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[Sequence[LabOrder], int]:
        """
        Buscar órdenes de un paciente con paginación.

        Args:
            patient_id: ID del paciente
            limit: Número máximo de resultados
            offset: Número de resultados a saltar

        Returns:
            Tupla (órdenes, total)
        """
        # Query principal
        stmt = (
            select(LabOrder)
            .where(LabOrder.patient_id == patient_id, LabOrder.is_active == True)
            .order_by(LabOrder.ordered_at.desc())
            .offset(offset)
            .limit(limit)
            .options(selectinload(LabOrder.order_tests).selectinload(LabOrderTest.test))
        )
        result = await self.db.execute(stmt)
        orders = result.scalars().all()

        # Count total
        count_stmt = select(func.count()).select_from(
            select(LabOrder)
            .where(LabOrder.patient_id == patient_id, LabOrder.is_active == True)
            .subquery()
        )
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        return orders, total

    async def find_pending(self, *, limit: int = 100) -> Sequence[LabOrder]:
        """
        Buscar órdenes pendientes de completar.

        Args:
            limit: Máximo de resultados

        Returns:
            Lista de órdenes pendientes
        """
        stmt = (
            select(LabOrder)
            .where(
                LabOrder.is_active == True,
                LabOrder.status.in_(["pending", "collected", "in_progress"]),
            )
            .order_by(LabOrder.priority.desc(), LabOrder.ordered_at)
            .limit(limit)
            .options(selectinload(LabOrder.order_tests).selectinload(LabOrderTest.test))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_stat_orders(self, *, limit: int = 50) -> Sequence[LabOrder]:
        """
        Buscar órdenes STAT (urgentes) no completadas.

        Args:
            limit: Máximo de resultados

        Returns:
            Lista de órdenes STAT
        """
        stmt = (
            select(LabOrder)
            .where(
                LabOrder.is_active == True,
                LabOrder.priority == "stat",
                LabOrder.status != "completed",
            )
            .order_by(LabOrder.ordered_at)
            .limit(limit)
            .options(selectinload(LabOrder.order_tests).selectinload(LabOrderTest.test))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        *,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[Sequence[LabOrder], int]:
        """
        Buscar órdenes por rango de fechas con filtros opcionales.

        Args:
            start_date: Fecha inicial
            end_date: Fecha final
            status: Filtro por estado (opcional)
            priority: Filtro por prioridad (opcional)
            limit: Máximo de resultados
            offset: Número de resultados a saltar

        Returns:
            Tupla (órdenes, total)
        """
        conditions = [
            LabOrder.is_active == True,
            LabOrder.ordered_at >= start_date,
            LabOrder.ordered_at <= end_date,
        ]

        if status:
            conditions.append(LabOrder.status == status)
        if priority:
            conditions.append(LabOrder.priority == priority)

        # Query principal
        stmt = (
            select(LabOrder)
            .where(and_(*conditions))
            .order_by(LabOrder.ordered_at.desc())
            .offset(offset)
            .limit(limit)
            .options(selectinload(LabOrder.order_tests).selectinload(LabOrderTest.test))
        )
        result = await self.db.execute(stmt)
        orders = result.scalars().all()

        # Count total
        count_stmt = select(func.count()).select_from(
            select(LabOrder).where(and_(*conditions)).subquery()
        )
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        return orders, total

    async def count_completed_today(self) -> int:
        """
        Contar órdenes completadas hoy.

        Returns:
            Número de órdenes completadas
        """
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        stmt = select(func.count()).select_from(
            select(LabOrder)
            .where(
                LabOrder.is_active == True,
                LabOrder.status == "completed",
                LabOrder.updated_at >= today_start,
                LabOrder.updated_at < today_end,
            )
            .subquery()
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def get_next_order_number(self, prefix: str = "LAB") -> str:
        """
        Generar siguiente número de orden secuencial.

        Args:
            prefix: Prefijo del número (default: LAB)

        Returns:
            Número de orden (ej: LAB-2026-00001)
        """
        year = datetime.now(timezone.utc).year
        pattern = f"{prefix}-{year}-%"

        stmt = (
            select(LabOrder.order_number)
            .where(LabOrder.order_number.like(pattern))
            .order_by(LabOrder.order_number.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        last_number = result.scalar_one_or_none()

        if last_number:
            # Extract sequence number and increment
            seq = parse_int_safe(
                last_number.split("-")[-1],
                fallback=0,
                field_name="Lab order sequence"
            ) + 1
        else:
            seq = 1

        return f"{prefix}-{year}-{seq:05d}"


class LabResultRepository(BaseRepository[LabResult]):
    """Repositorio para resultados de laboratorio."""

    def __init__(self, db: AsyncSession):
        super().__init__(LabResult, db)

    async def find_by_order_test(
        self, order_test_id: uuid.UUID
    ) -> Sequence[LabResult]:
        """
        Buscar todos los resultados de una prueba ordenada.

        Args:
            order_test_id: ID de la prueba ordenada

        Returns:
            Lista de resultados
        """
        return await self.find_by(
            order_test_id=order_test_id,
            order_by=LabResult.component_code,
        )

    async def find_critical_pending(self, *, limit: int = 50) -> Sequence[LabResult]:
        """
        Buscar resultados críticos pendientes de notificación.

        Args:
            limit: Máximo de resultados

        Returns:
            Lista de resultados críticos sin notificar
        """
        # Subconsulta para resultados que NO tienen notificaciones
        notified_subq = (
            select(LabCriticalValue.result_id)
            .where(LabCriticalValue.is_active == True)
            .subquery()
        )

        stmt = (
            select(LabResult)
            .where(
                LabResult.is_active == True,
                LabResult.is_critical == True,
                LabResult.result_status.in_(["preliminary", "final"]),
                LabResult.id.not_in(select(notified_subq)),
            )
            .order_by(LabResult.result_at)
            .limit(limit)
            .options(selectinload(LabResult.order_test))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_pending_validation(self, *, limit: int = 100) -> Sequence[LabResult]:
        """
        Buscar resultados pendientes de validación.

        Args:
            limit: Máximo de resultados

        Returns:
            Lista de resultados preliminares
        """
        stmt = (
            select(LabResult)
            .where(
                LabResult.is_active == True,
                LabResult.result_status == "preliminary",
                LabResult.validated_at.is_(None),
            )
            .order_by(LabResult.result_at)
            .limit(limit)
            .options(selectinload(LabResult.order_test))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()


class LabSpecimenRepository(BaseRepository[LabSpecimen]):
    """Repositorio para especímenes de laboratorio."""

    def __init__(self, db: AsyncSession):
        super().__init__(LabSpecimen, db)

    async def find_by_barcode(self, barcode: str) -> LabSpecimen | None:
        """
        Buscar espécimen por código de barras.

        Args:
            barcode: Código de barras del espécimen

        Returns:
            Espécimen o None
        """
        return await self.find_one_by(barcode=barcode)

    async def find_in_transit(self, *, limit: int = 100) -> Sequence[LabSpecimen]:
        """
        Buscar especímenes en tránsito (recolectados pero no recibidos).

        Args:
            limit: Máximo de resultados

        Returns:
            Lista de especímenes en tránsito
        """
        stmt = (
            select(LabSpecimen)
            .where(
                LabSpecimen.is_active == True,
                LabSpecimen.status.in_(["collected", "in_transit"]),
                LabSpecimen.received_at.is_(None),
            )
            .order_by(LabSpecimen.collected_at)
            .limit(limit)
            .options(selectinload(LabSpecimen.order_test))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()


class LabCriticalValueRepository(BaseRepository[LabCriticalValue]):
    """Repositorio para notificaciones de valores críticos."""

    def __init__(self, db: AsyncSession):
        super().__init__(LabCriticalValue, db)

    async def find_unread(self, *, limit: int = 50) -> Sequence[LabCriticalValue]:
        """
        Buscar notificaciones críticas no leídas.

        Args:
            limit: Máximo de resultados

        Returns:
            Lista de notificaciones sin leer
        """
        stmt = (
            select(LabCriticalValue)
            .where(
                LabCriticalValue.is_active == True,
                LabCriticalValue.read_at.is_(None),
            )
            .order_by(LabCriticalValue.notified_at.desc())
            .limit(limit)
            .options(selectinload(LabCriticalValue.result))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
