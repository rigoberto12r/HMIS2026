"""
Schemas Pydantic del modulo de Citas.
"""

import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, Field


# =============================================
# Proveedores
# =============================================

class ProviderCreate(BaseModel):
    """Creacion de proveedor de salud."""
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    specialty_code: str | None = None
    specialty_name: str | None = None
    license_number: str = Field(max_length=50)
    consultation_duration_min: int = 30
    max_daily_appointments: int = 20
    phone: str | None = None
    email: str | None = None


class ProviderResponse(BaseModel):
    """Respuesta de proveedor."""
    id: uuid.UUID
    first_name: str
    last_name: str
    specialty_code: str | None = None
    specialty_name: str | None = None
    license_number: str
    consultation_duration_min: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Horarios
# =============================================

class ScheduleTemplateCreate(BaseModel):
    """Creacion de plantilla de horario."""
    provider_id: uuid.UUID
    location_id: uuid.UUID | None = None
    day_of_week: int = Field(ge=0, le=6, description="0=lunes, 6=domingo")
    start_time: time
    end_time: time
    slot_duration_min: int = Field(default=30, ge=10, le=120)
    max_overbooking: int = Field(default=0, ge=0, le=5)


class ScheduleTemplateResponse(BaseModel):
    """Respuesta de plantilla de horario."""
    id: uuid.UUID
    provider_id: uuid.UUID
    day_of_week: int
    start_time: time
    end_time: time
    slot_duration_min: int
    max_overbooking: int
    is_active: bool

    model_config = {"from_attributes": True}


class ScheduleBlockCreate(BaseModel):
    """Creacion de bloqueo de agenda."""
    provider_id: uuid.UUID
    start_datetime: datetime
    end_datetime: datetime
    reason: str = Field(max_length=50)
    description: str | None = None


class AvailableSlot(BaseModel):
    """Slot de tiempo disponible."""
    start: datetime
    end: datetime
    provider_id: uuid.UUID
    location_id: uuid.UUID | None = None
    available_spots: int = 1


# =============================================
# Citas
# =============================================

class AppointmentCreate(BaseModel):
    """Creacion de cita."""
    patient_id: uuid.UUID
    provider_id: uuid.UUID
    location_id: uuid.UUID | None = None
    appointment_type: str = "consulta"
    scheduled_start: datetime
    scheduled_end: datetime
    reason: str | None = None
    notes: str | None = None
    source: str = "web"


class AppointmentUpdate(BaseModel):
    """Actualizacion de cita."""
    location_id: uuid.UUID | None = None
    reason: str | None = None
    notes: str | None = None


class AppointmentStatusUpdate(BaseModel):
    """Cambio de estado de cita."""
    status: str = Field(
        description="scheduled, confirmed, arrived, in_progress, completed, cancelled, no_show"
    )
    cancellation_reason: str | None = None


class AppointmentReschedule(BaseModel):
    """Reagendamiento de cita."""
    new_start: datetime
    new_end: datetime
    reason: str | None = None


class AppointmentResponse(BaseModel):
    """Respuesta de cita."""
    id: uuid.UUID
    patient_id: uuid.UUID
    provider_id: uuid.UUID
    location_id: uuid.UUID | None = None
    appointment_type: str
    scheduled_start: datetime
    scheduled_end: datetime
    status: str
    reason: str | None = None
    notes: str | None = None
    source: str
    check_in_time: datetime | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    cancellation_reason: str | None = None
    provider: ProviderResponse | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AppointmentListResponse(BaseModel):
    """Respuesta resumida de cita para listados."""
    id: uuid.UUID
    patient_id: uuid.UUID
    provider_id: uuid.UUID
    appointment_type: str
    scheduled_start: datetime
    status: str
    source: str

    model_config = {"from_attributes": True}


# =============================================
# Lista de Espera
# =============================================

class WaitingListCreate(BaseModel):
    """Agregar a lista de espera."""
    patient_id: uuid.UUID
    provider_id: uuid.UUID | None = None
    specialty_code: str | None = None
    priority: int = Field(default=5, ge=1, le=10)
    reason: str | None = None


class WaitingListResponse(BaseModel):
    """Respuesta de lista de espera."""
    id: uuid.UUID
    patient_id: uuid.UUID
    provider_id: uuid.UUID | None = None
    specialty_code: str | None = None
    priority: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
