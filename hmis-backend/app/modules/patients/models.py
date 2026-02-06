"""
Modelos de datos del modulo de Pacientes.
Gestion de informacion demografica, contacto, seguros y emergencia.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_models import BaseEntity


class Patient(Base, BaseEntity):
    """
    Entidad principal de paciente.
    Contiene toda la informacion demografica y administrativa.
    """

    __tablename__ = "patients"

    # Identificacion
    document_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # cedula, pasaporte, RNC, etc.
    document_number: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    mrn: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )  # Medical Record Number

    # Datos personales
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    second_last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)  # M, F, otro
    blood_type: Mapped[str | None] = mapped_column(String(5), nullable=True)  # A+, A-, B+, etc.
    marital_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Contacto
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mobile_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state_province: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="DO")

    # Contacto de emergencia
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    emergency_contact_relationship: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Multimedia
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Estado
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, inactive, deceased

    # Relaciones
    insurance_policies: Mapped[list["PatientInsurance"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )

    # Indices compuestos para busquedas frecuentes
    __table_args__ = (
        Index("ix_patients_document", "document_type", "document_number"),
        Index("ix_patients_name", "first_name", "last_name"),
    )

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        if self.second_last_name:
            parts.append(self.second_last_name)
        return " ".join(parts)

    @property
    def age(self) -> int:
        today = date.today()
        return (
            today.year
            - self.birth_date.year
            - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        )


class PatientInsurance(Base, BaseEntity):
    """Poliza de seguro vinculada a un paciente."""

    __tablename__ = "patient_insurances"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    insurer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    insurer_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    policy_number: Mapped[str] = mapped_column(String(50), nullable=False)
    plan_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    group_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    coverage_start: Mapped[date] = mapped_column(Date, nullable=False)
    coverage_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    copay_percentage: Mapped[float] = mapped_column(default=0.0)
    is_primary: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(20), default="active")

    # Relaciones
    patient: Mapped["Patient"] = relationship(back_populates="insurance_policies")
