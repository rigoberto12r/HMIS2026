"""
Modelos de datos del modulo de Historia Clinica Electronica (EMR).
Encuentros, notas clinicas, diagnosticos, signos vitales, ordenes y alergias.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_models import BaseEntity, TimestampMixin, UUIDMixin


class Encounter(Base, BaseEntity):
    """
    Encuentro clinico: contenedor principal de toda actividad clinica.
    Puede ser ambulatorio, emergencia o hospitalizacion.
    """

    __tablename__ = "encounters"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    encounter_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # ambulatory, emergency, inpatient
    status: Mapped[str] = mapped_column(
        String(20), default="in_progress"
    )  # in_progress, completed, cancelled

    start_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    end_datetime: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    disposition: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # alta, hospitalizacion, referencia, defuncion

    # Relaciones
    clinical_notes: Mapped[list["ClinicalNote"]] = relationship(
        back_populates="encounter", cascade="all, delete-orphan"
    )
    diagnoses: Mapped[list["Diagnosis"]] = relationship(
        back_populates="encounter", cascade="all, delete-orphan"
    )
    vital_signs: Mapped[list["VitalSigns"]] = relationship(
        back_populates="encounter", cascade="all, delete-orphan"
    )
    medical_orders: Mapped[list["MedicalOrder"]] = relationship(
        back_populates="encounter", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["EncounterAttachment"]] = relationship(
        back_populates="encounter", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_encounters_patient_date", "patient_id", "start_datetime"),
    )


class ClinicalNote(Base, BaseEntity):
    """
    Nota clinica con soporte para formato SOAP, notas de procedimiento y egreso.
    Las notas firmadas son inmutables; solo se permiten enmiendas.
    """

    __tablename__ = "clinical_notes"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False
    )
    note_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # soap, progress, procedure, discharge, addendum

    # Estructura SOAP flexible almacenada en JSONB
    # {
    #   "subjective": "...",
    #   "objective": "...",
    #   "assessment": "...",
    #   "plan": "..."
    # }
    content_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Firma digital
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_signed: Mapped[bool] = mapped_column(default=False)

    # Para enmiendas (addendums)
    amendment_of: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    amendment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relaciones
    encounter: Mapped["Encounter"] = relationship(back_populates="clinical_notes")


class Diagnosis(Base, BaseEntity):
    """
    Diagnostico codificado con CIE-10.
    Puede ser principal, secundario o complicacion.
    """

    __tablename__ = "diagnoses"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False
    )
    icd10_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    diagnosis_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # principal, secondary, complication
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, resolved, chronic
    onset_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    resolved_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relaciones
    encounter: Mapped["Encounter"] = relationship(back_populates="diagnoses")


class VitalSigns(Base, UUIDMixin, TimestampMixin):
    """
    Registro de signos vitales con historico para trending.
    """

    __tablename__ = "vital_signs"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    measured_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Signos vitales
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)  # Celsius
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # bpm
    blood_pressure_sys: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mmHg
    blood_pressure_dia: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mmHg
    respiratory_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # rpm
    oxygen_saturation: Mapped[float | None] = mapped_column(Float, nullable=True)  # %
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)  # kg
    height: Mapped[float | None] = mapped_column(Float, nullable=True)  # cm
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    pain_scale: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 0-10
    glucose: Mapped[float | None] = mapped_column(Float, nullable=True)  # mg/dL

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relaciones
    encounter: Mapped["Encounter"] = relationship(back_populates="vital_signs")


class Allergy(Base, BaseEntity):
    """
    Alergia del paciente con severidad y tipo de reaccion.
    Se cruza con prescripciones para alertas automaticas.
    """

    __tablename__ = "allergies"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    allergen: Mapped[str] = mapped_column(String(200), nullable=False)
    allergen_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # drug, food, environment, latex, other
    reaction: Mapped[str | None] = mapped_column(String(500), nullable=True)
    severity: Mapped[str] = mapped_column(
        String(20), default="moderate"
    )  # mild, moderate, severe, life_threatening
    status: Mapped[str] = mapped_column(String(20), default="active")
    reported_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class MedicalOrder(Base, BaseEntity):
    """
    Orden medica que dispara flujos en otros modulos (laboratorio, imagen, farmacia).
    """

    __tablename__ = "medical_orders"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    ordered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    order_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # lab, imaging, procedure, referral, diet, medication
    priority: Mapped[str] = mapped_column(
        String(20), default="routine"
    )  # routine, urgent, stat

    # Detalle de la orden (estructura flexible segun tipo)
    details_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Ejemplo para lab: {"test_code": "CBC", "test_name": "Hemograma completo", "instructions": "Ayuno 8h"}
    # Ejemplo para imaging: {"modality": "CT", "body_part": "abdomen", "contrast": true}

    clinical_indication: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, in_progress, completed, cancelled

    # Resultado (referencia al recurso resultado)
    result_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relaciones
    encounter: Mapped["Encounter"] = relationship(back_populates="medical_orders")


class ClinicalTemplate(Base, BaseEntity):
    """
    Plantilla clinica personalizable por especialidad.
    Define la estructura del formulario y campos para notas clinicas.
    """

    __tablename__ = "clinical_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    specialty_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    template_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # soap, procedure, discharge, admission
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Schema JSON que define los campos del template
    schema_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Layout para renderizar en el frontend
    ui_layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    is_default: Mapped[bool] = mapped_column(default=False)


class EncounterAttachment(Base, BaseEntity):
    """
    Archivo adjunto a un encuentro clínico (imágenes, PDFs, resultados de laboratorio).
    Los archivos se almacenan en S3/MinIO; aquí solo se guarda la referencia.
    """

    __tablename__ = "encounter_attachments"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False
    )
    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(30), default="general"
    )  # general, lab_result, imaging, consent, referral

    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Relaciones
    encounter: Mapped["Encounter"] = relationship(back_populates="attachments")

    __table_args__ = (
        Index("ix_encounter_attachments_encounter", "encounter_id"),
    )


class PatientProblemList(Base, BaseEntity):
    """
    Lista de problemas activos del paciente.
    Vista consolidada de diagnosticos cronicos y condiciones activas.
    """

    __tablename__ = "patient_problem_list"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    diagnosis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    icd10_code: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )  # active, inactive, resolved
    onset_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
