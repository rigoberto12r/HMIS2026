"""
Patient Portal Service.
Business logic for patient portal operations.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, hash_password
from app.modules.appointments.models import Appointment, Provider
from app.modules.auth.models import User
from app.modules.billing.models import Invoice, Payment
from app.modules.emr.models import Diagnosis, Encounter, VitalSigns
from app.modules.patients.models import Patient, PatientInsurance
from app.modules.pharmacy.models import Prescription

from .models import (
    PatientPortalAccount,
    PortalNotification,
    PrescriptionRefillRequest,
)
from .schemas import (
    PatientLoginResponse,
    PatientRegisterRequest,
    PortalAllergyResponse,
    PortalAppointmentResponse,
    PortalDashboardAlert,
    PortalDashboardResponse,
    PortalDashboardStats,
    PortalDiagnosisResponse,
    PortalEncounterSummary,
    PortalInvoiceLineItem,
    PortalInvoiceResponse,
    PortalLabResultResponse,
    PortalPaymentHistoryResponse,
    PortalPrescriptionResponse,
    PortalVitalSignsResponse,
)


class PortalService:
    """Service for patient portal operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ============= Authentication =============

    async def register_patient(self, data: PatientRegisterRequest) -> PatientLoginResponse:
        """
        Register a new patient with portal access.
        Creates both Patient and User records.
        """
        # Check if email already exists
        existing_user = await self.db.scalar(
            select(User).where(User.email == data.email)
        )
        if existing_user:
            raise ValueError("Email already registered")

        # Check if document already exists
        existing_patient = await self.db.scalar(
            select(Patient).where(
                and_(
                    Patient.document_type == data.document_type,
                    Patient.document_number == data.document_number,
                )
            )
        )
        if existing_patient:
            raise ValueError("Patient with this document already exists")

        # Generate MRN (Medical Record Number)
        # In production, this should use a proper sequence or counter
        mrn = f"MRN{uuid.uuid4().hex[:8].upper()}"

        # Create Patient record
        patient = Patient(
            document_type=data.document_type,
            document_number=data.document_number,
            mrn=mrn,
            first_name=data.first_name,
            last_name=data.last_name,
            second_last_name=data.second_last_name,
            birth_date=data.birth_date,
            gender=data.gender,
            phone=data.phone,
            mobile_phone=data.mobile_phone,
            email=data.email,
            status="active",
        )
        self.db.add(patient)
        await self.db.flush()

        # Create User record for authentication
        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.mobile_phone or data.phone,
            is_verified=False,  # Require email verification
        )
        self.db.add(user)
        await self.db.flush()

        # Link patient to portal account
        portal_account = PatientPortalAccount(
            patient_id=patient.id,
            user_id=user.id,
            is_verified=False,
            verification_token=uuid.uuid4().hex,
        )
        self.db.add(portal_account)

        # Create welcome notification
        notification = PortalNotification(
            patient_id=patient.id,
            notification_type="general",
            title="Welcome to HMIS Patient Portal",
            message=f"Welcome {patient.full_name}! Your account has been created successfully.",
            severity="info",
        )
        self.db.add(notification)

        await self.db.commit()

        # Generate tokens
        token_data = {"sub": str(user.id), "patient_id": str(patient.id), "type": "portal"}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return PatientLoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            patient_id=patient.id,
            full_name=patient.full_name,
        )

    async def authenticate_patient(
        self, email: str, password: str
    ) -> Optional[PatientLoginResponse]:
        """Authenticate patient and return tokens."""
        from app.core.security import verify_password

        # Find user
        user = await self.db.scalar(select(User).where(User.email == email))
        if not user or not verify_password(password, user.hashed_password):
            return None

        # Find associated patient
        portal_account = await self.db.scalar(
            select(PatientPortalAccount).where(PatientPortalAccount.user_id == user.id)
        )
        if not portal_account:
            return None

        patient = await self.db.get(Patient, portal_account.patient_id)
        if not patient or patient.status != "active":
            return None

        # Update last login
        portal_account.last_login_at = datetime.utcnow()
        await self.db.commit()

        # Generate tokens
        token_data = {
            "sub": str(user.id),
            "patient_id": str(patient.id),
            "type": "portal",
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return PatientLoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            patient_id=patient.id,
            full_name=patient.full_name,
        )

    # ============= Profile =============

    async def get_patient_profile(self, patient_id: uuid.UUID) -> Optional[Patient]:
        """Get patient profile information."""
        return await self.db.get(Patient, patient_id)

    async def update_patient_profile(
        self, patient_id: uuid.UUID, updates: dict
    ) -> Optional[Patient]:
        """Update patient contact information."""
        patient = await self.db.get(Patient, patient_id)
        if not patient:
            return None

        # Only allow updating contact information
        allowed_fields = {
            "email",
            "phone",
            "mobile_phone",
            "address_line1",
            "address_line2",
            "city",
            "state_province",
            "postal_code",
        }

        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(patient, field, value)

        await self.db.commit()
        await self.db.refresh(patient)
        return patient

    # ============= Appointments =============

    async def get_patient_appointments(
        self, patient_id: uuid.UUID, include_past: bool = False
    ) -> list[PortalAppointmentResponse]:
        """Get patient's appointments."""
        query = (
            select(Appointment, Provider)
            .join(Provider, Appointment.provider_id == Provider.id)
            .where(Appointment.patient_id == patient_id)
        )

        if not include_past:
            query = query.where(Appointment.scheduled_start >= datetime.utcnow())

        query = query.order_by(Appointment.scheduled_start)

        result = await self.db.execute(query)
        appointments = result.all()

        response_list = []
        now = datetime.utcnow()
        for appt, provider in appointments:
            # Can cancel if appointment is more than 24 hours away and not already completed
            can_cancel = (
                appt.status in ["scheduled", "confirmed"]
                and appt.scheduled_start > now + timedelta(hours=24)
            )

            response_list.append(
                PortalAppointmentResponse(
                    id=appt.id,
                    provider_name=provider.full_name,
                    provider_specialty=provider.specialty_name,
                    appointment_type=appt.appointment_type,
                    scheduled_start=appt.scheduled_start,
                    scheduled_end=appt.scheduled_end,
                    status=appt.status,
                    reason=appt.reason,
                    location_name=None,  # TODO: Join location if needed
                    can_cancel=can_cancel,
                )
            )

        return response_list

    async def cancel_appointment(
        self, appointment_id: uuid.UUID, patient_id: uuid.UUID, reason: str
    ) -> bool:
        """Cancel an appointment."""
        appt = await self.db.get(Appointment, appointment_id)
        if not appt or appt.patient_id != patient_id:
            return False

        # Check if cancellation is allowed
        now = datetime.utcnow()
        if appt.scheduled_start <= now + timedelta(hours=24):
            raise ValueError("Cannot cancel appointment less than 24 hours before scheduled time")

        if appt.status not in ["scheduled", "confirmed"]:
            raise ValueError("Cannot cancel appointment in this status")

        appt.status = "cancelled"
        appt.cancellation_reason = reason
        await self.db.commit()

        # Create notification
        notification = PortalNotification(
            patient_id=patient_id,
            notification_type="appointment_reminder",
            title="Appointment Cancelled",
            message=f"Your appointment on {appt.scheduled_start.strftime('%Y-%m-%d %H:%M')} has been cancelled.",
            severity="info",
        )
        self.db.add(notification)
        await self.db.commit()

        return True

    # ============= Medical Records =============

    async def get_patient_encounters(
        self, patient_id: uuid.UUID, limit: int = 50
    ) -> list[PortalEncounterSummary]:
        """Get patient encounter history."""
        query = (
            select(Encounter, Provider, func.count(Diagnosis.id).label("diag_count"))
            .join(Provider, Encounter.provider_id == Provider.id)
            .outerjoin(Diagnosis, Encounter.id == Diagnosis.encounter_id)
            .where(Encounter.patient_id == patient_id)
            .group_by(Encounter.id, Provider.id)
            .order_by(desc(Encounter.start_datetime))
            .limit(limit)
        )

        result = await self.db.execute(query)
        encounters = result.all()

        response_list = []
        for enc, provider, diag_count in encounters:
            # Check if vitals exist
            has_vitals = await self.db.scalar(
                select(func.count(VitalSigns.id)).where(VitalSigns.encounter_id == enc.id)
            ) > 0

            # Check if prescriptions exist
            has_prescriptions = await self.db.scalar(
                select(func.count(Prescription.id)).where(Prescription.encounter_id == enc.id)
            ) > 0

            response_list.append(
                PortalEncounterSummary(
                    id=enc.id,
                    encounter_type=enc.encounter_type,
                    start_datetime=enc.start_datetime,
                    provider_name=provider.full_name,
                    chief_complaint=enc.chief_complaint,
                    diagnoses_count=diag_count or 0,
                    has_vitals=has_vitals,
                    has_prescriptions=has_prescriptions,
                )
            )

        return response_list

    async def get_patient_diagnoses(
        self, patient_id: uuid.UUID, limit: int = 50
    ) -> list[PortalDiagnosisResponse]:
        """Get patient diagnosis history."""
        query = (
            select(Diagnosis, Encounter, Provider)
            .join(Encounter, Diagnosis.encounter_id == Encounter.id)
            .join(Provider, Encounter.provider_id == Provider.id)
            .where(Encounter.patient_id == patient_id)
            .order_by(desc(Encounter.start_datetime))
            .limit(limit)
        )

        result = await self.db.execute(query)
        diagnoses = result.all()

        return [
            PortalDiagnosisResponse(
                id=diag.id,
                encounter_date=enc.start_datetime,
                provider_name=provider.full_name,
                icd10_code=diag.icd10_code,
                icd10_description=diag.icd10_description,
                diagnosis_type=diag.diagnosis_type,
                status=diag.status,
            )
            for diag, enc, provider in diagnoses
        ]

    async def get_patient_vitals(
        self, patient_id: uuid.UUID, limit: int = 20
    ) -> list[PortalVitalSignsResponse]:
        """Get patient vital signs history."""
        query = (
            select(VitalSigns, Encounter)
            .join(Encounter, VitalSigns.encounter_id == Encounter.id)
            .where(Encounter.patient_id == patient_id)
            .order_by(desc(VitalSigns.recorded_at))
            .limit(limit)
        )

        result = await self.db.execute(query)
        vitals = result.all()

        return [
            PortalVitalSignsResponse(
                id=vital.id,
                encounter_date=enc.start_datetime,
                temperature_c=vital.temperature_c,
                heart_rate_bpm=vital.heart_rate_bpm,
                respiratory_rate_bpm=vital.respiratory_rate_bpm,
                systolic_bp=vital.systolic_bp,
                diastolic_bp=vital.diastolic_bp,
                oxygen_saturation_pct=vital.oxygen_saturation_pct,
                weight_kg=vital.weight_kg,
                height_cm=vital.height_cm,
                bmi=vital.bmi,
            )
            for vital, enc in vitals
        ]

    # ============= Prescriptions =============

    async def get_patient_prescriptions(
        self, patient_id: uuid.UUID, active_only: bool = False
    ) -> list[PortalPrescriptionResponse]:
        """Get patient prescriptions."""
        query = (
            select(Prescription, Encounter, Provider)
            .join(Encounter, Prescription.encounter_id == Encounter.id)
            .join(Provider, Encounter.provider_id == Provider.id)
            .where(Encounter.patient_id == patient_id)
        )

        if active_only:
            query = query.where(Prescription.status == "active")

        query = query.order_by(desc(Prescription.prescribed_date))

        result = await self.db.execute(query)
        prescriptions = result.all()

        response_list = []
        for rx, enc, provider in prescriptions:
            can_refill = rx.status == "active" and rx.refills_remaining > 0

            response_list.append(
                PortalPrescriptionResponse(
                    id=rx.id,
                    encounter_date=enc.start_datetime,
                    provider_name=provider.full_name,
                    medication_name=rx.medication_name,
                    dosage=rx.dosage,
                    frequency=rx.frequency,
                    duration_days=rx.duration_days,
                    instructions=rx.instructions,
                    status=rx.status,
                    refills_remaining=rx.refills_remaining,
                    can_request_refill=can_refill,
                )
            )

        return response_list

    async def request_prescription_refill(
        self, patient_id: uuid.UUID, prescription_id: uuid.UUID, notes: Optional[str]
    ) -> bool:
        """Request a prescription refill."""
        # Verify prescription belongs to patient
        rx = await self.db.scalar(
            select(Prescription)
            .join(Encounter)
            .where(
                and_(
                    Prescription.id == prescription_id,
                    Encounter.patient_id == patient_id,
                    Prescription.status == "active",
                    Prescription.refills_remaining > 0,
                )
            )
        )

        if not rx:
            raise ValueError("Prescription not found or cannot be refilled")

        # Create refill request
        refill_request = PrescriptionRefillRequest(
            patient_id=patient_id,
            prescription_id=prescription_id,
            request_notes=notes,
            status="pending",
        )
        self.db.add(refill_request)

        # Create notification
        notification = PortalNotification(
            patient_id=patient_id,
            notification_type="prescription_ready",
            title="Refill Request Submitted",
            message=f"Your refill request for {rx.medication_name} has been submitted and is pending review.",
            severity="info",
        )
        self.db.add(notification)

        await self.db.commit()
        return True

    # ============= Billing =============

    async def get_patient_invoices(
        self, patient_id: uuid.UUID, unpaid_only: bool = False
    ) -> list[PortalInvoiceResponse]:
        """Get patient invoices."""
        query = select(Invoice).where(Invoice.patient_id == patient_id)

        if unpaid_only:
            query = query.where(Invoice.status.in_(["pending", "partially_paid"]))

        query = query.order_by(desc(Invoice.invoice_date))

        result = await self.db.execute(query)
        invoices = result.scalars().all()

        response_list = []
        for inv in invoices:
            # TODO: Get line items from charge_items or invoice_items table
            line_items = [
                PortalInvoiceLineItem(
                    description="Medical Services",
                    quantity=1,
                    unit_price=float(inv.total_amount),
                    total=float(inv.total_amount),
                )
            ]

            response_list.append(
                PortalInvoiceResponse(
                    id=inv.id,
                    invoice_number=inv.invoice_number,
                    invoice_date=inv.invoice_date,
                    due_date=inv.due_date,
                    subtotal=float(inv.subtotal),
                    tax=float(inv.tax_amount),
                    total=float(inv.total_amount),
                    amount_paid=float(inv.amount_paid),
                    balance_due=float(inv.balance_due),
                    status=inv.status,
                    ncf_number=inv.ncf_number,
                    encounter_date=None,  # TODO: Join encounter if needed
                    line_items=line_items,
                    pdf_url=None,  # TODO: Generate invoice PDF URL
                )
            )

        return response_list

    async def get_payment_history(
        self, patient_id: uuid.UUID
    ) -> list[PortalPaymentHistoryResponse]:
        """Get patient payment history."""
        query = (
            select(Payment, Invoice)
            .join(Invoice, Payment.invoice_id == Invoice.id)
            .where(Invoice.patient_id == patient_id)
            .order_by(desc(Payment.payment_date))
        )

        result = await self.db.execute(query)
        payments = result.all()

        return [
            PortalPaymentHistoryResponse(
                id=payment.id,
                payment_date=payment.payment_date,
                amount=float(payment.amount),
                payment_method=payment.payment_method,
                reference_number=payment.transaction_reference,
                invoice_number=invoice.invoice_number,
            )
            for payment, invoice in payments
        ]

    # ============= Dashboard =============

    async def get_dashboard_data(
        self, patient_id: uuid.UUID
    ) -> PortalDashboardResponse:
        """Get complete dashboard data for patient."""
        # Stats
        upcoming_appts = await self.db.scalar(
            select(func.count(Appointment.id)).where(
                and_(
                    Appointment.patient_id == patient_id,
                    Appointment.scheduled_start >= datetime.utcnow(),
                    Appointment.status.in_(["scheduled", "confirmed"]),
                )
            )
        )

        pending_prescriptions = await self.db.scalar(
            select(func.count(Prescription.id))
            .join(Encounter)
            .where(
                and_(
                    Encounter.patient_id == patient_id,
                    Prescription.status == "active",
                    Prescription.refills_remaining > 0,
                )
            )
        )

        outstanding_balance = await self.db.scalar(
            select(func.coalesce(func.sum(Invoice.balance_due), 0)).where(
                and_(
                    Invoice.patient_id == patient_id,
                    Invoice.status.in_(["pending", "partially_paid"]),
                )
            )
        )

        last_visit = await self.db.scalar(
            select(Encounter.start_datetime)
            .where(
                and_(
                    Encounter.patient_id == patient_id,
                    Encounter.status == "completed",
                )
            )
            .order_by(desc(Encounter.start_datetime))
            .limit(1)
        )

        stats = PortalDashboardStats(
            upcoming_appointments_count=upcoming_appts or 0,
            pending_prescriptions_count=pending_prescriptions or 0,
            unread_lab_results_count=0,  # TODO: Implement lab results
            outstanding_balance=float(outstanding_balance or 0),
            last_visit_date=last_visit,
        )

        # Upcoming appointments (next 3)
        upcoming_appointments = await self.get_patient_appointments(patient_id)
        upcoming_appointments = upcoming_appointments[:3]

        # Recent alerts
        alerts_query = (
            select(PortalNotification)
            .where(PortalNotification.patient_id == patient_id)
            .order_by(desc(PortalNotification.created_at))
            .limit(5)
        )
        result = await self.db.execute(alerts_query)
        notifications = result.scalars().all()

        alerts = [
            PortalDashboardAlert(
                id=str(notif.id),
                type=notif.notification_type,
                title=notif.title,
                message=notif.message,
                severity=notif.severity,
                created_at=notif.created_at,
                action_url=notif.action_url,
            )
            for notif in notifications
        ]

        return PortalDashboardResponse(
            stats=stats,
            upcoming_appointments=upcoming_appointments,
            recent_alerts=alerts,
        )
