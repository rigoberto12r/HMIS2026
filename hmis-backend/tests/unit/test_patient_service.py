"""
Tests unitarios para el servicio de pacientes (PatientService).
Valida la logica de negocio: registro, busqueda, duplicados y MRN.
"""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.patients.models import Patient, PatientInsurance
from app.modules.patients.schemas import PatientCreate, PatientSearchParams
from app.modules.patients.service import PatientService


# =============================================
# Helpers
# =============================================

def _crear_schema_paciente(**overrides) -> PatientCreate:
    """Crea un schema PatientCreate con datos de prueba dominicanos."""
    datos = {
        "document_type": "cedula",
        "document_number": "00112345678",
        "first_name": "Juan",
        "last_name": "Perez",
        "second_last_name": "Garcia",
        "birth_date": date(1985, 3, 15),
        "gender": "M",
        "blood_type": "O+",
        "phone": "809-555-0100",
        "mobile_phone": "829-555-0200",
        "email": "juan.perez@email.com",
        "address_line1": "Calle Principal #123",
        "city": "Santo Domingo",
        "state_province": "Distrito Nacional",
        "country": "DO",
        "emergency_contact_name": "Maria Perez",
        "emergency_contact_phone": "809-555-0300",
        "emergency_contact_relationship": "esposa",
        "insurance_policies": [],
    }
    datos.update(overrides)
    return PatientCreate(**datos)


def _crear_paciente_mock(
    mrn: str = "HMIS-00000001",
    first_name: str = "Juan",
    last_name: str = "Perez",
    document_type: str = "cedula",
    document_number: str = "00112345678",
    is_active: bool = True,
) -> Patient:
    """Crea un objeto Patient simulado."""
    patient = MagicMock(spec=Patient)
    patient.id = uuid.uuid4()
    patient.mrn = mrn
    patient.first_name = first_name
    patient.last_name = last_name
    patient.second_last_name = "Garcia"
    patient.document_type = document_type
    patient.document_number = document_number
    patient.birth_date = date(1985, 3, 15)
    patient.gender = "M"
    patient.blood_type = "O+"
    patient.is_active = is_active
    patient.status = "active"
    patient.country = "DO"
    patient.created_at = datetime.now(timezone.utc)
    patient.updated_at = datetime.now(timezone.utc)
    patient.insurance_policies = []
    return patient


# =============================================
# Tests de creacion de pacientes
# =============================================

class TestPatientServiceCreacion:
    """Grupo de tests para la creacion de pacientes."""

    @pytest.mark.asyncio
    async def test_crear_paciente_exitoso_genera_mrn(self):
        """Verifica que al crear un paciente se genera un MRN unico."""
        data = _crear_schema_paciente()

        # Mock: no hay duplicados, count = 0
        resultado_duplicado = MagicMock()
        resultado_duplicado.scalar_one_or_none.return_value = None

        resultado_count = MagicMock()
        resultado_count.scalar.return_value = 0

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(side_effect=[resultado_duplicado, resultado_count])
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PatientService(db)

        with patch("app.modules.patients.service.publish", new_callable=AsyncMock):
            patient = await service.create_patient(data, created_by=uuid.uuid4())

        assert patient is not None, "Debe crear el paciente exitosamente"
        assert patient.mrn == "HMIS-00000001", (
            "El MRN generado debe seguir el formato HMIS-XXXXXXXX"
        )
        db.add.assert_called(), "Debe agregar el paciente a la sesion"
        db.flush.assert_called(), "Debe hacer flush para persistir"

    @pytest.mark.asyncio
    async def test_crear_paciente_con_seguro(self):
        """Verifica que se crean las polizas de seguro asociadas."""
        from app.modules.patients.schemas import PatientInsuranceCreate

        poliza = PatientInsuranceCreate(
            insurer_name="ARS Humano",
            policy_number="HUM-123456",
            plan_type="Contributivo",
            coverage_start=date(2025, 1, 1),
            copay_percentage=20.0,
            is_primary=True,
        )
        data = _crear_schema_paciente(insurance_policies=[poliza])

        resultado_duplicado = MagicMock()
        resultado_duplicado.scalar_one_or_none.return_value = None

        resultado_count = MagicMock()
        resultado_count.scalar.return_value = 0

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(side_effect=[resultado_duplicado, resultado_count])
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PatientService(db)

        with patch("app.modules.patients.service.publish", new_callable=AsyncMock):
            patient = await service.create_patient(data, created_by=uuid.uuid4())

        assert patient is not None, "Debe crear el paciente con su poliza"
        # db.add se llama 1 vez para el paciente + 1 vez para la poliza
        assert db.add.call_count >= 2, (
            "Debe agregar tanto el paciente como la poliza de seguro"
        )

    @pytest.mark.asyncio
    async def test_crear_paciente_duplicado_lanza_error(self):
        """Verifica que no se permite crear un paciente con documento duplicado."""
        paciente_existente = _crear_paciente_mock()

        resultado_duplicado = MagicMock()
        resultado_duplicado.scalar_one_or_none.return_value = paciente_existente

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado_duplicado)

        service = PatientService(db)
        data = _crear_schema_paciente()

        with pytest.raises(ValueError, match="Ya existe un paciente"):
            await service.create_patient(data)

    @pytest.mark.asyncio
    async def test_mrn_secuencial_incrementa(self):
        """Verifica que el MRN se genera secuencialmente."""
        data = _crear_schema_paciente(
            document_number="00298765432",
            first_name="Maria",
            last_name="Rodriguez",
        )

        resultado_duplicado = MagicMock()
        resultado_duplicado.scalar_one_or_none.return_value = None

        # Simular que ya hay 5 pacientes
        resultado_count = MagicMock()
        resultado_count.scalar.return_value = 5

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(side_effect=[resultado_duplicado, resultado_count])
        db.add = MagicMock()
        db.flush = AsyncMock()

        service = PatientService(db)

        with patch("app.modules.patients.service.publish", new_callable=AsyncMock):
            patient = await service.create_patient(data)

        assert patient.mrn == "HMIS-00000006", (
            "El MRN debe ser secuencial basado en el conteo existente"
        )


# =============================================
# Tests de busqueda de pacientes
# =============================================

class TestPatientServiceBusqueda:
    """Grupo de tests para la busqueda y consulta de pacientes."""

    @pytest.mark.asyncio
    async def test_buscar_pacientes_por_nombre(self):
        """Verifica que la busqueda por nombre retorna resultados."""
        paciente = _crear_paciente_mock(first_name="Ana", last_name="Martinez")

        resultado_count = MagicMock()
        resultado_count.scalar.return_value = 1

        resultado_query = MagicMock()
        resultado_query.scalars.return_value.all.return_value = [paciente]

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(side_effect=[resultado_count, resultado_query])

        service = PatientService(db)
        params = PatientSearchParams(query="Ana")

        patients, total = await service.search_patients(params)

        assert total == 1, "Debe encontrar exactamente 1 paciente"
        assert len(patients) == 1, "La lista debe contener 1 paciente"
        assert patients[0].first_name == "Ana", "Debe retornar el paciente correcto"

    @pytest.mark.asyncio
    async def test_buscar_pacientes_sin_resultados(self):
        """Verifica que una busqueda sin coincidencias retorna lista vacia."""
        resultado_count = MagicMock()
        resultado_count.scalar.return_value = 0

        resultado_query = MagicMock()
        resultado_query.scalars.return_value.all.return_value = []

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(side_effect=[resultado_count, resultado_query])

        service = PatientService(db)
        params = PatientSearchParams(query="ZZZNoExisteZZZ")

        patients, total = await service.search_patients(params)

        assert total == 0, "No debe encontrar pacientes"
        assert len(patients) == 0, "La lista debe estar vacia"

    @pytest.mark.asyncio
    async def test_obtener_paciente_por_mrn(self):
        """Verifica que se puede obtener un paciente por su MRN."""
        paciente = _crear_paciente_mock(mrn="HMIS-00000042")

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = paciente

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)

        service = PatientService(db)

        found = await service.get_patient_by_mrn("HMIS-00000042")

        assert found is not None, "Debe encontrar el paciente por MRN"
        assert found.mrn == "HMIS-00000042", "El MRN debe coincidir"

    @pytest.mark.asyncio
    async def test_obtener_paciente_por_mrn_inexistente(self):
        """Verifica que un MRN inexistente retorna None."""
        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = None

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)

        service = PatientService(db)

        found = await service.get_patient_by_mrn("HMIS-99999999")

        assert found is None, "Un MRN inexistente debe retornar None"

    @pytest.mark.asyncio
    async def test_obtener_paciente_por_id(self):
        """Verifica que se puede obtener un paciente por su UUID."""
        paciente = _crear_paciente_mock()
        patient_id = paciente.id

        resultado = MagicMock()
        resultado.scalar_one_or_none.return_value = paciente

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=resultado)

        service = PatientService(db)

        found = await service.get_patient(patient_id)

        assert found is not None, "Debe encontrar el paciente por ID"
        assert found.id == patient_id, "El ID debe coincidir"

    @pytest.mark.asyncio
    async def test_buscar_pacientes_filtra_por_genero(self):
        """Verifica que se puede filtrar la busqueda por genero."""
        paciente_f = _crear_paciente_mock(first_name="Lucia", last_name="Reyes")
        paciente_f.gender = "F"

        resultado_count = MagicMock()
        resultado_count.scalar.return_value = 1

        resultado_query = MagicMock()
        resultado_query.scalars.return_value.all.return_value = [paciente_f]

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(side_effect=[resultado_count, resultado_query])

        service = PatientService(db)
        params = PatientSearchParams(gender="F")

        patients, total = await service.search_patients(params)

        assert total == 1, "Debe encontrar pacientes del genero especificado"
