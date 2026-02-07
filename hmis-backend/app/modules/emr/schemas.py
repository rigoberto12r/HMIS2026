"""
Schemas Pydantic del modulo de Historia Clinica Electronica (EMR).
"""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


# =============================================
# Encuentros
# =============================================

class EncounterCreate(BaseModel):
    """Creacion de encuentro clinico."""
    patient_id: uuid.UUID
    provider_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    encounter_type: str = Field(description="ambulatory, emergency, inpatient")
    chief_complaint: str | None = None


class EncounterUpdate(BaseModel):
    """Actualizacion de encuentro."""
    chief_complaint: str | None = None
    disposition: str | None = None
    status: str | None = None


class EncounterResponse(BaseModel):
    """Respuesta de encuentro con relaciones."""
    id: uuid.UUID
    patient_id: uuid.UUID
    provider_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    encounter_type: str
    status: str
    start_datetime: datetime
    end_datetime: datetime | None = None
    chief_complaint: str | None = None
    disposition: str | None = None
    clinical_notes: list["ClinicalNoteResponse"] = []
    diagnoses: list["DiagnosisResponse"] = []
    vital_signs: list["VitalSignsResponse"] = []
    medical_orders: list["MedicalOrderResponse"] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class EncounterListResponse(BaseModel):
    """Respuesta resumida de encuentro."""
    id: uuid.UUID
    patient_id: uuid.UUID
    provider_id: uuid.UUID
    encounter_type: str
    status: str
    start_datetime: datetime
    chief_complaint: str | None = None

    model_config = {"from_attributes": True}


# =============================================
# Notas Clinicas
# =============================================

class ClinicalNoteCreate(BaseModel):
    """Creacion de nota clinica."""
    encounter_id: uuid.UUID
    note_type: str = Field(description="soap, progress, procedure, discharge, addendum")
    content_json: dict[str, Any] = Field(
        description="Contenido estructurado. Para SOAP: {subjective, objective, assessment, plan}"
    )
    template_id: uuid.UUID | None = None
    amendment_of: uuid.UUID | None = None
    amendment_reason: str | None = None


class ClinicalNoteResponse(BaseModel):
    """Respuesta de nota clinica."""
    id: uuid.UUID
    encounter_id: uuid.UUID
    note_type: str
    content_json: dict[str, Any]
    template_id: uuid.UUID | None = None
    is_signed: bool
    signed_at: datetime | None = None
    signed_by: uuid.UUID | None = None
    amendment_of: uuid.UUID | None = None
    amendment_reason: str | None = None
    created_at: datetime
    created_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}


# =============================================
# Diagnosticos
# =============================================

class DiagnosisCreate(BaseModel):
    """Creacion de diagnostico."""
    encounter_id: uuid.UUID
    icd10_code: str = Field(max_length=10)
    description: str = Field(max_length=500)
    diagnosis_type: str = Field(description="principal, secondary, complication")
    status: str = "active"
    onset_date: date | None = None
    notes: str | None = None


class DiagnosisResponse(BaseModel):
    """Respuesta de diagnostico."""
    id: uuid.UUID
    encounter_id: uuid.UUID
    icd10_code: str
    description: str
    diagnosis_type: str
    status: str
    onset_date: date | None = None
    resolved_date: date | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Signos Vitales
# =============================================

class VitalSignsCreate(BaseModel):
    """Registro de signos vitales."""
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    temperature: float | None = None
    heart_rate: int | None = None
    blood_pressure_sys: int | None = None
    blood_pressure_dia: int | None = None
    respiratory_rate: int | None = None
    oxygen_saturation: float | None = None
    weight: float | None = None
    height: float | None = None
    pain_scale: int | None = Field(default=None, ge=0, le=10)
    glucose: float | None = None
    notes: str | None = None


class VitalSignsResponse(BaseModel):
    """Respuesta de signos vitales."""
    id: uuid.UUID
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    measured_at: datetime
    temperature: float | None = None
    heart_rate: int | None = None
    blood_pressure_sys: int | None = None
    blood_pressure_dia: int | None = None
    respiratory_rate: int | None = None
    oxygen_saturation: float | None = None
    weight: float | None = None
    height: float | None = None
    bmi: float | None = None
    pain_scale: int | None = None
    glucose: float | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# =============================================
# Alergias
# =============================================

class AllergyCreate(BaseModel):
    """Registro de alergia."""
    patient_id: uuid.UUID
    allergen: str = Field(max_length=200)
    allergen_type: str = Field(description="drug, food, environment, latex, other")
    reaction: str | None = None
    severity: str = "moderate"
    reported_date: date | None = None


class AllergyResponse(BaseModel):
    """Respuesta de alergia."""
    id: uuid.UUID
    patient_id: uuid.UUID
    allergen: str
    allergen_type: str
    reaction: str | None = None
    severity: str
    status: str
    reported_date: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Ordenes Medicas
# =============================================

class MedicalOrderCreate(BaseModel):
    """Creacion de orden medica."""
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    order_type: str = Field(description="lab, imaging, procedure, referral, diet, medication")
    priority: str = "routine"
    details_json: dict[str, Any]
    clinical_indication: str | None = None


class MedicalOrderResponse(BaseModel):
    """Respuesta de orden medica."""
    id: uuid.UUID
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    ordered_by: uuid.UUID
    order_type: str
    priority: str
    details_json: dict[str, Any]
    clinical_indication: str | None = None
    status: str
    result_summary: str | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MedicalOrderStatusUpdate(BaseModel):
    """Actualizacion de estado de orden."""
    status: str = Field(description="pending, in_progress, completed, cancelled")
    result_summary: str | None = None


# =============================================
# Lista de Problemas
# =============================================

class ProblemListCreate(BaseModel):
    """Agregar a lista de problemas."""
    patient_id: uuid.UUID
    icd10_code: str = Field(max_length=10)
    description: str = Field(max_length=500)
    onset_date: date | None = None
    notes: str | None = None


class ProblemListResponse(BaseModel):
    """Respuesta de problema."""
    id: uuid.UUID
    patient_id: uuid.UUID
    icd10_code: str
    description: str
    status: str
    onset_date: date | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Actualizacion de Diagnosticos
# =============================================

class DiagnosisUpdate(BaseModel):
    """Actualizacion de diagnostico."""
    status: str | None = Field(default=None, description="active, resolved, chronic")
    resolved_date: date | None = None
    notes: str | None = None


# =============================================
# Actualizacion de Alergias
# =============================================

class AllergyUpdate(BaseModel):
    """Actualizacion de alergia."""
    severity: str | None = None
    reaction: str | None = None
    status: str | None = Field(default=None, description="active, inactive, resolved")


# =============================================
# Plantillas Clinicas
# =============================================

class ClinicalTemplateCreate(BaseModel):
    """Creacion de plantilla clinica."""
    name: str = Field(max_length=200)
    specialty_code: str | None = Field(default=None, max_length=20)
    template_type: str = Field(description="soap, procedure, discharge, admission")
    schema_json: dict[str, Any]
    ui_layout_json: dict[str, Any] | None = None
    is_default: bool = False


class ClinicalTemplateResponse(BaseModel):
    """Respuesta de plantilla clinica."""
    id: uuid.UUID
    name: str
    specialty_code: str | None = None
    template_type: str
    version: int
    schema_json: dict[str, Any]
    ui_layout_json: dict[str, Any] | None = None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================
# Actualizacion de Lista de Problemas
# =============================================

class ProblemListUpdate(BaseModel):
    """Actualizacion de problema en lista."""
    status: str | None = Field(default=None, description="active, inactive, resolved")
    notes: str | None = None
