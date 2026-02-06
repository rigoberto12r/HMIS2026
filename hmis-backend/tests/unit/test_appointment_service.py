"""
Tests unitarios para el servicio de citas (AppointmentService).
Valida la logica de negocio: creacion, transiciones de estado y conflictos.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.appointments.models import Appointment, Provider
from app.modules.appointments.schemas import (
    AppointmentCreate,
    AppointmentStatusUpdate,
)
from app.modules.appointments.service import AppointmentService


# =============================================
# Helpers
# =============================================

def _crear_provider_mock() -> Provider:
    """Crea un proveedor de salud simulado."""
    provider = MagicMock(spec=Provider)
    provider.id = uuid.uuid4()
    provider.first_name = "Dr. Carlos"
    provider.last_name = "Ramirez"
    provider.specialty_code = "MED-INT"
    provider.specialty_name = "Medicina Interna"
    provider.license_number = "EXEQUATUR-12345"
    provider.is_active = True
    return provider


def _crear_cita_mock(
    status: str = "scheduled",
    provider_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
) -> Appointment:
    """Crea un objeto Appointment simulado."""
    appointment = MagicMock(spec=Appointment)
    appointment.id = uuid.uuid4()
    appointment.patient_id = patient_id or uuid.uuid4()
    appointment.provider_id = provider_id or uuid.uuid4()
    appointment.appointment_type = "consulta"
    appointment.status = status
    appointment.scheduled_start = datetime.now(timezone.utc) + timedelta(hours=2)
    appointment.scheduled_end = datetime.now(timezone.utc) + timedelta(hours=2, minutes=30)
    appointment.is_active = True
    appointment.source = "web"
    appointment.check_in_time = None
    appointment.start_time = None
    appointment.end_time = None
    appointment.confirmed_at = None
    appointment.cancellation_reason = None
    appointment.updated_by = None
    appointment.provider = _crear_provider_mock()
    return appointment


# =============================================
# Tests de creacion de citas
# =============================================

class TestAppointmentServiceCreacion:
    """Grupo de tests para la creacion de citas medicas."""

    @pytest.mark.asyncio
    async def test_crear_cita_exitosa(self):
        """Verifica que se puede crear una cita sin conflicto de horario."""
        provider_id = uuid.uuid4()
        patient_id = uuid.uuid4()
        ahora = datetime.now(timezone.utc)

        data = AppointmentCreate(
            patient_id=patient_id,
            provider_id=provider_id,
            scheduled_start=ahora + timedelta(hours=2),
            scheduled_end=ahora + timedelta(hours=2, minutes=30),
            appointment_type="consulta",
            reason="Control de presion arterial",
            source="web",
        )

        # Mock: sin conflicto
        resultado_conflicto = MagicMock()
        resultado_conflicto.scalar_one_or_none.return_value = None

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado_conflicto)
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = AppointmentService(db)

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            appointment = await service.create_appointment(data, created_by=uuid.uuid4())

        assert appointment is not None, "Debe crear la cita exitosamente"
        db.add.assert_called_once(), "Debe agregar la cita a la sesion"

    @pytest.mark.asyncio
    async def test_crear_cita_con_conflicto_lanza_error(self):
        """Verifica que no se permite crear una cita en un horario ocupado."""
        provider_id = uuid.uuid4()
        ahora = datetime.now(timezone.utc)

        data = AppointmentCreate(
            patient_id=uuid.uuid4(),
            provider_id=provider_id,
            scheduled_start=ahora + timedelta(hours=2),
            scheduled_end=ahora + timedelta(hours=2, minutes=30),
            appointment_type="consulta",
        )

        # Mock: hay conflicto (ya existe una cita)
        cita_existente = _crear_cita_mock(provider_id=provider_id)
        resultado_conflicto = MagicMock()
        resultado_conflicto.scalar_one_or_none.return_value = cita_existente

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado_conflicto)

        service = AppointmentService(db)

        with pytest.raises(ValueError, match="ya no esta disponible"):
            await service.create_appointment(data)


# =============================================
# Tests de transiciones de estado
# =============================================

class TestAppointmentServiceTransiciones:
    """
    Grupo de tests para las transiciones de estado del ciclo de vida de citas.
    Ciclo de vida: scheduled -> confirmed -> arrived -> in_progress -> completed
    """

    @pytest.mark.asyncio
    async def test_transicion_scheduled_a_confirmed(self):
        """Verifica la transicion de programada a confirmada."""
        cita = _crear_cita_mock(status="scheduled")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)
        db.flush = AsyncMock()

        service = AppointmentService(db)

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            updated = await service.update_status(
                cita.id,
                AppointmentStatusUpdate(status="confirmed"),
                updated_by=uuid.uuid4(),
            )

        assert updated is not None, "La transicion debe ser exitosa"
        assert cita.status == "confirmed", (
            "El estado debe cambiar a 'confirmed'"
        )
        assert cita.confirmed_at is not None, (
            "Debe registrar la fecha de confirmacion"
        )

    @pytest.mark.asyncio
    async def test_transicion_confirmed_a_arrived(self):
        """Verifica la transicion de confirmada a llegada (check-in)."""
        cita = _crear_cita_mock(status="confirmed")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)
        db.flush = AsyncMock()

        service = AppointmentService(db)

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            updated = await service.update_status(
                cita.id,
                AppointmentStatusUpdate(status="arrived"),
            )

        assert cita.status == "arrived", "El estado debe cambiar a 'arrived'"
        assert cita.check_in_time is not None, (
            "Debe registrar la hora de check-in"
        )

    @pytest.mark.asyncio
    async def test_transicion_arrived_a_in_progress(self):
        """Verifica la transicion de llegada a en progreso (inicio de consulta)."""
        cita = _crear_cita_mock(status="arrived")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)
        db.flush = AsyncMock()

        service = AppointmentService(db)

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            updated = await service.update_status(
                cita.id,
                AppointmentStatusUpdate(status="in_progress"),
            )

        assert cita.status == "in_progress", (
            "El estado debe cambiar a 'in_progress'"
        )
        assert cita.start_time is not None, (
            "Debe registrar la hora de inicio de la consulta"
        )

    @pytest.mark.asyncio
    async def test_transicion_in_progress_a_completed(self):
        """Verifica la transicion de en progreso a completada."""
        cita = _crear_cita_mock(status="in_progress")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)
        db.flush = AsyncMock()

        service = AppointmentService(db)

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            updated = await service.update_status(
                cita.id,
                AppointmentStatusUpdate(status="completed"),
            )

        assert cita.status == "completed", (
            "El estado debe cambiar a 'completed'"
        )
        assert cita.end_time is not None, (
            "Debe registrar la hora de finalizacion de la consulta"
        )

    @pytest.mark.asyncio
    async def test_ciclo_vida_completo(self):
        """
        Verifica el ciclo de vida completo de una cita:
        scheduled -> confirmed -> arrived -> in_progress -> completed
        """
        cita = _crear_cita_mock(status="scheduled")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)
        db.flush = AsyncMock()

        service = AppointmentService(db)

        transiciones = ["confirmed", "arrived", "in_progress", "completed"]

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            for nuevo_estado in transiciones:
                updated = await service.update_status(
                    cita.id,
                    AppointmentStatusUpdate(status=nuevo_estado),
                )
                assert cita.status == nuevo_estado, (
                    f"La transicion a '{nuevo_estado}' debe ser exitosa"
                )


# =============================================
# Tests de transiciones invalidas
# =============================================

class TestAppointmentServiceTransicionesInvalidas:
    """Grupo de tests para transiciones de estado no permitidas."""

    @pytest.mark.asyncio
    async def test_transicion_scheduled_a_completed_falla(self):
        """
        Verifica que no se puede saltar de 'scheduled' a 'completed'
        sin pasar por los estados intermedios.
        """
        cita = _crear_cita_mock(status="scheduled")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)

        service = AppointmentService(db)

        with pytest.raises(ValueError, match="No se puede cambiar"):
            await service.update_status(
                cita.id,
                AppointmentStatusUpdate(status="completed"),
            )

    @pytest.mark.asyncio
    async def test_transicion_scheduled_a_in_progress_falla(self):
        """Verifica que no se puede pasar directamente a 'in_progress' desde 'scheduled'."""
        cita = _crear_cita_mock(status="scheduled")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)

        service = AppointmentService(db)

        with pytest.raises(ValueError, match="No se puede cambiar"):
            await service.update_status(
                cita.id,
                AppointmentStatusUpdate(status="in_progress"),
            )

    @pytest.mark.asyncio
    async def test_transicion_completed_a_cualquier_estado_falla(self):
        """Verifica que una cita completada no admite mas transiciones."""
        cita = _crear_cita_mock(status="completed")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)

        service = AppointmentService(db)

        for estado in ["scheduled", "confirmed", "arrived", "in_progress", "cancelled"]:
            with pytest.raises(ValueError, match="No se puede cambiar"):
                await service.update_status(
                    cita.id,
                    AppointmentStatusUpdate(status=estado),
                )

    @pytest.mark.asyncio
    async def test_cancelacion_desde_scheduled(self):
        """Verifica que se puede cancelar una cita programada."""
        cita = _crear_cita_mock(status="scheduled")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)
        db.flush = AsyncMock()

        service = AppointmentService(db)

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            updated = await service.update_status(
                cita.id,
                AppointmentStatusUpdate(
                    status="cancelled",
                    cancellation_reason="Paciente solicito cancelacion",
                ),
            )

        assert cita.status == "cancelled", (
            "La cita debe poder cancelarse desde 'scheduled'"
        )
        assert cita.cancellation_reason == "Paciente solicito cancelacion", (
            "Debe registrar el motivo de cancelacion"
        )

    @pytest.mark.asyncio
    async def test_no_show_desde_confirmed(self):
        """Verifica que se puede marcar no_show desde confirmada."""
        cita = _crear_cita_mock(status="confirmed")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = cita

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)
        db.flush = AsyncMock()

        service = AppointmentService(db)

        with patch("app.modules.appointments.service.publish", new_callable=AsyncMock):
            updated = await service.update_status(
                cita.id,
                AppointmentStatusUpdate(status="no_show"),
            )

        assert cita.status == "no_show", (
            "Debe permitir marcar no_show desde 'confirmed'"
        )

    @pytest.mark.asyncio
    async def test_cita_inexistente_retorna_none(self):
        """Verifica que actualizar una cita inexistente retorna None."""
        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = None

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)

        service = AppointmentService(db)

        updated = await service.update_status(
            uuid.uuid4(),
            AppointmentStatusUpdate(status="confirmed"),
        )

        assert updated is None, (
            "Actualizar una cita inexistente debe retornar None"
        )
