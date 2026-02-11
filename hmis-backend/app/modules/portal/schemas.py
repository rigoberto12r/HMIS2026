"""
Patient Portal Schemas.
Request/response models for patient portal endpoints.
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ============= Authentication Schemas =============

class PatientRegisterRequest(BaseModel):
    """Patient self-registration request."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    second_last_name: Optional[str] = Field(None, max_length=100)
    document_type: str = Field(..., max_length=20)
    document_number: str = Field(..., max_length=30)
    birth_date: date
    gender: str = Field(..., max_length=20)
    phone: Optional[str] = Field(None, max_length=20)
    mobile_phone: Optional[str] = Field(None, max_length=20)


class PatientLoginRequest(BaseModel):
    """Patient login request."""
    email: EmailStr
    password: str


class PatientLoginResponse(BaseModel):
    """Patient login response with tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    patient_id: UUID
    full_name: str


# ============= Profile Schemas =============

class PatientProfileResponse(BaseModel):
    """Patient profile information."""
    id: UUID
    mrn: str
    first_name: str
    last_name: str
    second_last_name: Optional[str]
    full_name: str
    birth_date: date
    age: int
    gender: str
    blood_type: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    mobile_phone: Optional[str]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state_province: Optional[str]
    postal_code: Optional[str]
    country: str
    photo_url: Optional[str]

    class Config:
        from_attributes = True


class PatientProfileUpdateRequest(BaseModel):
    """Update patient profile (contact info only)."""
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    mobile_phone: Optional[str] = Field(None, max_length=20)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state_province: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)


# ============= Appointment Schemas =============

class PortalAppointmentResponse(BaseModel):
    """Appointment details for patient portal."""
    id: UUID
    provider_name: str
    provider_specialty: Optional[str]
    appointment_type: str
    scheduled_start: datetime
    scheduled_end: datetime
    status: str
    reason: Optional[str]
    location_name: Optional[str]
    can_cancel: bool

    class Config:
        from_attributes = True


class PortalAppointmentBookRequest(BaseModel):
    """Request to book an appointment."""
    provider_id: UUID
    scheduled_start: datetime
    appointment_type: str = "consulta"
    reason: Optional[str] = None


class PortalAppointmentCancelRequest(BaseModel):
    """Cancel appointment request."""
    cancellation_reason: str = Field(..., max_length=500)


# ============= Medical Records Schemas =============

class PortalAllergyResponse(BaseModel):
    """Patient allergy information."""
    id: UUID
    allergen_name: str
    allergen_type: str
    severity: str
    reaction: Optional[str]
    onset_date: Optional[date]
    status: str

    class Config:
        from_attributes = True


class PortalDiagnosisResponse(BaseModel):
    """Patient diagnosis from encounters."""
    id: UUID
    encounter_date: datetime
    provider_name: str
    icd10_code: Optional[str]
    icd10_description: str
    diagnosis_type: str
    status: str

    class Config:
        from_attributes = True


class PortalVitalSignsResponse(BaseModel):
    """Vital signs from encounters."""
    id: UUID
    encounter_date: datetime
    temperature_c: Optional[float]
    heart_rate_bpm: Optional[int]
    respiratory_rate_bpm: Optional[int]
    systolic_bp: Optional[int]
    diastolic_bp: Optional[int]
    oxygen_saturation_pct: Optional[float]
    weight_kg: Optional[float]
    height_cm: Optional[float]
    bmi: Optional[float]

    class Config:
        from_attributes = True


class PortalEncounterSummary(BaseModel):
    """Encounter summary for medical history."""
    id: UUID
    encounter_type: str
    start_datetime: datetime
    provider_name: str
    chief_complaint: Optional[str]
    diagnoses_count: int
    has_vitals: bool
    has_prescriptions: bool

    class Config:
        from_attributes = True


# ============= Prescription Schemas =============

class PortalPrescriptionResponse(BaseModel):
    """Prescription details for patient portal."""
    id: UUID
    encounter_date: datetime
    provider_name: str
    medication_name: str
    dosage: str
    frequency: str
    duration_days: int
    instructions: Optional[str]
    status: str
    refills_remaining: int
    can_request_refill: bool

    class Config:
        from_attributes = True


class PortalPrescriptionRefillRequest(BaseModel):
    """Request prescription refill."""
    prescription_id: UUID
    notes: Optional[str] = Field(None, max_length=500)


# ============= Lab Results Schemas =============

class PortalLabResultResponse(BaseModel):
    """Lab test result for patient portal."""
    id: UUID
    order_date: datetime
    test_name: str
    test_code: Optional[str]
    result_value: Optional[str]
    unit: Optional[str]
    reference_range: Optional[str]
    status: str
    is_abnormal: bool
    provider_name: str
    report_url: Optional[str]

    class Config:
        from_attributes = True


# ============= Billing Schemas =============

class PortalInvoiceLineItem(BaseModel):
    """Invoice line item."""
    description: str
    quantity: int
    unit_price: float
    total: float


class PortalInvoiceResponse(BaseModel):
    """Invoice details for patient portal."""
    id: UUID
    invoice_number: str
    invoice_date: date
    due_date: date
    subtotal: float
    tax: float
    total: float
    amount_paid: float
    balance_due: float
    status: str
    ncf_number: Optional[str]
    encounter_date: Optional[datetime]
    line_items: list[PortalInvoiceLineItem]
    pdf_url: Optional[str]

    class Config:
        from_attributes = True


class PortalPaymentHistoryResponse(BaseModel):
    """Payment transaction history."""
    id: UUID
    payment_date: datetime
    amount: float
    payment_method: str
    reference_number: Optional[str]
    invoice_number: str

    class Config:
        from_attributes = True


# ============= Dashboard Schemas =============

class PortalDashboardStats(BaseModel):
    """Patient dashboard statistics."""
    upcoming_appointments_count: int
    pending_prescriptions_count: int
    unread_lab_results_count: int
    outstanding_balance: float
    last_visit_date: Optional[datetime]


class PortalDashboardAlert(BaseModel):
    """Dashboard alert/notification."""
    id: str
    type: str  # appointment_reminder, lab_result, prescription_ready, payment_due
    title: str
    message: str
    severity: str  # info, warning, urgent
    created_at: datetime
    action_url: Optional[str]


class PortalDashboardResponse(BaseModel):
    """Complete dashboard data."""
    stats: PortalDashboardStats
    upcoming_appointments: list[PortalAppointmentResponse]
    recent_alerts: list[PortalDashboardAlert]
