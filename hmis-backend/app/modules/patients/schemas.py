"""
Schemas Pydantic para el modulo de Pacientes.
Validacion y serializacion de datos de entrada/salida.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


# =============================================
# Seguros del paciente
# =============================================

class PatientInsuranceCreate(BaseModel):
    """Creacion de poliza de seguro."""
    insurer_name: str = Field(max_length=200)
    insurer_code: str | None = None
    policy_number: str = Field(max_length=50)
    plan_type: str | None = None
    group_number: str | None = None
    coverage_start: date
    coverage_end: date | None = None
    copay_percentage: float = Field(default=0.0, ge=0, le=100)
    is_primary: bool = True


class PatientInsuranceResponse(BaseModel):
    """Respuesta de poliza de seguro."""
    id: uuid.UUID
    insurer_name: str
    insurer_code: str | None = None
    policy_number: str
    plan_type: str | None = None
    coverage_start: date
    coverage_end: date | None = None
    copay_percentage: float
    is_primary: bool
    status: str

    model_config = {"from_attributes": True}


# =============================================
# Pacientes
# =============================================

class PatientCreate(BaseModel):
    """Creacion de nuevo paciente."""
    document_type: str = Field(max_length=20, description="Tipo: cedula, pasaporte, RNC")
    document_number: str = Field(max_length=30)
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    second_last_name: str | None = None
    birth_date: date
    gender: str = Field(max_length=20, description="M, F, otro")
    blood_type: str | None = None
    marital_status: str | None = None
    nationality: str | None = None

    # Contacto
    phone: str | None = None
    mobile_phone: str | None = None
    email: EmailStr | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state_province: str | None = None
    postal_code: str | None = None
    country: str = "DO"

    # Emergencia
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relationship: str | None = None

    # Seguros
    insurance_policies: list[PatientInsuranceCreate] = []


class PatientUpdate(BaseModel):
    """Actualizacion de paciente (campos opcionales)."""
    first_name: str | None = None
    last_name: str | None = None
    second_last_name: str | None = None
    phone: str | None = None
    mobile_phone: str | None = None
    email: EmailStr | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state_province: str | None = None
    postal_code: str | None = None
    country: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relationship: str | None = None
    blood_type: str | None = None
    marital_status: str | None = None
    status: str | None = None


class PatientResponse(BaseModel):
    """Respuesta completa de paciente."""
    id: uuid.UUID
    mrn: str
    document_type: str
    document_number: str
    first_name: str
    last_name: str
    second_last_name: str | None = None
    birth_date: date
    gender: str
    blood_type: str | None = None
    marital_status: str | None = None
    nationality: str | None = None

    phone: str | None = None
    mobile_phone: str | None = None
    email: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state_province: str | None = None
    country: str

    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relationship: str | None = None

    photo_url: str | None = None
    status: str
    is_active: bool
    insurance_policies: list[PatientInsuranceResponse] = []

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PatientListResponse(BaseModel):
    """Respuesta resumida de paciente para listados."""
    id: uuid.UUID
    mrn: str
    document_number: str
    first_name: str
    last_name: str
    birth_date: date
    gender: str
    phone: str | None = None
    status: str

    model_config = {"from_attributes": True}


class PatientSearchParams(BaseModel):
    """Parametros de busqueda de pacientes."""
    query: str | None = Field(default=None, description="Busqueda por nombre, documento o MRN")
    document_type: str | None = None
    gender: str | None = None
    status: str | None = "active"
