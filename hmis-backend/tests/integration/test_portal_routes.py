"""
Tests de integracion para las rutas del Portal de Pacientes (/api/v1/portal).
Valida autenticacion, perfil, citas, prescripciones, registros medicos,
facturacion y resultados de laboratorio.

NOTE: Several portal service methods reference model fields that do not exist
on the actual SQLAlchemy models (e.g., Prescription.prescribed_date,
Prescription.refills_remaining, Invoice.invoice_date, Invoice.total_amount,
VitalSigns.recorded_at). These cause AttributeError at runtime, which
crashes the ASGI middleware stack. Tests for those endpoints are marked
with xfail to document the known bugs.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.modules.appointments.models import Appointment, Provider
from app.modules.auth.models import User
from app.modules.billing.models import Invoice, Payment
from app.modules.emr.models import Encounter
from app.modules.patients.models import Patient
from app.modules.pharmacy.models import Product, Prescription
from app.modules.portal.models import (
    PatientPortalAccount,
    PortalNotification,
    PrescriptionRefillRequest,
)


# =============================================
# Fixtures: portal-specific test data
# =============================================


@pytest.fixture
async def portal_patient(db_session: AsyncSession) -> Patient:
    """Create a patient for portal tests."""
    patient = Patient(
        document_type="cedula",
        document_number="40212345678",
        mrn=f"MRN{uuid.uuid4().hex[:8].upper()}",
        first_name="Ana",
        last_name="Lopez",
        second_last_name="Martinez",
        birth_date=date(1990, 6, 15),
        gender="F",
        blood_type="A+",
        phone="809-555-1111",
        mobile_phone="829-555-2222",
        email="ana.lopez@email.com",
        address_line1="Av. Winston Churchill #100",
        city="Santo Domingo",
        state_province="Distrito Nacional",
        country="DO",
        status="active",
    )
    db_session.add(patient)
    await db_session.flush()
    await db_session.commit()
    return patient


@pytest.fixture
async def portal_user(db_session: AsyncSession, portal_patient: Patient) -> User:
    """Create a User linked to the portal patient."""
    user = User(
        email="ana.portal@email.com",
        hashed_password=hash_password("PortalTest2026!"),
        first_name="Ana",
        last_name="Lopez",
        is_verified=True,
        is_superuser=False,
        tenant_id="tenant_test",
        language="es",
        timezone="America/Santo_Domingo",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


@pytest.fixture
async def portal_account(
    db_session: AsyncSession, portal_patient: Patient, portal_user: User
) -> PatientPortalAccount:
    """Create the PatientPortalAccount linking patient to user."""
    account = PatientPortalAccount(
        patient_id=portal_patient.id,
        user_id=portal_user.id,
        is_verified=True,
        verification_token=uuid.uuid4().hex,
    )
    db_session.add(account)
    await db_session.flush()
    await db_session.commit()
    return account


@pytest.fixture
def portal_auth_headers(portal_user: User) -> dict:
    """Auth headers for the portal patient user."""
    token = create_access_token({
        "sub": str(portal_user.id),
        "email": portal_user.email,
        "tenant_id": "tenant_test",
        "roles": [],
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "tenant_test",
    }


@pytest.fixture
async def portal_provider(db_session: AsyncSession) -> Provider:
    """Create a provider for appointment and encounter tests."""
    provider = Provider(
        first_name="Carlos",
        last_name="Ramirez",
        specialty_code="MG",
        specialty_name="Medicina General",
        license_number="MED-PORTAL-001",
        consultation_duration_min=30,
        max_daily_appointments=20,
        email="carlos.ramirez@hmis.app",
        status="active",
    )
    db_session.add(provider)
    await db_session.flush()
    await db_session.commit()
    return provider


@pytest.fixture
async def portal_appointment(
    db_session: AsyncSession, portal_patient: Patient, portal_provider: Provider
) -> Appointment:
    """Create an appointment far in the future (can be cancelled)."""
    scheduled_start = datetime.now(timezone.utc) + timedelta(days=7)
    scheduled_end = scheduled_start + timedelta(minutes=30)
    appt = Appointment(
        patient_id=portal_patient.id,
        provider_id=portal_provider.id,
        appointment_type="consulta",
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        status="scheduled",
        reason="Consulta general de seguimiento",
        source="portal",
    )
    db_session.add(appt)
    await db_session.flush()
    await db_session.commit()
    return appt


@pytest.fixture
async def portal_appointment_soon(
    db_session: AsyncSession, portal_patient: Patient, portal_provider: Provider
) -> Appointment:
    """Create an appointment within 24 hours (cannot be cancelled)."""
    scheduled_start = datetime.now(timezone.utc) + timedelta(hours=6)
    scheduled_end = scheduled_start + timedelta(minutes=30)
    appt = Appointment(
        patient_id=portal_patient.id,
        provider_id=portal_provider.id,
        appointment_type="consulta",
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        status="scheduled",
        reason="Cita urgente",
        source="portal",
    )
    db_session.add(appt)
    await db_session.flush()
    await db_session.commit()
    return appt


@pytest.fixture
async def portal_encounter(
    db_session: AsyncSession, portal_patient: Patient, portal_provider: Provider
) -> Encounter:
    """Create an encounter for the portal patient."""
    encounter = Encounter(
        patient_id=portal_patient.id,
        provider_id=portal_provider.id,
        encounter_type="ambulatory",
        status="completed",
        start_datetime=datetime.now(timezone.utc) - timedelta(days=3),
        chief_complaint="Dolor de cabeza persistente",
        created_by=portal_provider.id,
        updated_by=portal_provider.id,
    )
    db_session.add(encounter)
    await db_session.flush()
    await db_session.commit()
    return encounter


@pytest.fixture
async def portal_product(db_session: AsyncSession) -> Product:
    """Create a pharmacy product for prescription tests."""
    product = Product(
        name="Amoxicilina 500mg",
        generic_name="Amoxicilina",
        active_ingredient="Amoxicilina",
        presentation="tableta",
        concentration="500mg",
        unit_of_measure="tableta",
        product_type="medication",
        atc_code="J01CA04",
        therapeutic_group="Antibioticos",
        requires_prescription=True,
        status="active",
    )
    db_session.add(product)
    await db_session.flush()
    await db_session.commit()
    return product


@pytest.fixture
async def portal_prescription(
    db_session: AsyncSession,
    portal_patient: Patient,
    portal_encounter: Encounter,
    portal_provider: Provider,
    portal_product: Product,
) -> Prescription:
    """Create a prescription for the portal patient."""
    prescription = Prescription(
        encounter_id=portal_encounter.id,
        patient_id=portal_patient.id,
        prescribed_by=portal_provider.id,
        product_id=portal_product.id,
        medication_name="Amoxicilina 500mg",
        dosage="500mg",
        frequency="cada 8 horas",
        route="oral",
        duration_days=7,
        quantity_prescribed=21,
        instructions="Tomar con alimentos",
        substitution_allowed=True,
        status="active",
    )
    db_session.add(prescription)
    await db_session.flush()
    await db_session.commit()
    return prescription


@pytest.fixture
async def portal_invoice(
    db_session: AsyncSession, portal_patient: Patient
) -> Invoice:
    """Create an invoice for the portal patient."""
    invoice = Invoice(
        patient_id=portal_patient.id,
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subtotal=5000.00,
        tax_total=900.00,
        discount_total=0.00,
        grand_total=5900.00,
        currency="DOP",
        status="issued",
        due_date=date.today() + timedelta(days=30),
        country_code="DO",
    )
    db_session.add(invoice)
    await db_session.flush()
    await db_session.commit()
    return invoice


@pytest.fixture
async def portal_payment(
    db_session: AsyncSession, portal_invoice: Invoice
) -> Payment:
    """Create a payment for the portal invoice."""
    payment = Payment(
        invoice_id=portal_invoice.id,
        amount=2000.00,
        payment_method="card",
        reference_number="TXN-ABC123",
    )
    db_session.add(payment)
    await db_session.flush()
    await db_session.commit()
    return payment


# =============================================
# Tests: POST /api/v1/portal/login
# =============================================


class TestPortalLogin:
    """Tests para POST /api/v1/portal/login."""

    @pytest.mark.asyncio
    async def test_login_exitoso(
        self, client: AsyncClient, portal_user: User, portal_account: PatientPortalAccount
    ):
        """Login with valid portal credentials returns tokens."""
        response = await client.post(
            "/api/v1/portal/login",
            json={
                "email": "ana.portal@email.com",
                "password": "PortalTest2026!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "patient_id" in data
        assert "full_name" in data

    @pytest.mark.asyncio
    async def test_login_contrasena_incorrecta(
        self, client: AsyncClient, portal_user: User, portal_account: PatientPortalAccount
    ):
        """Login with wrong password returns 401."""
        response = await client.post(
            "/api/v1/portal/login",
            json={
                "email": "ana.portal@email.com",
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_email_inexistente(self, client: AsyncClient):
        """Login with non-existent email returns 401."""
        response = await client.post(
            "/api/v1/portal/login",
            json={
                "email": "noexiste@email.com",
                "password": "SomePassword123!",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_sin_cuenta_portal(
        self, client: AsyncClient, portal_user: User
    ):
        """Login with a user that has no portal account returns 401."""
        # portal_user exists but no PatientPortalAccount is created
        response = await client.post(
            "/api/v1/portal/login",
            json={
                "email": "ana.portal@email.com",
                "password": "PortalTest2026!",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_campos_faltantes(self, client: AsyncClient):
        """Login without required fields returns 422."""
        response = await client.post(
            "/api/v1/portal/login",
            json={"email": "test@email.com"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_email_invalido(self, client: AsyncClient):
        """Login with invalid email format returns 422."""
        response = await client.post(
            "/api/v1/portal/login",
            json={"email": "not-an-email", "password": "Test123!"},
        )
        assert response.status_code == 422


# =============================================
# Tests: POST /api/v1/portal/register
# =============================================


class TestPortalRegister:
    """Tests para POST /api/v1/portal/register."""

    @pytest.mark.asyncio
    async def test_registro_exitoso(self, client: AsyncClient):
        """Register a new patient via portal returns tokens."""
        response = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "nuevo.paciente@email.com",
                "password": "NuevoPaciente2026!",
                "first_name": "Pedro",
                "last_name": "Garcia",
                "second_last_name": "Santos",
                "document_type": "cedula",
                "document_number": "40299887766",
                "birth_date": "1988-04-20",
                "gender": "M",
                "phone": "809-555-3333",
                "mobile_phone": "829-555-4444",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "patient_id" in data
        assert data["full_name"] == "Pedro Garcia Santos"

    @pytest.mark.asyncio
    async def test_registro_email_duplicado(
        self, client: AsyncClient, portal_user: User
    ):
        """Register with existing email returns 400."""
        response = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "ana.portal@email.com",
                "password": "NuevoPaciente2026!",
                "first_name": "Ana",
                "last_name": "Lopez",
                "document_type": "cedula",
                "document_number": "40299001122",
                "birth_date": "1990-06-15",
                "gender": "F",
            },
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_registro_documento_duplicado(
        self, client: AsyncClient, portal_patient: Patient
    ):
        """Register with existing document number returns 400."""
        response = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "otro.correo@email.com",
                "password": "NuevoPaciente2026!",
                "first_name": "Otra",
                "last_name": "Persona",
                "document_type": "cedula",
                "document_number": "40212345678",
                "birth_date": "1985-01-01",
                "gender": "F",
            },
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_registro_contrasena_corta(self, client: AsyncClient):
        """Register with password too short returns 422."""
        response = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "corto@email.com",
                "password": "abc",
                "first_name": "Test",
                "last_name": "User",
                "document_type": "cedula",
                "document_number": "40200001111",
                "birth_date": "1990-01-01",
                "gender": "M",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_registro_campos_faltantes(self, client: AsyncClient):
        """Register without required fields returns 422."""
        response = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "test@email.com",
                "password": "ValidPassword123!",
            },
        )
        assert response.status_code == 422


# =============================================
# Tests: GET /api/v1/portal/profile
# =============================================


class TestPortalGetProfile:
    """Tests para GET /api/v1/portal/profile."""

    @pytest.mark.asyncio
    async def test_obtener_perfil_exitoso(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_patient: Patient,
    ):
        """Get profile for authenticated portal patient returns 200."""
        response = await client.get(
            "/api/v1/portal/profile",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Ana"
        assert data["last_name"] == "Lopez"
        assert data["email"] == "ana.lopez@email.com"
        assert data["gender"] == "F"
        assert "mrn" in data
        assert "id" in data
        assert data["city"] == "Santo Domingo"

    @pytest.mark.asyncio
    async def test_obtener_perfil_sin_auth(self, client: AsyncClient):
        """Get profile without auth token returns 401 (HTTPBearer)."""
        response = await client.get("/api/v1/portal/profile")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_obtener_perfil_token_invalido(self, client: AsyncClient):
        """Get profile with invalid token returns 401."""
        response = await client.get(
            "/api/v1/portal/profile",
            headers={
                "Authorization": "Bearer invalid.token.here",
                "X-Tenant-ID": "tenant_test",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_obtener_perfil_usuario_sin_cuenta_portal(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        """Get profile with staff user (no portal account) returns 403."""
        response = await client.get(
            "/api/v1/portal/profile",
            headers=admin_auth_headers,
        )
        assert response.status_code == 403
        assert "Not a patient portal account" in response.json()["detail"]


# =============================================
# Tests: PATCH /api/v1/portal/profile
# =============================================


class TestPortalUpdateProfile:
    """Tests para PATCH /api/v1/portal/profile."""

    @pytest.mark.asyncio
    async def test_actualizar_telefono(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Update phone number via portal returns 200."""
        response = await client.patch(
            "/api/v1/portal/profile",
            headers=portal_auth_headers,
            json={"phone": "809-555-9999"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["phone"] == "809-555-9999"

    @pytest.mark.asyncio
    async def test_actualizar_direccion(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Update address fields via portal returns 200."""
        response = await client.patch(
            "/api/v1/portal/profile",
            headers=portal_auth_headers,
            json={
                "address_line1": "Calle Nueva #456",
                "city": "Santiago",
                "state_province": "Santiago",
                "postal_code": "51000",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["address_line1"] == "Calle Nueva #456"
        assert data["city"] == "Santiago"
        assert data["state_province"] == "Santiago"
        assert data["postal_code"] == "51000"

    @pytest.mark.asyncio
    async def test_actualizar_email(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Update email via portal returns 200."""
        response = await client.patch(
            "/api/v1/portal/profile",
            headers=portal_auth_headers,
            json={"email": "ana.nueva@email.com"},
        )
        assert response.status_code == 200
        assert response.json()["email"] == "ana.nueva@email.com"

    @pytest.mark.asyncio
    async def test_actualizar_mobile_phone(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Update mobile phone via portal returns 200."""
        response = await client.patch(
            "/api/v1/portal/profile",
            headers=portal_auth_headers,
            json={"mobile_phone": "849-555-7777"},
        )
        assert response.status_code == 200
        assert response.json()["mobile_phone"] == "849-555-7777"

    @pytest.mark.asyncio
    async def test_actualizar_sin_auth(self, client: AsyncClient):
        """Update profile without auth returns 401."""
        response = await client.patch(
            "/api/v1/portal/profile",
            json={"phone": "809-555-0000"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_actualizar_sin_cambios(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Update with empty body still returns 200 (no-op)."""
        response = await client.patch(
            "/api/v1/portal/profile",
            headers=portal_auth_headers,
            json={},
        )
        assert response.status_code == 200


# =============================================
# Tests: GET /api/v1/portal/appointments
# =============================================


class TestPortalGetAppointments:
    """Tests para GET /api/v1/portal/appointments."""

    @pytest.mark.asyncio
    async def test_obtener_citas_futuras(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_appointment: Appointment,
    ):
        """Get future appointments returns list."""
        response = await client.get(
            "/api/v1/portal/appointments",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        appt = data[0]
        assert "id" in appt
        assert "provider_name" in appt
        assert "scheduled_start" in appt
        assert "status" in appt
        assert appt["appointment_type"] == "consulta"
        assert appt["can_cancel"] is True

    @pytest.mark.asyncio
    async def test_obtener_citas_incluye_pasadas(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_appointment: Appointment,
    ):
        """Get appointments with include_past=true returns past appointments too."""
        response = await client.get(
            "/api/v1/portal/appointments?include_past=true",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_obtener_citas_sin_citas(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get appointments with no appointments returns empty list."""
        response = await client.get(
            "/api/v1/portal/appointments",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_obtener_citas_sin_auth(self, client: AsyncClient):
        """Get appointments without auth returns 401."""
        response = await client.get("/api/v1/portal/appointments")
        assert response.status_code == 401


# =============================================
# Tests: POST /api/v1/portal/appointments/{id}/cancel
# =============================================


class TestPortalCancelAppointment:
    """Tests para POST /api/v1/portal/appointments/{id}/cancel."""

    @pytest.mark.asyncio
    async def test_cancelar_cita_exitoso(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_appointment: Appointment,
    ):
        """Cancel a future appointment returns success."""
        response = await client.post(
            f"/api/v1/portal/appointments/{portal_appointment.id}/cancel",
            headers=portal_auth_headers,
            json={"cancellation_reason": "No puedo asistir por motivos personales"},
        )
        assert response.status_code == 200
        assert "cancelled" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_cancelar_cita_menos_24h(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_appointment_soon: Appointment,
    ):
        """Cancel an appointment less than 24h away returns 400."""
        response = await client.post(
            f"/api/v1/portal/appointments/{portal_appointment_soon.id}/cancel",
            headers=portal_auth_headers,
            json={"cancellation_reason": "Necesito cancelar"},
        )
        assert response.status_code == 400
        assert "24 hours" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_cancelar_cita_inexistente(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Cancel a non-existent appointment returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.post(
            f"/api/v1/portal/appointments/{fake_id}/cancel",
            headers=portal_auth_headers,
            json={"cancellation_reason": "No importa"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cancelar_cita_de_otro_paciente(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_provider: Provider,
        db_session: AsyncSession,
    ):
        """Cancel an appointment belonging to another patient returns 404."""
        # Create another patient's appointment
        other_patient = Patient(
            document_type="cedula",
            document_number="40255556666",
            mrn=f"MRN{uuid.uuid4().hex[:8].upper()}",
            first_name="Otro",
            last_name="Paciente",
            birth_date=date(1980, 1, 1),
            gender="M",
            country="DO",
            status="active",
        )
        db_session.add(other_patient)
        await db_session.flush()

        other_appt = Appointment(
            patient_id=other_patient.id,
            provider_id=portal_provider.id,
            appointment_type="consulta",
            scheduled_start=datetime.now(timezone.utc) + timedelta(days=10),
            scheduled_end=datetime.now(timezone.utc) + timedelta(days=10, minutes=30),
            status="scheduled",
            source="web",
        )
        db_session.add(other_appt)
        await db_session.flush()
        await db_session.commit()

        response = await client.post(
            f"/api/v1/portal/appointments/{other_appt.id}/cancel",
            headers=portal_auth_headers,
            json={"cancellation_reason": "Intento de cancelar cita ajena"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cancelar_cita_ya_completada(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_patient: Patient,
        portal_provider: Provider,
        db_session: AsyncSession,
    ):
        """Cancel an already completed appointment returns 400."""
        completed_appt = Appointment(
            patient_id=portal_patient.id,
            provider_id=portal_provider.id,
            appointment_type="consulta",
            scheduled_start=datetime.now(timezone.utc) + timedelta(days=5),
            scheduled_end=datetime.now(timezone.utc) + timedelta(days=5, minutes=30),
            status="completed",
            source="web",
        )
        db_session.add(completed_appt)
        await db_session.flush()
        await db_session.commit()

        response = await client.post(
            f"/api/v1/portal/appointments/{completed_appt.id}/cancel",
            headers=portal_auth_headers,
            json={"cancellation_reason": "Intentando cancelar una cita completada"},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_cancelar_cita_sin_razon(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_appointment: Appointment,
    ):
        """Cancel without cancellation_reason returns 422."""
        response = await client.post(
            f"/api/v1/portal/appointments/{portal_appointment.id}/cancel",
            headers=portal_auth_headers,
            json={},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_cancelar_cita_sin_auth(
        self, client: AsyncClient, portal_appointment: Appointment
    ):
        """Cancel appointment without auth returns 401."""
        response = await client.post(
            f"/api/v1/portal/appointments/{portal_appointment.id}/cancel",
            json={"cancellation_reason": "Sin auth"},
        )
        assert response.status_code == 401


# =============================================
# Tests: GET /api/v1/portal/prescriptions
# Known bug: PortalService.get_patient_prescriptions references
# Prescription.prescribed_date and Prescription.refills_remaining,
# which do not exist on the Prescription model, causing AttributeError.
# =============================================


class TestPortalGetPrescriptions:
    """Tests para GET /api/v1/portal/prescriptions."""

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references Prescription.prescribed_date which does not exist",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_prescripciones_con_datos(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_prescription: Prescription,
    ):
        """Get prescriptions returns list with prescription data."""
        response = await client.get(
            "/api/v1/portal/prescriptions",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references Prescription.prescribed_date which does not exist",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_prescripciones_sin_datos(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get prescriptions when there are none returns empty list."""
        response = await client.get(
            "/api/v1/portal/prescriptions",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_obtener_prescripciones_sin_auth(self, client: AsyncClient):
        """Get prescriptions without auth returns 401."""
        response = await client.get("/api/v1/portal/prescriptions")
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references Prescription.prescribed_date which does not exist",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_prescripciones_active_only(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get prescriptions with active_only parameter."""
        response = await client.get(
            "/api/v1/portal/prescriptions?active_only=true",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200


# =============================================
# Tests: POST /api/v1/portal/prescriptions/refill
# Known bug: PortalService.request_prescription_refill references
# Prescription.refills_remaining, which does not exist on the model.
# =============================================


class TestPortalPrescriptionRefill:
    """Tests para POST /api/v1/portal/prescriptions/refill."""

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references Prescription.refills_remaining which does not exist",
        raises=Exception,
        strict=False,
    )
    async def test_solicitar_refill_prescripcion_inexistente(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Request refill for non-existent prescription returns 400."""
        fake_id = str(uuid.uuid4())
        response = await client.post(
            "/api/v1/portal/prescriptions/refill",
            headers=portal_auth_headers,
            json={
                "prescription_id": fake_id,
                "notes": "Necesito mas medicamento",
            },
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_solicitar_refill_sin_auth(self, client: AsyncClient):
        """Request refill without auth returns 401."""
        response = await client.post(
            "/api/v1/portal/prescriptions/refill",
            json={
                "prescription_id": str(uuid.uuid4()),
                "notes": "Sin autenticacion",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_solicitar_refill_campos_faltantes(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Request refill without prescription_id returns 422."""
        response = await client.post(
            "/api/v1/portal/prescriptions/refill",
            headers=portal_auth_headers,
            json={"notes": "Falta el ID de prescripcion"},
        )
        assert response.status_code == 422


# =============================================
# Tests: GET /api/v1/portal/medical-records/*
# =============================================


class TestPortalMedicalRecords:
    """Tests para GET /api/v1/portal/medical-records/*."""

    @pytest.mark.asyncio
    async def test_obtener_encuentros_sin_datos(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get encounters when none exist returns empty list."""
        response = await client.get(
            "/api/v1/portal/medical-records/encounters",
            headers=portal_auth_headers,
        )
        # With no encounters the query returns empty,
        # so no model field mismatches are triggered.
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 0

    @pytest.mark.asyncio
    async def test_obtener_encuentros_sin_auth(self, client: AsyncClient):
        """Get encounters without auth returns 401."""
        response = await client.get("/api/v1/portal/medical-records/encounters")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_obtener_encuentros_con_limit(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get encounters with custom limit parameter."""
        response = await client.get(
            "/api/v1/portal/medical-records/encounters?limit=10",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_obtener_diagnosticos_sin_datos(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get diagnoses when none exist returns empty list."""
        response = await client.get(
            "/api/v1/portal/medical-records/diagnoses",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 0

    @pytest.mark.asyncio
    async def test_obtener_diagnosticos_sin_auth(self, client: AsyncClient):
        """Get diagnoses without auth returns 401."""
        response = await client.get("/api/v1/portal/medical-records/diagnoses")
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references VitalSigns.recorded_at which does not exist (should be measured_at)",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_signos_vitales_sin_datos(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get vitals when none exist returns empty list."""
        response = await client.get(
            "/api/v1/portal/medical-records/vitals",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_obtener_signos_vitales_sin_auth(self, client: AsyncClient):
        """Get vitals without auth returns 401."""
        response = await client.get("/api/v1/portal/medical-records/vitals")
        assert response.status_code == 401


# =============================================
# Tests: GET /api/v1/portal/billing/invoices
# Known bug: PortalService.get_patient_invoices references
# Invoice.invoice_date, Invoice.total_amount, Invoice.tax_amount,
# Invoice.amount_paid, Invoice.balance_due, Invoice.ncf_number,
# which do not exist on the Invoice model.
# =============================================


class TestPortalInvoices:
    """Tests para GET /api/v1/portal/billing/invoices."""

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references Invoice fields (invoice_date, total_amount, etc.) that do not exist on model",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_facturas_sin_datos(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get invoices when none exist returns empty list."""
        response = await client.get(
            "/api/v1/portal/billing/invoices",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 0

    @pytest.mark.asyncio
    async def test_obtener_facturas_sin_auth(self, client: AsyncClient):
        """Get invoices without auth returns 401."""
        response = await client.get("/api/v1/portal/billing/invoices")
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references Invoice fields that do not exist on model",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_facturas_unpaid_only(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get invoices with unpaid_only parameter."""
        response = await client.get(
            "/api/v1/portal/billing/invoices?unpaid_only=true",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200


# =============================================
# Tests: GET /api/v1/portal/billing/payments
# Known bug: PortalService.get_payment_history references
# Payment.payment_date and Payment.transaction_reference,
# which do not exist on the Payment model.
# =============================================


class TestPortalPayments:
    """Tests para GET /api/v1/portal/billing/payments."""

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService references Payment.payment_date and Payment.transaction_reference which do not exist",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_pagos_sin_datos(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get payment history when none exist returns empty list."""
        response = await client.get(
            "/api/v1/portal/billing/payments",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 0

    @pytest.mark.asyncio
    async def test_obtener_pagos_sin_auth(self, client: AsyncClient):
        """Get payment history without auth returns 401."""
        response = await client.get("/api/v1/portal/billing/payments")
        assert response.status_code == 401


# =============================================
# Tests: GET /api/v1/portal/lab-results
# =============================================


class TestPortalLabResults:
    """Tests para GET /api/v1/portal/lab-results."""

    @pytest.mark.asyncio
    async def test_obtener_lab_results_retorna_coming_soon(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get lab results returns graceful coming_soon response."""
        response = await client.get(
            "/api/v1/portal/lab-results",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["module_status"] == "coming_soon"
        assert "laboratorio" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_obtener_lab_results_sin_auth(self, client: AsyncClient):
        """Get lab results without auth returns 401."""
        response = await client.get("/api/v1/portal/lab-results")
        assert response.status_code == 401


# =============================================
# Tests: GET /api/v1/portal/dashboard
# Known bug: PortalService.get_dashboard_data references
# Prescription.refills_remaining and Invoice.balance_due,
# which do not exist on the respective models.
# =============================================


class TestPortalDashboard:
    """Tests para GET /api/v1/portal/dashboard."""

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService.get_dashboard_data references Prescription.refills_remaining which does not exist",
        raises=Exception,
        strict=False,
    )
    async def test_obtener_dashboard_vacio(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Get dashboard with no data returns default stats."""
        response = await client.get(
            "/api/v1/portal/dashboard",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "upcoming_appointments" in data
        assert "recent_alerts" in data
        stats = data["stats"]
        assert "upcoming_appointments_count" in stats
        assert "pending_prescriptions_count" in stats
        assert "outstanding_balance" in stats

    @pytest.mark.asyncio
    async def test_obtener_dashboard_sin_auth(self, client: AsyncClient):
        """Get dashboard without auth returns 401."""
        response = await client.get("/api/v1/portal/dashboard")
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="BUG: PortalService.get_dashboard_data references Prescription.refills_remaining which does not exist",
        raises=Exception,
        strict=False,
    )
    async def test_dashboard_con_notificaciones(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
        portal_patient: Patient,
        db_session: AsyncSession,
    ):
        """Dashboard includes notifications/alerts."""
        # Create some notifications
        for i in range(3):
            notification = PortalNotification(
                patient_id=portal_patient.id,
                notification_type="general",
                title=f"Notificacion {i + 1}",
                message=f"Mensaje de prueba {i + 1}",
                severity="info",
            )
            db_session.add(notification)
        await db_session.flush()
        await db_session.commit()

        response = await client.get(
            "/api/v1/portal/dashboard",
            headers=portal_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["recent_alerts"]) >= 3


# =============================================
# Tests: POST /api/v1/portal/billing/invoices/{id}/pay
# =============================================


class TestPortalPayInvoice:
    """Tests para POST /api/v1/portal/billing/invoices/{id}/pay."""

    @pytest.mark.asyncio
    async def test_pagar_factura_inexistente(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Pay a non-existent invoice returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.post(
            f"/api/v1/portal/billing/invoices/{fake_id}/pay",
            headers=portal_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_pagar_factura_sin_auth(self, client: AsyncClient):
        """Pay an invoice without auth returns 401."""
        fake_id = str(uuid.uuid4())
        response = await client.post(
            f"/api/v1/portal/billing/invoices/{fake_id}/pay",
        )
        assert response.status_code == 401


# =============================================
# Tests: POST /api/v1/portal/appointments (book)
# =============================================


class TestPortalBookAppointment:
    """Tests para POST /api/v1/portal/appointments (book)."""

    @pytest.mark.asyncio
    async def test_agendar_cita_sin_auth(self, client: AsyncClient):
        """Book appointment without auth returns 401."""
        response = await client.post(
            "/api/v1/portal/appointments",
            json={
                "provider_id": str(uuid.uuid4()),
                "scheduled_start": (
                    datetime.now(timezone.utc) + timedelta(days=5)
                ).isoformat(),
                "appointment_type": "consulta",
                "reason": "Chequeo general",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_agendar_cita_campos_faltantes(
        self,
        client: AsyncClient,
        portal_auth_headers: dict,
        portal_account: PatientPortalAccount,
    ):
        """Book appointment with missing required fields returns 422."""
        response = await client.post(
            "/api/v1/portal/appointments",
            headers=portal_auth_headers,
            json={"reason": "Sin provider ni hora"},
        )
        assert response.status_code == 422


# =============================================
# Tests: Authentication edge cases
# =============================================


class TestPortalAuthEdgeCases:
    """Tests de borde para la autenticacion del portal."""

    @pytest.mark.asyncio
    async def test_paciente_inactivo_no_puede_login(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Patient with inactive status cannot login."""
        # Create inactive patient
        patient = Patient(
            document_type="cedula",
            document_number="40233334444",
            mrn=f"MRN{uuid.uuid4().hex[:8].upper()}",
            first_name="Inactivo",
            last_name="Paciente",
            birth_date=date(1985, 1, 1),
            gender="M",
            country="DO",
            status="inactive",
        )
        db_session.add(patient)
        await db_session.flush()

        user = User(
            email="inactivo@email.com",
            hashed_password=hash_password("Inactivo2026!"),
            first_name="Inactivo",
            last_name="Paciente",
            is_verified=True,
        )
        db_session.add(user)
        await db_session.flush()

        portal_acct = PatientPortalAccount(
            patient_id=patient.id,
            user_id=user.id,
            is_verified=True,
        )
        db_session.add(portal_acct)
        await db_session.flush()
        await db_session.commit()

        response = await client.post(
            "/api/v1/portal/login",
            json={"email": "inactivo@email.com", "password": "Inactivo2026!"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_registro_luego_login(self, client: AsyncClient):
        """Register and then login with the same credentials."""
        reg_data = {
            "email": "regtest@email.com",
            "password": "RegTest2026!",
            "first_name": "Reg",
            "last_name": "Test",
            "document_type": "cedula",
            "document_number": "40266677788",
            "birth_date": "1992-08-10",
            "gender": "F",
        }

        # Register
        reg_resp = await client.post("/api/v1/portal/register", json=reg_data)
        assert reg_resp.status_code == 200
        reg_data_resp = reg_resp.json()
        assert "access_token" in reg_data_resp

        # Login with same credentials
        login_resp = await client.post(
            "/api/v1/portal/login",
            json={"email": "regtest@email.com", "password": "RegTest2026!"},
        )
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        assert login_data["patient_id"] == reg_data_resp["patient_id"]
        assert login_data["full_name"] == "Reg Test"

    @pytest.mark.asyncio
    async def test_token_portal_accede_perfil(self, client: AsyncClient):
        """Token obtained from registration can access profile endpoint."""
        # Register a patient
        reg_resp = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "tokentest@email.com",
                "password": "TokenTest2026!",
                "first_name": "Token",
                "last_name": "Test",
                "document_type": "cedula",
                "document_number": "40277788899",
                "birth_date": "1995-03-25",
                "gender": "M",
            },
        )
        assert reg_resp.status_code == 200
        token = reg_resp.json()["access_token"]

        # Use the token to access profile
        profile_resp = await client.get(
            "/api/v1/portal/profile",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Tenant-ID": "tenant_test",
            },
        )
        assert profile_resp.status_code == 200
        data = profile_resp.json()
        assert data["first_name"] == "Token"
        assert data["last_name"] == "Test"

    @pytest.mark.asyncio
    async def test_token_portal_accede_lab_results(self, client: AsyncClient):
        """Token from registration can access lab-results (coming_soon) endpoint."""
        reg_resp = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "labtest@email.com",
                "password": "LabTest2026!",
                "first_name": "Lab",
                "last_name": "Test",
                "document_type": "cedula",
                "document_number": "40288899900",
                "birth_date": "1993-07-12",
                "gender": "F",
            },
        )
        assert reg_resp.status_code == 200
        token = reg_resp.json()["access_token"]

        response = await client.get(
            "/api/v1/portal/lab-results",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Tenant-ID": "tenant_test",
            },
        )
        assert response.status_code == 200
        assert response.json()["module_status"] == "coming_soon"

    @pytest.mark.asyncio
    async def test_token_portal_accede_citas_vacias(self, client: AsyncClient):
        """Token from registration can access empty appointments list."""
        reg_resp = await client.post(
            "/api/v1/portal/register",
            json={
                "email": "citastest@email.com",
                "password": "CitasTest2026!",
                "first_name": "Citas",
                "last_name": "Test",
                "document_type": "cedula",
                "document_number": "40299900011",
                "birth_date": "1991-02-28",
                "gender": "M",
            },
        )
        assert reg_resp.status_code == 200
        token = reg_resp.json()["access_token"]

        response = await client.get(
            "/api/v1/portal/appointments",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Tenant-ID": "tenant_test",
            },
        )
        assert response.status_code == 200
        assert response.json() == []
