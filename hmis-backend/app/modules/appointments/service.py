"""
Servicio de gestion de citas y agendamiento.
Logica de negocio: disponibilidad, reservas, check-in, lista de espera.
"""

import uuid
from datetime import datetime, date, time, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.appointments.models import (
    Appointment,
    Provider,
    ScheduleBlock,
    ScheduleTemplate,
    WaitingList,
)
from app.modules.appointments.schemas import (
    AppointmentCreate,
    AppointmentReschedule,
    AppointmentStatusUpdate,
    AvailableSlot,
    ScheduleTemplateCreate,
)
from app.shared.events import (
    APPOINTMENT_CANCELLED,
    APPOINTMENT_COMPLETED,
    APPOINTMENT_CONFIRMED,
    APPOINTMENT_CREATED,
    APPOINTMENT_NO_SHOW,
    DomainEvent,
    publish,
)


class ProviderService:
    """Servicio de gestion de proveedores."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_provider(self, **kwargs) -> Provider:
        provider = Provider(**kwargs)
        self.db.add(provider)
        await self.db.flush()
        return provider

    async def get_provider(self, provider_id: uuid.UUID) -> Provider | None:
        stmt = (
            select(Provider)
            .where(Provider.id == provider_id, Provider.is_active == True)
            .options(selectinload(Provider.schedule_templates))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_providers(
        self, specialty: str | None = None, offset: int = 0, limit: int = 20
    ) -> tuple[list[Provider], int]:
        stmt = select(Provider).where(Provider.is_active == True)
        count_stmt = select(func.count()).select_from(Provider).where(Provider.is_active == True)

        if specialty:
            stmt = stmt.where(Provider.specialty_code == specialty)
            count_stmt = count_stmt.where(Provider.specialty_code == specialty)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(Provider.last_name)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total


class ScheduleService:
    """Servicio de gestion de horarios y disponibilidad."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_template(self, data: ScheduleTemplateCreate) -> ScheduleTemplate:
        template = ScheduleTemplate(**data.model_dump())
        self.db.add(template)
        await self.db.flush()
        return template

    async def get_available_slots(
        self,
        provider_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> list[AvailableSlot]:
        """
        Calcula slots disponibles para un proveedor en un rango de fechas.
        Considera: templates de horario - bloqueos - citas existentes.
        """
        # 1. Obtener templates del proveedor
        stmt = select(ScheduleTemplate).where(
            ScheduleTemplate.provider_id == provider_id,
            ScheduleTemplate.is_active == True,
        )
        result = await self.db.execute(stmt)
        templates = list(result.scalars().all())

        if not templates:
            return []

        # 2. Obtener bloqueos en el rango
        stmt = select(ScheduleBlock).where(
            ScheduleBlock.provider_id == provider_id,
            ScheduleBlock.start_datetime < datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc),
            ScheduleBlock.end_datetime > datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc),
        )
        result = await self.db.execute(stmt)
        blocks = list(result.scalars().all())

        # 3. Obtener citas existentes en el rango
        stmt = select(Appointment).where(
            Appointment.provider_id == provider_id,
            Appointment.scheduled_start >= datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc),
            Appointment.scheduled_start <= datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc),
            Appointment.status.not_in(["cancelled", "no_show"]),
        )
        result = await self.db.execute(stmt)
        existing_appointments = list(result.scalars().all())

        # 4. Generar slots dia por dia
        available_slots = []
        current_date = start_date

        while current_date <= end_date:
            day_of_week = current_date.weekday()

            for template in templates:
                if template.day_of_week != day_of_week:
                    continue

                # Generar slots para esta plantilla
                slot_start = datetime.combine(current_date, template.start_time).replace(tzinfo=timezone.utc)
                slot_end_limit = datetime.combine(current_date, template.end_time).replace(tzinfo=timezone.utc)
                slot_duration = timedelta(minutes=template.slot_duration_min)

                while slot_start + slot_duration <= slot_end_limit:
                    slot_end = slot_start + slot_duration

                    # Verificar si esta bloqueado
                    is_blocked = any(
                        block.start_datetime <= slot_start and block.end_datetime >= slot_end
                        for block in blocks
                    )

                    if not is_blocked:
                        # Contar citas existentes en este slot
                        existing_count = sum(
                            1
                            for apt in existing_appointments
                            if apt.scheduled_start == slot_start
                        )
                        available_count = 1 + template.max_overbooking - existing_count

                        if available_count > 0:
                            available_slots.append(
                                AvailableSlot(
                                    start=slot_start,
                                    end=slot_end,
                                    provider_id=provider_id,
                                    location_id=template.location_id,
                                    available_spots=available_count,
                                )
                            )

                    slot_start = slot_end

            current_date += timedelta(days=1)

        return available_slots


class AppointmentService:
    """Servicio de gestion de citas."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_appointment(
        self, data: AppointmentCreate, created_by: uuid.UUID | None = None
    ) -> Appointment:
        """
        Crea una nueva cita validando disponibilidad.
        """
        # Verificar que no haya conflicto
        conflict = await self._check_conflict(
            data.provider_id, data.scheduled_start, data.scheduled_end
        )
        if conflict:
            raise ValueError("El horario seleccionado ya no esta disponible")

        appointment = Appointment(
            **data.model_dump(),
            created_by=created_by,
        )
        self.db.add(appointment)
        await self.db.flush()

        await publish(DomainEvent(
            event_type=APPOINTMENT_CREATED,
            aggregate_type="appointment",
            aggregate_id=str(appointment.id),
            data={
                "patient_id": str(data.patient_id),
                "provider_id": str(data.provider_id),
                "scheduled_start": data.scheduled_start.isoformat(),
            },
            user_id=str(created_by) if created_by else None,
        ))

        return appointment

    async def update_status(
        self,
        appointment_id: uuid.UUID,
        data: AppointmentStatusUpdate,
        updated_by: uuid.UUID | None = None,
    ) -> Appointment | None:
        """Actualiza el estado de una cita con logica de transiciones."""
        appointment = await self.get_appointment(appointment_id)
        if not appointment:
            return None

        # Validar transiciones de estado
        valid_transitions = {
            "scheduled": ["confirmed", "cancelled", "no_show"],
            "confirmed": ["arrived", "cancelled", "no_show"],
            "arrived": ["in_progress", "cancelled"],
            "in_progress": ["completed"],
        }

        allowed = valid_transitions.get(appointment.status, [])
        if data.status not in allowed:
            raise ValueError(
                f"No se puede cambiar de '{appointment.status}' a '{data.status}'. "
                f"Transiciones validas: {', '.join(allowed)}"
            )

        appointment.status = data.status
        appointment.updated_by = updated_by

        # Acciones segun el nuevo estado
        now = datetime.now(timezone.utc)
        if data.status == "arrived":
            appointment.check_in_time = now
        elif data.status == "in_progress":
            appointment.start_time = now
        elif data.status == "completed":
            appointment.end_time = now
        elif data.status == "cancelled":
            appointment.cancellation_reason = data.cancellation_reason
        elif data.status == "confirmed":
            appointment.confirmed_at = now

        await self.db.flush()

        # Publicar evento correspondiente
        event_map = {
            "confirmed": APPOINTMENT_CONFIRMED,
            "completed": APPOINTMENT_COMPLETED,
            "cancelled": APPOINTMENT_CANCELLED,
            "no_show": APPOINTMENT_NO_SHOW,
        }
        event_type = event_map.get(data.status)
        if event_type:
            await publish(DomainEvent(
                event_type=event_type,
                aggregate_type="appointment",
                aggregate_id=str(appointment.id),
                data={"new_status": data.status},
                user_id=str(updated_by) if updated_by else None,
            ))

        return appointment

    async def reschedule(
        self,
        appointment_id: uuid.UUID,
        data: AppointmentReschedule,
        updated_by: uuid.UUID | None = None,
    ) -> Appointment | None:
        """Reagenda una cita liberando el slot anterior."""
        appointment = await self.get_appointment(appointment_id)
        if not appointment:
            return None

        if appointment.status not in ("scheduled", "confirmed"):
            raise ValueError("Solo se pueden reagendar citas programadas o confirmadas")

        # Verificar disponibilidad del nuevo horario
        conflict = await self._check_conflict(
            appointment.provider_id, data.new_start, data.new_end,
            exclude_id=appointment_id,
        )
        if conflict:
            raise ValueError("El nuevo horario no esta disponible")

        appointment.scheduled_start = data.new_start
        appointment.scheduled_end = data.new_end
        appointment.status = "scheduled"
        appointment.confirmed_at = None
        appointment.updated_by = updated_by
        await self.db.flush()

        return appointment

    async def get_appointment(self, appointment_id: uuid.UUID) -> Appointment | None:
        stmt = (
            select(Appointment)
            .where(Appointment.id == appointment_id, Appointment.is_active == True)
            .options(selectinload(Appointment.provider))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_appointments(
        self,
        provider_id: uuid.UUID | None = None,
        patient_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Appointment], int]:
        """Lista citas con filtros multiples."""
        stmt = select(Appointment).where(Appointment.is_active == True)
        count_base = select(func.count()).select_from(Appointment).where(Appointment.is_active == True)

        if provider_id:
            stmt = stmt.where(Appointment.provider_id == provider_id)
            count_base = count_base.where(Appointment.provider_id == provider_id)
        if patient_id:
            stmt = stmt.where(Appointment.patient_id == patient_id)
            count_base = count_base.where(Appointment.patient_id == patient_id)
        if start_date:
            dt = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)
            stmt = stmt.where(Appointment.scheduled_start >= dt)
            count_base = count_base.where(Appointment.scheduled_start >= dt)
        if end_date:
            dt = datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc)
            stmt = stmt.where(Appointment.scheduled_start <= dt)
            count_base = count_base.where(Appointment.scheduled_start <= dt)
        if status:
            stmt = stmt.where(Appointment.status == status)
            count_base = count_base.where(Appointment.status == status)

        count_result = await self.db.execute(count_base)
        total = count_result.scalar() or 0

        stmt = (
            stmt.options(selectinload(Appointment.provider))
            .offset(offset)
            .limit(limit)
            .order_by(Appointment.scheduled_start)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def _check_conflict(
        self,
        provider_id: uuid.UUID,
        start: datetime,
        end: datetime,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        """Verifica si hay conflicto de horario."""
        stmt = select(Appointment).where(
            Appointment.provider_id == provider_id,
            Appointment.status.not_in(["cancelled", "no_show"]),
            Appointment.scheduled_start < end,
            Appointment.scheduled_end > start,
            Appointment.is_active == True,
        )
        if exclude_id:
            stmt = stmt.where(Appointment.id != exclude_id)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None


class WaitingListService:
    """Servicio de lista de espera."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_to_waiting_list(self, **kwargs) -> WaitingList:
        entry = WaitingList(**kwargs)
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def get_waiting_list(
        self,
        provider_id: uuid.UUID | None = None,
        specialty_code: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[WaitingList], int]:
        stmt = select(WaitingList).where(
            WaitingList.status == "waiting",
            WaitingList.is_active == True,
        )
        count_base = select(func.count()).select_from(WaitingList).where(
            WaitingList.status == "waiting",
            WaitingList.is_active == True,
        )

        if provider_id:
            stmt = stmt.where(WaitingList.provider_id == provider_id)
            count_base = count_base.where(WaitingList.provider_id == provider_id)
        if specialty_code:
            stmt = stmt.where(WaitingList.specialty_code == specialty_code)
            count_base = count_base.where(WaitingList.specialty_code == specialty_code)

        count_result = await self.db.execute(count_base)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(
            WaitingList.priority, WaitingList.created_at
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total
