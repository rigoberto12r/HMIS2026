"""
Patient Portal Routes.
RESTful endpoints for patient-facing portal.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User

from .schemas import (
    PatientLoginRequest,
    PatientLoginResponse,
    PatientProfileResponse,
    PatientProfileUpdateRequest,
    PatientRegisterRequest,
    PortalAppointmentBookRequest,
    PortalAppointmentCancelRequest,
    PortalAppointmentResponse,
    PortalDashboardResponse,
    PortalDiagnosisResponse,
    PortalEncounterSummary,
    PortalInvoiceResponse,
    PortalPaymentHistoryResponse,
    PortalPrescriptionRefillRequest,
    PortalPrescriptionResponse,
    PortalVitalSignsResponse,
)
from .service import PortalService

router = APIRouter()


# ============= Dependencies =============


async def get_portal_patient_id(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> uuid.UUID:
    """Extract patient ID from authenticated portal user."""
    from .models import PatientPortalAccount
    from sqlalchemy import select

    portal_account = await db.scalar(
        select(PatientPortalAccount).where(
            PatientPortalAccount.user_id == current_user.id
        )
    )

    if not portal_account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a patient portal account",
        )

    return portal_account.patient_id


# ============= Authentication =============


@router.post("/register", response_model=PatientLoginResponse)
async def register_patient(
    data: PatientRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Register a new patient account.
    Creates patient record and portal access credentials.
    """
    service = PortalService(db)
    try:
        return await service.register_patient(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=PatientLoginResponse)
async def login_patient(
    data: PatientLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Authenticate patient and return access tokens.
    """
    service = PortalService(db)
    result = await service.authenticate_patient(data.email, data.password)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return result


# ============= Profile =============


@router.get("/profile", response_model=PatientProfileResponse)
async def get_profile(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get patient profile information.
    """
    service = PortalService(db)
    patient = await service.get_patient_profile(patient_id)

    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    return patient


@router.patch("/profile", response_model=PatientProfileResponse)
async def update_profile(
    updates: PatientProfileUpdateRequest,
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update patient contact information.
    Only allows updating contact details, not medical information.
    """
    service = PortalService(db)
    patient = await service.update_patient_profile(
        patient_id, updates.model_dump(exclude_unset=True)
    )

    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    return patient


# ============= Appointments =============


@router.get("/appointments", response_model=list[PortalAppointmentResponse])
async def get_appointments(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_past: bool = False,
):
    """
    Get patient's appointments.
    By default, only returns future appointments.
    """
    service = PortalService(db)
    return await service.get_patient_appointments(patient_id, include_past)


@router.post("/appointments", response_model=dict)
async def book_appointment(
    data: PortalAppointmentBookRequest,
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Book a new appointment.
    """
    # TODO: Implement appointment booking logic
    # For now, return placeholder
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Appointment booking is not yet implemented. Please call the office to book.",
    )


@router.post("/appointments/{appointment_id}/cancel", response_model=dict)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    data: PortalAppointmentCancelRequest,
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Cancel an appointment.
    Appointments can only be cancelled if they are more than 24 hours away.
    """
    service = PortalService(db)
    try:
        success = await service.cancel_appointment(
            appointment_id, patient_id, data.cancellation_reason
        )
        if success:
            return {"message": "Appointment cancelled successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found",
            )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============= Medical Records =============


@router.get("/medical-records/encounters", response_model=list[PortalEncounterSummary])
async def get_encounters(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
):
    """
    Get patient's medical encounter history.
    """
    service = PortalService(db)
    return await service.get_patient_encounters(patient_id, limit)


@router.get("/medical-records/diagnoses", response_model=list[PortalDiagnosisResponse])
async def get_diagnoses(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
):
    """
    Get patient's diagnosis history.
    """
    service = PortalService(db)
    return await service.get_patient_diagnoses(patient_id, limit)


@router.get("/medical-records/vitals", response_model=list[PortalVitalSignsResponse])
async def get_vitals(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 20,
):
    """
    Get patient's vital signs history.
    """
    service = PortalService(db)
    return await service.get_patient_vitals(patient_id, limit)


# ============= Prescriptions =============


@router.get("/prescriptions", response_model=list[PortalPrescriptionResponse])
async def get_prescriptions(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    active_only: bool = False,
):
    """
    Get patient's prescriptions.
    """
    service = PortalService(db)
    return await service.get_patient_prescriptions(patient_id, active_only)


@router.post("/prescriptions/refill", response_model=dict)
async def request_refill(
    data: PortalPrescriptionRefillRequest,
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Request a prescription refill.
    """
    service = PortalService(db)
    try:
        success = await service.request_prescription_refill(
            patient_id, data.prescription_id, data.notes
        )
        if success:
            return {"message": "Refill request submitted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============= Lab Results =============


@router.get("/lab-results", response_model=list[dict])
async def get_lab_results(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get patient's lab results.
    """
    # TODO: Implement lab results retrieval
    # For now, return empty list
    return []


# ============= Billing =============


@router.get("/billing/invoices", response_model=list[PortalInvoiceResponse])
async def get_invoices(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    unpaid_only: bool = False,
):
    """
    Get patient's invoices.
    """
    service = PortalService(db)
    return await service.get_patient_invoices(patient_id, unpaid_only)


@router.get("/billing/payments", response_model=list[PortalPaymentHistoryResponse])
async def get_payment_history(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get patient's payment history.
    """
    service = PortalService(db)
    return await service.get_payment_history(patient_id)


@router.post("/billing/invoices/{invoice_id}/pay", response_model=dict)
async def pay_invoice(
    invoice_id: uuid.UUID,
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Initiate payment for an invoice.
    """
    # TODO: Integrate with payment gateway
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Online payment is not yet implemented. Please pay at the office or call for payment options.",
    )


# ============= Dashboard =============


@router.get("/dashboard", response_model=PortalDashboardResponse)
async def get_dashboard(
    patient_id: Annotated[uuid.UUID, Depends(get_portal_patient_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get patient dashboard with stats, upcoming appointments, and alerts.
    """
    service = PortalService(db)
    return await service.get_dashboard_data(patient_id)
