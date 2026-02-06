"""
Rutas API del modulo de Citas.
Agendamiento, disponibilidad, check-in, lista de espera.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions
from app.modules.auth.models import User
from app.modules.appointments.schemas import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentReschedule,
    AppointmentResponse,
    AppointmentStatusUpdate,
    AvailableSlot,
    ProviderCreate,
    ProviderResponse,
    ScheduleTemplateCreate,
    ScheduleTemplateResponse,
    ScheduleBlockCreate,
    WaitingListCreate,
    WaitingListResponse,
)
from app.modules.appointments.service import (
    AppointmentService,
    ProviderService,
    ScheduleService,
    WaitingListService,
)
from app.shared.schemas import MessageResponse, PaginatedResponse, PaginationParams

router = APIRouter()


# =============================================
# Proveedores
# =============================================

@router.post("/providers", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    data: ProviderCreate,
    current_user: User = Depends(require_permissions("providers:write")),
    db: AsyncSession = Depends(get_db),
):
    """Registrar un nuevo proveedor de salud."""
    service = ProviderService(db)
    provider = await service.create_provider(**data.model_dump())
    return ProviderResponse.model_validate(provider)


@router.get("/providers", response_model=PaginatedResponse[ProviderResponse])
async def list_providers(
    specialty: str | None = None,
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("providers:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar proveedores con filtro por especialidad."""
    if pagination is None:
        pagination = PaginationParams()
    service = ProviderService(db)
    providers, total = await service.list_providers(
        specialty=specialty, offset=pagination.offset, limit=pagination.page_size
    )
    return PaginatedResponse.create(
        items=[ProviderResponse.model_validate(p) for p in providers],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/providers/{provider_id}", response_model=ProviderResponse)
async def get_provider(
    provider_id: uuid.UUID,
    current_user: User = Depends(require_permissions("providers:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener proveedor por ID."""
    service = ProviderService(db)
    provider = await service.get_provider(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return ProviderResponse.model_validate(provider)


# =============================================
# Horarios y Disponibilidad
# =============================================

@router.post("/schedules", response_model=ScheduleTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule_template(
    data: ScheduleTemplateCreate,
    current_user: User = Depends(require_permissions("schedules:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear plantilla de horario para un proveedor."""
    service = ScheduleService(db)
    template = await service.create_template(data)
    return ScheduleTemplateResponse.model_validate(template)


@router.get("/providers/{provider_id}/availability", response_model=list[AvailableSlot])
async def get_availability(
    provider_id: uuid.UUID,
    start_date: date = Query(description="Fecha inicio (YYYY-MM-DD)"),
    end_date: date = Query(description="Fecha fin (YYYY-MM-DD)"),
    current_user: User = Depends(require_permissions("appointments:read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Obtener slots disponibles de un proveedor en un rango de fechas.
    Calcula automaticamente basado en templates - bloqueos - citas existentes.
    """
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="La fecha fin debe ser posterior a la fecha inicio")

    service = ScheduleService(db)
    return await service.get_available_slots(provider_id, start_date, end_date)


# =============================================
# Citas
# =============================================

@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    data: AppointmentCreate,
    current_user: User = Depends(require_permissions("appointments:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear una nueva cita con validacion de disponibilidad."""
    service = AppointmentService(db)
    try:
        appointment = await service.create_appointment(data, created_by=current_user.id)
        appointment = await service.get_appointment(appointment.id)
        return AppointmentResponse.model_validate(appointment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("", response_model=PaginatedResponse[AppointmentListResponse])
async def list_appointments(
    provider_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    appointment_status: str | None = Query(default=None, alias="status"),
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("appointments:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar citas con filtros multiples."""
    if pagination is None:
        pagination = PaginationParams()
    service = AppointmentService(db)
    appointments, total = await service.list_appointments(
        provider_id=provider_id,
        patient_id=patient_id,
        start_date=start_date,
        end_date=end_date,
        status=appointment_status,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[AppointmentListResponse.model_validate(a) for a in appointments],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: uuid.UUID,
    current_user: User = Depends(require_permissions("appointments:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener cita por ID."""
    service = AppointmentService(db)
    appointment = await service.get_appointment(appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return AppointmentResponse.model_validate(appointment)


@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    data: AppointmentStatusUpdate,
    current_user: User = Depends(require_permissions("appointments:write")),
    db: AsyncSession = Depends(get_db),
):
    """
    Cambiar estado de una cita.
    Transiciones validas: scheduled->confirmed->arrived->in_progress->completed
    Cancellable desde: scheduled, confirmed, arrived.
    """
    service = AppointmentService(db)
    try:
        appointment = await service.update_status(
            appointment_id, data, updated_by=current_user.id
        )
        if not appointment:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        appointment = await service.get_appointment(appointment.id)
        return AppointmentResponse.model_validate(appointment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    appointment_id: uuid.UUID,
    data: AppointmentReschedule,
    current_user: User = Depends(require_permissions("appointments:write")),
    db: AsyncSession = Depends(get_db),
):
    """Reagendar una cita liberando el slot anterior automaticamente."""
    service = AppointmentService(db)
    try:
        appointment = await service.reschedule(
            appointment_id, data, updated_by=current_user.id
        )
        if not appointment:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        appointment = await service.get_appointment(appointment.id)
        return AppointmentResponse.model_validate(appointment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# Lista de Espera
# =============================================

@router.post("/waiting-list", response_model=WaitingListResponse, status_code=status.HTTP_201_CREATED)
async def add_to_waiting_list(
    data: WaitingListCreate,
    current_user: User = Depends(require_permissions("appointments:write")),
    db: AsyncSession = Depends(get_db),
):
    """Agregar paciente a lista de espera."""
    service = WaitingListService(db)
    entry = await service.add_to_waiting_list(**data.model_dump())
    return WaitingListResponse.model_validate(entry)


@router.get("/waiting-list", response_model=PaginatedResponse[WaitingListResponse])
async def get_waiting_list(
    provider_id: uuid.UUID | None = None,
    specialty_code: str | None = None,
    pagination: Annotated[PaginationParams, Depends()] = None,
    current_user: User = Depends(require_permissions("appointments:read")),
    db: AsyncSession = Depends(get_db),
):
    """Consultar lista de espera con filtros."""
    if pagination is None:
        pagination = PaginationParams()
    service = WaitingListService(db)
    entries, total = await service.get_waiting_list(
        provider_id=provider_id,
        specialty_code=specialty_code,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[WaitingListResponse.model_validate(e) for e in entries],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
