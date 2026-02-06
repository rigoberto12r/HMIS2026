"""
Modelos de datos del modulo de Citas.
Gestion de agendamiento, disponibilidad, check-in y lista de espera.
"""

import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_models import BaseEntity, TimestampMixin, UUIDMixin


class Provider(Base, BaseEntity):
    """
    Proveedor de servicios de salud (medico, especialista, etc.).
    Gestiona su agenda y disponibilidad.
    """

    __tablename__ = "providers"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    specialty_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    specialty_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    license_number: Mapped[str] = mapped_column(String(50), nullable=False)
    consultation_duration_min: Mapped[int] = mapped_column(Integer, default=30)
    max_daily_appointments: Mapped[int] = mapped_column(Integer, default=20)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")

    # Relaciones
    schedule_templates: Mapped[list["ScheduleTemplate"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    schedule_blocks: Mapped[list["ScheduleBlock"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="provider")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Location(Base, BaseEntity):
    """Ubicacion fisica (consultorio, sala, sucursal)."""

    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location_type: Mapped[str] = mapped_column(
        String(50), default="consultorio"
    )  # consultorio, sala, sucursal
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    floor: Mapped[str | None] = mapped_column(String(10), nullable=True)
    room: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")


class ScheduleTemplate(Base, BaseEntity):
    """
    Plantilla de horario semanal del proveedor.
    Define los bloques de disponibilidad recurrentes.
    """

    __tablename__ = "schedule_templates"

    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True
    )
    day_of_week: Mapped[int] = mapped_column(
        SmallInteger, nullable=False
    )  # 0=lunes, 6=domingo
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    slot_duration_min: Mapped[int] = mapped_column(Integer, default=30)
    max_overbooking: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relaciones
    provider: Mapped["Provider"] = relationship(back_populates="schedule_templates")


class ScheduleBlock(Base, BaseEntity):
    """
    Bloqueo de agenda (vacaciones, reuniones, cirugias).
    Impide que se agendan citas en ese rango de tiempo.
    """

    __tablename__ = "schedule_blocks"

    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False
    )
    start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # vacation, meeting, surgery, personal
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recurrence_rule: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Relaciones
    provider: Mapped["Provider"] = relationship(back_populates="schedule_blocks")


class Appointment(Base, BaseEntity):
    """
    Cita medica.
    Ciclo de vida: scheduled -> confirmed -> arrived -> in_progress -> completed
    """

    __tablename__ = "appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False, index=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True
    )

    # Tipo y horario
    appointment_type: Mapped[str] = mapped_column(
        String(50), default="consulta"
    )  # consulta, control, procedimiento, urgencia
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Estado
    status: Mapped[str] = mapped_column(
        String(20), default="scheduled", index=True
    )  # scheduled, confirmed, arrived, in_progress, completed, cancelled, no_show
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Detalles
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(
        String(20), default="web"
    )  # web, app, call, presencial

    # Check-in
    check_in_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Confirmacion
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relaciones
    provider: Mapped["Provider"] = relationship(back_populates="appointments")

    # Indices
    __table_args__ = (
        Index("ix_appointments_date_provider", "scheduled_start", "provider_id"),
        Index("ix_appointments_patient_date", "patient_id", "scheduled_start"),
    )


class WaitingList(Base, BaseEntity):
    """Lista de espera para citas cuando no hay disponibilidad."""

    __tablename__ = "waiting_list"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    provider_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("providers.id"), nullable=True
    )
    specialty_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    preferred_dates: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    priority: Mapped[int] = mapped_column(SmallInteger, default=5)  # 1=mas urgente, 10=menor
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="waiting"
    )  # waiting, notified, scheduled, cancelled
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
