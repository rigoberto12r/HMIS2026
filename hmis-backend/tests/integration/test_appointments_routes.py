"""
Tests de integracion para las rutas de citas (/api/v1/appointments).
Valida CRUD completo, transiciones de estado, conflictos, estadisticas,
proveedores, horarios, bloqueos, lista de espera y check-in.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


# =============================================
# Helpers para generar datos de prueba
# =============================================


def _provider_data(suffix: str = "001") -> dict:
    """Genera datos para crear un proveedor."""
    return {
        "first_name": "Dr. Carlos",
        "last_name": f"Martinez-{suffix}",
        "specialty_code": "MED-GEN",
        "specialty_name": "Medicina General",
        "license_number": f"LIC-{suffix}",
        "consultation_duration_min": 30,
        "max_daily_appointments": 20,
        "phone": "809-555-0100",
        "email": f"dr.martinez.{suffix}@hospital.com",
    }


def _future_datetime(days: int = 1, hour: int = 9, minute: int = 0) -> str:
    """Genera un datetime ISO futuro para citas."""
    dt = datetime.now(timezone.utc).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    ) + timedelta(days=days)
    return dt.isoformat()


def _appointment_data(
    patient_id: str,
    provider_id: str,
    days_ahead: int = 1,
    hour: int = 9,
    duration_min: int = 30,
) -> dict:
    """Genera datos para crear una cita."""
    start = datetime.now(timezone.utc).replace(
        hour=hour, minute=0, second=0, microsecond=0
    ) + timedelta(days=days_ahead)
    end = start + timedelta(minutes=duration_min)
    return {
        "patient_id": patient_id,
        "provider_id": provider_id,
        "appointment_type": "consulta",
        "scheduled_start": start.isoformat(),
        "scheduled_end": end.isoformat(),
        "reason": "Consulta general",
        "notes": "Primera visita",
        "source": "web",
    }


# =============================================
# Fixture: crear proveedor via API
# =============================================


@pytest.fixture
async def created_provider(client: AsyncClient, admin_auth_headers) -> dict:
    """Crea un proveedor via API y retorna su respuesta JSON."""
    response = await client.post(
        "/api/v1/appointments/providers",
        headers=admin_auth_headers,
        json=_provider_data("fixture"),
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def created_patient(db_session: AsyncSession) -> dict:
    """Crea un paciente directamente en la BD (evita incompatibilidad SQLite con MRN counter)."""
    from app.modules.patients.models import Patient

    patient = Patient(
        document_type="cedula",
        document_number=f"001{uuid.uuid4().hex[:8]}",
        first_name="Maria",
        last_name="Lopez",
        birth_date="1990-05-20",
        gender="F",
        phone="809-555-0200",
        email=f"maria.{uuid.uuid4().hex[:6]}@email.com",
        address_line1="Calle 1 #100",
        city="Santo Domingo",
        country="DO",
        mrn=f"HMIS-{uuid.uuid4().hex[:8].upper()}",
    )
    db_session.add(patient)
    await db_session.flush()
    await db_session.commit()

    return {
        "id": str(patient.id),
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "mrn": patient.mrn,
    }


@pytest.fixture
async def created_appointment(
    client: AsyncClient,
    admin_auth_headers,
    created_patient,
    created_provider,
) -> dict:
    """Crea una cita via API y retorna su respuesta JSON."""
    data = _appointment_data(
        patient_id=created_patient["id"],
        provider_id=created_provider["id"],
        days_ahead=2,
        hour=10,
    )
    response = await client.post(
        "/api/v1/appointments",
        headers=admin_auth_headers,
        json=data,
    )
    assert response.status_code == 201
    return response.json()


# =============================================
# Tests de Proveedores
# =============================================


class TestCreateProvider:
    """Tests para POST /api/v1/appointments/providers."""

    @pytest.mark.asyncio
    async def test_crear_proveedor_exitoso(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Crear proveedor con datos validos retorna 201."""
        response = await client.post(
            "/api/v1/appointments/providers",
            headers=admin_auth_headers,
            json=_provider_data("001"),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "Dr. Carlos"
        assert data["last_name"] == "Martinez-001"
        assert data["specialty_code"] == "MED-GEN"
        assert data["license_number"] == "LIC-001"
        assert data["consultation_duration_min"] == 30
        assert data["status"] == "active"
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_crear_proveedor_sin_auth_retorna_401(
        self, client: AsyncClient
    ):
        """Crear proveedor sin token retorna 401."""
        response = await client.post(
            "/api/v1/appointments/providers",
            json=_provider_data("noauth"),
        )
        assert response.status_code == 401


class TestListProviders:
    """Tests para GET /api/v1/appointments/providers."""

    @pytest.mark.asyncio
    async def test_listar_proveedores_vacio(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Listar proveedores sin datos retorna lista vacia paginada."""
        response = await client.get(
            "/api/v1/appointments/providers",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_listar_proveedores_con_datos(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Listar proveedores retorna resultados paginados."""
        # Crear dos proveedores
        await client.post(
            "/api/v1/appointments/providers",
            headers=admin_auth_headers,
            json=_provider_data("prov1"),
        )
        await client.post(
            "/api/v1/appointments/providers",
            headers=admin_auth_headers,
            json=_provider_data("prov2"),
        )

        response = await client.get(
            "/api/v1/appointments/providers",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    @pytest.mark.asyncio
    async def test_listar_proveedores_filtro_especialidad(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Filtrar proveedores por especialidad retorna solo los coincidentes."""
        # Crear proveedor con especialidad especifica
        prov1 = _provider_data("cardio1")
        prov1["specialty_code"] = "CARDIO"
        prov1["specialty_name"] = "Cardiologia"
        await client.post(
            "/api/v1/appointments/providers",
            headers=admin_auth_headers,
            json=prov1,
        )

        prov2 = _provider_data("general1")
        prov2["specialty_code"] = "MED-GEN"
        await client.post(
            "/api/v1/appointments/providers",
            headers=admin_auth_headers,
            json=prov2,
        )

        response = await client.get(
            "/api/v1/appointments/providers?specialty=CARDIO",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["specialty_code"] == "CARDIO"


class TestGetProvider:
    """Tests para GET /api/v1/appointments/providers/{provider_id}."""

    @pytest.mark.asyncio
    async def test_obtener_proveedor_por_id(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Obtener proveedor existente por UUID retorna 200."""
        provider_id = created_provider["id"]
        response = await client.get(
            f"/api/v1/appointments/providers/{provider_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == provider_id

    @pytest.mark.asyncio
    async def test_obtener_proveedor_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Obtener proveedor con UUID inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/appointments/providers/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404


# =============================================
# Tests de Schedule Templates
# =============================================


class TestScheduleTemplates:
    """Tests para POST/GET /api/v1/appointments/schedules."""

    @pytest.mark.asyncio
    async def test_crear_plantilla_horario_exitoso(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Crear plantilla de horario retorna 201."""
        data = {
            "provider_id": created_provider["id"],
            "day_of_week": 0,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
            "slot_duration_min": 30,
            "max_overbooking": 0,
        }
        response = await client.post(
            "/api/v1/appointments/schedules",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 201
        result = response.json()
        assert result["provider_id"] == created_provider["id"]
        assert result["day_of_week"] == 0
        assert result["slot_duration_min"] == 30
        assert result["is_active"] is True

    @pytest.mark.asyncio
    async def test_listar_plantillas_horario(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Listar plantillas retorna las existentes."""
        # Crear dos plantillas para dias diferentes
        for day in [0, 2]:
            data = {
                "provider_id": created_provider["id"],
                "day_of_week": day,
                "start_time": "08:00:00",
                "end_time": "12:00:00",
                "slot_duration_min": 30,
            }
            await client.post(
                "/api/v1/appointments/schedules",
                headers=admin_auth_headers,
                json=data,
            )

        response = await client.get(
            "/api/v1/appointments/schedules",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    @pytest.mark.asyncio
    async def test_listar_plantillas_filtro_proveedor(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Filtrar plantillas por provider_id retorna solo las del proveedor."""
        # Crear plantilla
        schedule_data = {
            "provider_id": created_provider["id"],
            "day_of_week": 1,
            "start_time": "09:00:00",
            "end_time": "13:00:00",
            "slot_duration_min": 20,
        }
        await client.post(
            "/api/v1/appointments/schedules",
            headers=admin_auth_headers,
            json=schedule_data,
        )

        response = await client.get(
            f"/api/v1/appointments/schedules?provider_id={created_provider['id']}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert all(t["provider_id"] == created_provider["id"] for t in data)

    @pytest.mark.asyncio
    async def test_actualizar_plantilla_horario(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Actualizar plantilla de horario retorna los cambios."""
        # Crear plantilla
        create_data = {
            "provider_id": created_provider["id"],
            "day_of_week": 3,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
            "slot_duration_min": 30,
        }
        create_resp = await client.post(
            "/api/v1/appointments/schedules",
            headers=admin_auth_headers,
            json=create_data,
        )
        template_id = create_resp.json()["id"]

        # Actualizar
        response = await client.patch(
            f"/api/v1/appointments/schedules/{template_id}",
            headers=admin_auth_headers,
            json={"slot_duration_min": 45, "max_overbooking": 1},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["slot_duration_min"] == 45
        assert result["max_overbooking"] == 1

    @pytest.mark.asyncio
    async def test_actualizar_plantilla_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Actualizar plantilla con UUID inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.patch(
            f"/api/v1/appointments/schedules/{fake_id}",
            headers=admin_auth_headers,
            json={"slot_duration_min": 45},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_crear_plantilla_sin_auth_retorna_401(
        self, client: AsyncClient
    ):
        """Crear plantilla sin autenticacion retorna 401."""
        data = {
            "provider_id": str(uuid.uuid4()),
            "day_of_week": 0,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
        }
        response = await client.post(
            "/api/v1/appointments/schedules",
            json=data,
        )
        assert response.status_code == 401


# =============================================
# Tests de Schedule Blocks
# =============================================


class TestScheduleBlocks:
    """Tests para POST/GET /api/v1/appointments/schedule-blocks."""

    @pytest.mark.asyncio
    async def test_crear_bloqueo_agenda_exitoso(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Crear bloqueo de agenda retorna 201."""
        block_start = datetime.now(timezone.utc) + timedelta(days=3)
        block_end = block_start + timedelta(hours=4)
        data = {
            "provider_id": created_provider["id"],
            "start_datetime": block_start.isoformat(),
            "end_datetime": block_end.isoformat(),
            "reason": "vacation",
            "description": "Vacaciones de semana santa",
        }
        response = await client.post(
            "/api/v1/appointments/schedule-blocks",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 201
        result = response.json()
        assert result["provider_id"] == created_provider["id"]
        assert result["reason"] == "vacation"
        assert result["description"] == "Vacaciones de semana santa"
        assert "id" in result

    @pytest.mark.asyncio
    async def test_listar_bloqueos_agenda(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Listar bloqueos de agenda retorna los existentes."""
        # Crear dos bloqueos
        for i in range(2):
            block_start = datetime.now(timezone.utc) + timedelta(days=5 + i)
            block_end = block_start + timedelta(hours=2)
            data = {
                "provider_id": created_provider["id"],
                "start_datetime": block_start.isoformat(),
                "end_datetime": block_end.isoformat(),
                "reason": "meeting",
                "description": f"Reunion #{i+1}",
            }
            await client.post(
                "/api/v1/appointments/schedule-blocks",
                headers=admin_auth_headers,
                json=data,
            )

        response = await client.get(
            "/api/v1/appointments/schedule-blocks",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    @pytest.mark.asyncio
    async def test_listar_bloqueos_filtro_proveedor(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Filtrar bloqueos por provider_id retorna solo los del proveedor."""
        block_start = datetime.now(timezone.utc) + timedelta(days=7)
        block_end = block_start + timedelta(hours=1)
        await client.post(
            "/api/v1/appointments/schedule-blocks",
            headers=admin_auth_headers,
            json={
                "provider_id": created_provider["id"],
                "start_datetime": block_start.isoformat(),
                "end_datetime": block_end.isoformat(),
                "reason": "personal",
            },
        )

        response = await client.get(
            f"/api/v1/appointments/schedule-blocks?provider_id={created_provider['id']}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert all(b["provider_id"] == created_provider["id"] for b in data)

    @pytest.mark.asyncio
    async def test_eliminar_bloqueo_agenda(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Eliminar bloqueo de agenda retorna 200."""
        block_start = datetime.now(timezone.utc) + timedelta(days=8)
        block_end = block_start + timedelta(hours=2)
        create_resp = await client.post(
            "/api/v1/appointments/schedule-blocks",
            headers=admin_auth_headers,
            json={
                "provider_id": created_provider["id"],
                "start_datetime": block_start.isoformat(),
                "end_datetime": block_end.isoformat(),
                "reason": "surgery",
            },
        )
        block_id = create_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/appointments/schedule-blocks/{block_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_eliminar_bloqueo_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Eliminar bloqueo con UUID inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.delete(
            f"/api/v1/appointments/schedule-blocks/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404


# =============================================
# Tests de Creacion de Citas
# =============================================


class TestCreateAppointment:
    """Tests para POST /api/v1/appointments."""

    @pytest.mark.asyncio
    async def test_crear_cita_exitoso(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """Crear cita con datos validos retorna 201."""
        data = _appointment_data(
            patient_id=created_patient["id"],
            provider_id=created_provider["id"],
            days_ahead=3,
            hour=10,
        )
        response = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 201
        result = response.json()
        assert result["patient_id"] == created_patient["id"]
        assert result["provider_id"] == created_provider["id"]
        assert result["appointment_type"] == "consulta"
        assert result["status"] == "scheduled"
        assert result["reason"] == "Consulta general"
        assert result["notes"] == "Primera visita"
        assert result["source"] == "web"
        assert "id" in result
        assert "created_at" in result

    @pytest.mark.asyncio
    async def test_crear_cita_retorna_provider_embebido(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """La respuesta de creacion incluye datos del proveedor."""
        data = _appointment_data(
            patient_id=created_patient["id"],
            provider_id=created_provider["id"],
            days_ahead=3,
            hour=14,
        )
        response = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 201
        result = response.json()
        assert result["provider"] is not None
        assert result["provider"]["id"] == created_provider["id"]

    @pytest.mark.asyncio
    async def test_crear_cita_conflicto_horario_retorna_409(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """Crear cita en horario ocupado retorna 409 Conflict."""
        data = _appointment_data(
            patient_id=created_patient["id"],
            provider_id=created_provider["id"],
            days_ahead=4,
            hour=11,
        )
        # Crear primera cita
        resp1 = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data,
        )
        assert resp1.status_code == 201

        # Intentar crear segunda cita en el mismo horario exacto
        resp2 = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data,
        )
        assert resp2.status_code == 409
        error = resp2.json()
        assert "detail" in error

    @pytest.mark.asyncio
    async def test_crear_cita_conflicto_horario_parcial_retorna_409(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """Crear cita que se solapa parcialmente con otra retorna 409."""
        # Primera cita: 9:00 - 9:30
        data1 = _appointment_data(
            patient_id=created_patient["id"],
            provider_id=created_provider["id"],
            days_ahead=5,
            hour=9,
            duration_min=30,
        )
        resp1 = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data1,
        )
        assert resp1.status_code == 201

        # Segunda cita: 9:15 - 9:45 (se solapa 15 minutos)
        start_overlap = datetime.now(timezone.utc).replace(
            hour=9, minute=15, second=0, microsecond=0
        ) + timedelta(days=5)
        end_overlap = start_overlap + timedelta(minutes=30)
        data2 = {
            "patient_id": created_patient["id"],
            "provider_id": created_provider["id"],
            "appointment_type": "consulta",
            "scheduled_start": start_overlap.isoformat(),
            "scheduled_end": end_overlap.isoformat(),
            "reason": "Segunda consulta",
            "source": "web",
        }
        resp2 = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data2,
        )
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_crear_cita_sin_auth_retorna_401(
        self, client: AsyncClient
    ):
        """Crear cita sin token retorna 401."""
        data = {
            "patient_id": str(uuid.uuid4()),
            "provider_id": str(uuid.uuid4()),
            "appointment_type": "consulta",
            "scheduled_start": _future_datetime(1, 9),
            "scheduled_end": _future_datetime(1, 9),
            "source": "web",
        }
        response = await client.post(
            "/api/v1/appointments",
            json=data,
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_crear_cita_sin_horario_solapado_exitoso(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """Crear dos citas sin solapamiento es exitoso."""
        # Primera cita: 9:00 - 9:30
        data1 = _appointment_data(
            patient_id=created_patient["id"],
            provider_id=created_provider["id"],
            days_ahead=6,
            hour=9,
            duration_min=30,
        )
        resp1 = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data1,
        )
        assert resp1.status_code == 201

        # Segunda cita: 10:00 - 10:30 (sin solapamiento)
        data2 = _appointment_data(
            patient_id=created_patient["id"],
            provider_id=created_provider["id"],
            days_ahead=6,
            hour=10,
            duration_min=30,
        )
        resp2 = await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data2,
        )
        assert resp2.status_code == 201


# =============================================
# Tests de Obtencion de Cita Individual
# =============================================


class TestGetAppointment:
    """Tests para GET /api/v1/appointments/{appointment_id}."""

    @pytest.mark.asyncio
    async def test_obtener_cita_por_id(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Obtener cita existente por UUID retorna 200."""
        apt_id = created_appointment["id"]
        response = await client.get(
            f"/api/v1/appointments/{apt_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == apt_id
        assert data["status"] == "scheduled"
        assert data["provider"] is not None

    @pytest.mark.asyncio
    async def test_obtener_cita_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Obtener cita con UUID inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/appointments/{fake_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_obtener_cita_sin_auth_retorna_401(
        self, client: AsyncClient
    ):
        """Obtener cita sin token retorna 401."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/appointments/{fake_id}",
        )
        assert response.status_code == 401


# =============================================
# Tests de Listado de Citas
# =============================================


class TestListAppointments:
    """Tests para GET /api/v1/appointments."""

    @pytest.mark.asyncio
    async def test_listar_citas_vacio(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Listar citas sin datos retorna lista vacia paginada."""
        response = await client.get(
            "/api/v1/appointments",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_listar_citas_con_datos(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Listar citas retorna resultados paginados."""
        response = await client.get(
            "/api/v1/appointments",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1
        item = data["items"][0]
        assert "id" in item
        assert "patient_id" in item
        assert "provider_id" in item
        assert "appointment_type" in item
        assert "scheduled_start" in item
        assert "status" in item

    @pytest.mark.asyncio
    async def test_listar_citas_filtro_proveedor(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_appointment,
        created_provider,
    ):
        """Filtrar citas por provider_id retorna solo las del proveedor."""
        response = await client.get(
            f"/api/v1/appointments?provider_id={created_provider['id']}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["provider_id"] == created_provider["id"]

    @pytest.mark.asyncio
    async def test_listar_citas_filtro_paciente(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_appointment,
        created_patient,
    ):
        """Filtrar citas por patient_id retorna solo las del paciente."""
        response = await client.get(
            f"/api/v1/appointments?patient_id={created_patient['id']}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["patient_id"] == created_patient["id"]

    @pytest.mark.asyncio
    async def test_listar_citas_filtro_status(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Filtrar citas por status retorna solo las coincidentes."""
        response = await client.get(
            "/api/v1/appointments?status=scheduled",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["status"] == "scheduled"

    @pytest.mark.asyncio
    async def test_listar_citas_filtro_fecha(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """Filtrar citas por rango de fechas retorna solo las del rango."""
        # Crear cita para fecha conocida
        target_date = datetime.now(timezone.utc) + timedelta(days=10)
        start = target_date.replace(hour=9, minute=0, second=0, microsecond=0)
        end = start + timedelta(minutes=30)
        data = {
            "patient_id": created_patient["id"],
            "provider_id": created_provider["id"],
            "appointment_type": "consulta",
            "scheduled_start": start.isoformat(),
            "scheduled_end": end.isoformat(),
            "source": "web",
        }
        await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data,
        )

        # Filtrar por rango que incluye la cita
        start_date = (target_date - timedelta(days=1)).strftime("%Y-%m-%d")
        end_date = (target_date + timedelta(days=1)).strftime("%Y-%m-%d")
        response = await client.get(
            f"/api/v1/appointments?start_date={start_date}&end_date={end_date}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data_resp = response.json()
        assert data_resp["total"] >= 1

    @pytest.mark.asyncio
    async def test_listar_citas_paginacion(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """La paginacion funciona correctamente con page y page_size."""
        # Crear 3 citas en horas distintas
        for hour in [8, 9, 10]:
            data = _appointment_data(
                patient_id=created_patient["id"],
                provider_id=created_provider["id"],
                days_ahead=15,
                hour=hour,
            )
            await client.post(
                "/api/v1/appointments",
                headers=admin_auth_headers,
                json=data,
            )

        # Obtener pagina 1 con 2 elementos
        response = await client.get(
            "/api/v1/appointments?page=1&page_size=2",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2
        assert data["total"] >= 3
        assert data["total_pages"] >= 2

        # Obtener pagina 2
        response2 = await client.get(
            "/api/v1/appointments?page=2&page_size=2",
            headers=admin_auth_headers,
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["page"] == 2
        assert len(data2["items"]) >= 1


# =============================================
# Tests de Transiciones de Estado
# =============================================


class TestAppointmentStatusTransitions:
    """Tests para PATCH /api/v1/appointments/{id}/status."""

    @pytest.mark.asyncio
    async def test_transicion_scheduled_a_confirmed(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Transicion scheduled -> confirmed es valida."""
        apt_id = created_appointment["id"]
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "confirmed"

    @pytest.mark.asyncio
    async def test_transicion_confirmed_a_arrived(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Transicion confirmed -> arrived (check-in) es valida."""
        apt_id = created_appointment["id"]
        # scheduled -> confirmed
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        # confirmed -> arrived
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "arrived"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "arrived"
        assert data["check_in_time"] is not None

    @pytest.mark.asyncio
    async def test_transicion_arrived_a_in_progress(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Transicion arrived -> in_progress es valida."""
        apt_id = created_appointment["id"]
        # scheduled -> confirmed -> arrived
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "arrived"},
        )
        # arrived -> in_progress
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "in_progress"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["start_time"] is not None

    @pytest.mark.asyncio
    async def test_transicion_in_progress_a_completed(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Transicion in_progress -> completed es valida."""
        apt_id = created_appointment["id"]
        # scheduled -> confirmed -> arrived -> in_progress
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "arrived"},
        )
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "in_progress"},
        )
        # in_progress -> completed
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "completed"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["end_time"] is not None

    @pytest.mark.asyncio
    async def test_flujo_completo_scheduled_a_completed(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Flujo completo: scheduled -> confirmed -> arrived -> in_progress -> completed."""
        apt_id = created_appointment["id"]

        transitions = ["confirmed", "arrived", "in_progress", "completed"]
        for new_status in transitions:
            response = await client.patch(
                f"/api/v1/appointments/{apt_id}/status",
                headers=admin_auth_headers,
                json={"status": new_status},
            )
            assert response.status_code == 200, (
                f"Fallo transicion a '{new_status}': {response.json()}"
            )
            assert response.json()["status"] == new_status

        # Verificar estado final
        final = await client.get(
            f"/api/v1/appointments/{apt_id}",
            headers=admin_auth_headers,
        )
        assert final.status_code == 200
        data = final.json()
        assert data["status"] == "completed"
        assert data["check_in_time"] is not None
        assert data["start_time"] is not None
        assert data["end_time"] is not None

    @pytest.mark.asyncio
    async def test_transicion_invalida_retorna_422(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Transicion invalida (scheduled -> completed) retorna error."""
        apt_id = created_appointment["id"]
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "completed"},
        )
        # BusinessRuleViolation raises 422
        assert response.status_code == 422
        error = response.json()
        assert "detail" in error

    @pytest.mark.asyncio
    async def test_transicion_invalida_in_progress_a_confirmed_retorna_422(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Transicion invalida (in_progress -> confirmed) retorna error."""
        apt_id = created_appointment["id"]
        # Avanzar a in_progress
        for status in ["confirmed", "arrived", "in_progress"]:
            await client.patch(
                f"/api/v1/appointments/{apt_id}/status",
                headers=admin_auth_headers,
                json={"status": status},
            )

        # Intentar retroceder a confirmed
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_actualizar_status_cita_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Actualizar status de cita inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        response = await client.patch(
            f"/api/v1/appointments/{fake_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        assert response.status_code == 404


# =============================================
# Tests de Cancelacion
# =============================================


class TestCancelAppointment:
    """Tests de cancelacion de citas."""

    @pytest.mark.asyncio
    async def test_cancelar_cita_scheduled(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Cancelar cita scheduled con motivo retorna 200."""
        apt_id = created_appointment["id"]
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={
                "status": "cancelled",
                "cancellation_reason": "Paciente solicito cancelacion",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"
        assert data["cancellation_reason"] == "Paciente solicito cancelacion"

    @pytest.mark.asyncio
    async def test_cancelar_cita_confirmed(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Cancelar cita confirmed es valido."""
        apt_id = created_appointment["id"]
        # Confirmar primero
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        # Cancelar
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={
                "status": "cancelled",
                "cancellation_reason": "Emergencia del proveedor",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_cancelar_cita_arrived(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Cancelar cita arrived es valido."""
        apt_id = created_appointment["id"]
        # scheduled -> confirmed -> arrived
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "arrived"},
        )
        # Cancelar
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={
                "status": "cancelled",
                "cancellation_reason": "Paciente se retiro",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_cancelar_cita_in_progress_no_permitido(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """No se puede cancelar cita in_progress (ya inicio)."""
        apt_id = created_appointment["id"]
        # Avanzar a in_progress
        for status in ["confirmed", "arrived", "in_progress"]:
            await client.patch(
                f"/api/v1/appointments/{apt_id}/status",
                headers=admin_auth_headers,
                json={"status": status},
            )
        # Intentar cancelar
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={
                "status": "cancelled",
                "cancellation_reason": "Intento invalido",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_cancelar_cita_completed_no_permitido(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """No se puede cancelar cita completed."""
        apt_id = created_appointment["id"]
        # Completar flujo
        for status in ["confirmed", "arrived", "in_progress", "completed"]:
            await client.patch(
                f"/api/v1/appointments/{apt_id}/status",
                headers=admin_auth_headers,
                json={"status": status},
            )
        # Intentar cancelar
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "cancelled"},
        )
        assert response.status_code == 422


# =============================================
# Tests de Check-in (arrived)
# =============================================


class TestCheckIn:
    """Tests del flujo de check-in (status -> arrived)."""

    @pytest.mark.asyncio
    async def test_checkin_registra_hora(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Check-in (arrived) registra check_in_time."""
        apt_id = created_appointment["id"]
        # Confirmar primero
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        # Check-in
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "arrived"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "arrived"
        assert data["check_in_time"] is not None

    @pytest.mark.asyncio
    async def test_checkin_directo_desde_scheduled_no_permitido(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """No se puede hacer check-in directamente desde scheduled (debe confirmar primero)."""
        apt_id = created_appointment["id"]
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "arrived"},
        )
        # scheduled -> arrived no esta en las transiciones validas
        assert response.status_code == 422


# =============================================
# Tests de No-Show
# =============================================


class TestNoShow:
    """Tests para marcar paciente como no-show."""

    @pytest.mark.asyncio
    async def test_noshow_desde_scheduled(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Marcar no-show desde scheduled es valido."""
        apt_id = created_appointment["id"]
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "no_show"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "no_show"

    @pytest.mark.asyncio
    async def test_noshow_desde_confirmed(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Marcar no-show desde confirmed es valido."""
        apt_id = created_appointment["id"]
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        response = await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "no_show"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "no_show"


# =============================================
# Tests de Reagendamiento
# =============================================


class TestRescheduleAppointment:
    """Tests para POST /api/v1/appointments/{id}/reschedule."""

    @pytest.mark.asyncio
    async def test_reagendar_cita_exitoso(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Reagendar cita scheduled a nuevo horario es exitoso."""
        apt_id = created_appointment["id"]
        new_start = datetime.now(timezone.utc).replace(
            hour=15, minute=0, second=0, microsecond=0
        ) + timedelta(days=20)
        new_end = new_start + timedelta(minutes=30)
        response = await client.post(
            f"/api/v1/appointments/{apt_id}/reschedule",
            headers=admin_auth_headers,
            json={
                "new_start": new_start.isoformat(),
                "new_end": new_end.isoformat(),
                "reason": "Cambio de disponibilidad del paciente",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "scheduled"

    @pytest.mark.asyncio
    async def test_reagendar_cita_confirmed_exitoso(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """Reagendar cita confirmed es valido y vuelve a scheduled."""
        apt_id = created_appointment["id"]
        # Confirmar
        await client.patch(
            f"/api/v1/appointments/{apt_id}/status",
            headers=admin_auth_headers,
            json={"status": "confirmed"},
        )
        # Reagendar
        new_start = datetime.now(timezone.utc).replace(
            hour=16, minute=0, second=0, microsecond=0
        ) + timedelta(days=21)
        new_end = new_start + timedelta(minutes=30)
        response = await client.post(
            f"/api/v1/appointments/{apt_id}/reschedule",
            headers=admin_auth_headers,
            json={
                "new_start": new_start.isoformat(),
                "new_end": new_end.isoformat(),
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "scheduled"

    @pytest.mark.asyncio
    async def test_reagendar_cita_in_progress_no_permitido(
        self, client: AsyncClient, admin_auth_headers, created_appointment
    ):
        """No se puede reagendar cita in_progress."""
        apt_id = created_appointment["id"]
        for status in ["confirmed", "arrived", "in_progress"]:
            await client.patch(
                f"/api/v1/appointments/{apt_id}/status",
                headers=admin_auth_headers,
                json={"status": status},
            )
        new_start = datetime.now(timezone.utc) + timedelta(days=25)
        new_end = new_start + timedelta(minutes=30)
        response = await client.post(
            f"/api/v1/appointments/{apt_id}/reschedule",
            headers=admin_auth_headers,
            json={
                "new_start": new_start.isoformat(),
                "new_end": new_end.isoformat(),
            },
        )
        # BusinessRuleViolation -> 422
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_reagendar_cita_inexistente_retorna_404(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Reagendar cita inexistente retorna 404."""
        fake_id = str(uuid.uuid4())
        new_start = datetime.now(timezone.utc) + timedelta(days=30)
        new_end = new_start + timedelta(minutes=30)
        response = await client.post(
            f"/api/v1/appointments/{fake_id}/reschedule",
            headers=admin_auth_headers,
            json={
                "new_start": new_start.isoformat(),
                "new_end": new_end.isoformat(),
            },
        )
        assert response.status_code == 404


# =============================================
# Tests de Estadisticas
# =============================================


class TestAppointmentStats:
    """Tests para GET /api/v1/appointments/stats."""

    @pytest.mark.asyncio
    async def test_estadisticas_sin_citas(
        self, client: AsyncClient, admin_auth_headers
    ):
        """Estadisticas sin datos retorna todo en 0."""
        response = await client.get(
            "/api/v1/appointments/stats",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["scheduled"] == 0
        assert data["completed"] == 0
        assert data["cancelled"] == 0
        assert data["no_show"] == 0

    @pytest.mark.asyncio
    async def test_estadisticas_con_citas(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """Estadisticas reflejan las citas creadas y sus estados."""
        # Crear 3 citas
        apt_ids = []
        for hour in [8, 9, 10]:
            data = _appointment_data(
                patient_id=created_patient["id"],
                provider_id=created_provider["id"],
                days_ahead=30,
                hour=hour,
            )
            resp = await client.post(
                "/api/v1/appointments",
                headers=admin_auth_headers,
                json=data,
            )
            assert resp.status_code == 201
            apt_ids.append(resp.json()["id"])

        # Completar una cita (apt_ids[0])
        for status in ["confirmed", "arrived", "in_progress", "completed"]:
            await client.patch(
                f"/api/v1/appointments/{apt_ids[0]}/status",
                headers=admin_auth_headers,
                json={"status": status},
            )

        # Cancelar otra cita (apt_ids[1])
        await client.patch(
            f"/api/v1/appointments/{apt_ids[1]}/status",
            headers=admin_auth_headers,
            json={"status": "cancelled", "cancellation_reason": "Test"},
        )

        # apt_ids[2] queda scheduled

        response = await client.get(
            "/api/v1/appointments/stats",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert data["completed"] == 1
        assert data["cancelled"] == 1
        assert data["scheduled"] >= 1  # al menos la scheduled/confirmed

    @pytest.mark.asyncio
    async def test_estadisticas_filtro_fecha(
        self,
        client: AsyncClient,
        admin_auth_headers,
        created_patient,
        created_provider,
    ):
        """Estadisticas filtradas por rango de fechas."""
        # Crear cita en fecha futura conocida
        target_date = datetime.now(timezone.utc) + timedelta(days=40)
        start = target_date.replace(hour=9, minute=0, second=0, microsecond=0)
        end = start + timedelta(minutes=30)
        data = {
            "patient_id": created_patient["id"],
            "provider_id": created_provider["id"],
            "appointment_type": "consulta",
            "scheduled_start": start.isoformat(),
            "scheduled_end": end.isoformat(),
            "source": "web",
        }
        await client.post(
            "/api/v1/appointments",
            headers=admin_auth_headers,
            json=data,
        )

        # Filtrar por rango que incluye la cita
        date_from = (target_date - timedelta(days=1)).strftime("%Y-%m-%d")
        date_to = (target_date + timedelta(days=1)).strftime("%Y-%m-%d")
        response = await client.get(
            f"/api/v1/appointments/stats?date_from={date_from}&date_to={date_to}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data_resp = response.json()
        assert data_resp["total"] >= 1

    @pytest.mark.asyncio
    async def test_estadisticas_sin_auth_retorna_401(
        self, client: AsyncClient
    ):
        """Estadisticas sin token retorna 401."""
        response = await client.get(
            "/api/v1/appointments/stats",
        )
        assert response.status_code == 401


# =============================================
# Tests de Disponibilidad
# =============================================


class TestProviderAvailability:
    """Tests para GET /api/v1/appointments/providers/{id}/availability."""

    @pytest.mark.asyncio
    async def test_disponibilidad_sin_plantillas(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Proveedor sin plantillas retorna lista vacia."""
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        next_week = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
        response = await client.get(
            f"/api/v1/appointments/providers/{created_provider['id']}/availability"
            f"?start_date={tomorrow}&end_date={next_week}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_disponibilidad_con_plantilla(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Proveedor con plantilla retorna slots disponibles."""
        # Determinar el dia de la semana para manana y crear plantilla para ese dia
        tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
        day_of_week = tomorrow.weekday()

        # Crear plantilla para ese dia de la semana
        schedule_data = {
            "provider_id": created_provider["id"],
            "day_of_week": day_of_week,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
            "slot_duration_min": 30,
        }
        await client.post(
            "/api/v1/appointments/schedules",
            headers=admin_auth_headers,
            json=schedule_data,
        )

        start_date = tomorrow.strftime("%Y-%m-%d")
        end_date = tomorrow.strftime("%Y-%m-%d")
        response = await client.get(
            f"/api/v1/appointments/providers/{created_provider['id']}/availability"
            f"?start_date={start_date}&end_date={end_date}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # 08:00-12:00 con slots de 30min = 8 slots
        assert len(data) == 8
        for slot in data:
            assert slot["provider_id"] == created_provider["id"]
            assert slot["available_spots"] >= 1

    @pytest.mark.asyncio
    async def test_disponibilidad_fecha_fin_antes_inicio_retorna_400(
        self, client: AsyncClient, admin_auth_headers, created_provider
    ):
        """Rango de fechas invertido retorna 400."""
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        response = await client.get(
            f"/api/v1/appointments/providers/{created_provider['id']}/availability"
            f"?start_date={tomorrow}&end_date={yesterday}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 400


# =============================================
# Tests de Lista de Espera
# =============================================


class TestWaitingList:
    """Tests para POST/GET /api/v1/appointments/waiting-list."""

    @pytest.mark.asyncio
    async def test_agregar_a_lista_de_espera(
        self, client: AsyncClient, admin_auth_headers, created_patient, created_provider
    ):
        """Agregar paciente a lista de espera retorna 201."""
        data = {
            "patient_id": created_patient["id"],
            "provider_id": created_provider["id"],
            "specialty_code": "MED-GEN",
            "priority": 3,
            "reason": "Consulta urgente sin disponibilidad",
        }
        response = await client.post(
            "/api/v1/appointments/waiting-list",
            headers=admin_auth_headers,
            json=data,
        )
        assert response.status_code == 201
        result = response.json()
        assert result["patient_id"] == created_patient["id"]
        assert result["provider_id"] == created_provider["id"]
        assert result["priority"] == 3
        assert result["status"] == "waiting"

    @pytest.mark.asyncio
    async def test_listar_lista_de_espera(
        self, client: AsyncClient, admin_auth_headers, created_patient, created_provider
    ):
        """Listar lista de espera retorna paginacion correcta."""
        # Agregar dos entradas
        for priority in [2, 5]:
            data = {
                "patient_id": created_patient["id"],
                "provider_id": created_provider["id"],
                "priority": priority,
            }
            await client.post(
                "/api/v1/appointments/waiting-list",
                headers=admin_auth_headers,
                json=data,
            )

        response = await client.get(
            "/api/v1/appointments/waiting-list",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 2

    @pytest.mark.asyncio
    async def test_listar_lista_de_espera_filtro_proveedor(
        self, client: AsyncClient, admin_auth_headers, created_patient, created_provider
    ):
        """Filtrar lista de espera por provider_id."""
        data = {
            "patient_id": created_patient["id"],
            "provider_id": created_provider["id"],
            "priority": 5,
        }
        await client.post(
            "/api/v1/appointments/waiting-list",
            headers=admin_auth_headers,
            json=data,
        )

        response = await client.get(
            f"/api/v1/appointments/waiting-list?provider_id={created_provider['id']}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        result = response.json()
        assert result["total"] >= 1

    @pytest.mark.asyncio
    async def test_listar_lista_de_espera_filtro_especialidad(
        self, client: AsyncClient, admin_auth_headers, created_patient
    ):
        """Filtrar lista de espera por specialty_code."""
        data = {
            "patient_id": created_patient["id"],
            "specialty_code": "CARDIO",
            "priority": 1,
            "reason": "Evaluacion cardiologica",
        }
        await client.post(
            "/api/v1/appointments/waiting-list",
            headers=admin_auth_headers,
            json=data,
        )

        response = await client.get(
            "/api/v1/appointments/waiting-list?specialty_code=CARDIO",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        result = response.json()
        assert result["total"] >= 1

    @pytest.mark.asyncio
    async def test_agregar_sin_auth_retorna_401(self, client: AsyncClient):
        """Agregar a lista de espera sin token retorna 401."""
        data = {
            "patient_id": str(uuid.uuid4()),
            "priority": 5,
        }
        response = await client.post(
            "/api/v1/appointments/waiting-list",
            json=data,
        )
        assert response.status_code == 401
