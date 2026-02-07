"""
Tests unitarios para los servicios del modulo de Historia Clinica Electronica (EMR).

Valida la logica de negocio de todos los servicios EMR:
- EncounterService: encuentros clinicos (CRUD, transiciones de estado)
- ClinicalNoteService: notas clinicas (creacion, firma, enmiendas)
- DiagnosisService: diagnosticos CIE-10 (CRUD, filtros por paciente)
- VitalSignsService: signos vitales (registro, calculo automatico de BMI)
- AllergyService: alergias (CRUD, verificacion de alergias a medicamentos)
- MedicalOrderService: ordenes medicas (CRUD, actualizacion de estado)
- ProblemListService: lista de problemas del paciente (CRUD, borrado logico)
- ClinicalTemplateService: plantillas clinicas (CRUD, filtros por especialidad)

Estrategia: Se crean instancias reales en la base de datos SQLite en memoria
mediante los metodos de servicio y se verifican los resultados.
"""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

# =============================================
# Compatibilidad JSONB -> JSON para SQLite en tests
# Se registra antes de que setup_database cree las tablas.
# =============================================
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_para_sqlite(element, compiler, **kw):
    """Traduce el tipo JSONB de PostgreSQL a JSON nativo de SQLite."""
    return "JSON"

from app.modules.emr.models import (
    Allergy,
    ClinicalNote,
    ClinicalTemplate,
    Diagnosis,
    Encounter,
    MedicalOrder,
    PatientProblemList,
    VitalSigns,
)
from app.modules.emr.schemas import (
    AllergyUpdate,
    ClinicalNoteCreate,
    DiagnosisCreate,
    DiagnosisUpdate,
    EncounterCreate,
    EncounterUpdate,
    MedicalOrderCreate,
    MedicalOrderStatusUpdate,
    ProblemListCreate,
    ProblemListUpdate,
    VitalSignsCreate,
)
from app.modules.emr.service import (
    AllergyService,
    ClinicalNoteService,
    ClinicalTemplateService,
    DiagnosisService,
    EncounterService,
    MedicalOrderService,
    ProblemListService,
    VitalSignsService,
)


# =============================================
# Fixture local: mockear publish dentro del servicio EMR
# =============================================

@pytest.fixture(autouse=True)
def _mock_emr_service_publish():
    """
    Mockea la funcion publish importada directamente en el modulo de servicio EMR.
    Complementa el mock global de conftest para garantizar que las llamadas
    a publish() dentro de service.py no intenten conectar con Redis.
    """
    with patch("app.modules.emr.service.publish", new_callable=AsyncMock) as mock_pub:
        yield mock_pub


# =============================================
# Helpers: generacion de datos de prueba
# =============================================

def _id() -> uuid.UUID:
    """Genera un UUID aleatorio para datos de prueba."""
    return uuid.uuid4()


def _crear_encuentro_schema(
    patient_id: uuid.UUID | None = None,
    provider_id: uuid.UUID | None = None,
    encounter_type: str = "ambulatory",
    chief_complaint: str | None = "Dolor de cabeza persistente",
) -> EncounterCreate:
    """Crea un schema EncounterCreate con valores por defecto razonables."""
    return EncounterCreate(
        patient_id=patient_id or _id(),
        provider_id=provider_id or _id(),
        encounter_type=encounter_type,
        chief_complaint=chief_complaint,
    )


def _crear_nota_schema(
    encounter_id: uuid.UUID,
    note_type: str = "soap",
    content_json: dict | None = None,
    amendment_of: uuid.UUID | None = None,
    amendment_reason: str | None = None,
) -> ClinicalNoteCreate:
    """Crea un schema ClinicalNoteCreate con contenido SOAP por defecto."""
    if content_json is None:
        content_json = {
            "subjective": "Paciente refiere cefalea desde hace 3 dias",
            "objective": "PA: 120/80, FC: 72, Temp: 36.5C",
            "assessment": "Cefalea tensional",
            "plan": "Acetaminofen 500mg c/8h x 5 dias, control en 1 semana",
        }
    return ClinicalNoteCreate(
        encounter_id=encounter_id,
        note_type=note_type,
        content_json=content_json,
        amendment_of=amendment_of,
        amendment_reason=amendment_reason,
    )


def _crear_diagnostico_schema(
    encounter_id: uuid.UUID,
    icd10_code: str = "G44.2",
    description: str = "Cefalea tensional cronica",
    diagnosis_type: str = "principal",
) -> DiagnosisCreate:
    """Crea un schema DiagnosisCreate con diagnostico de ejemplo."""
    return DiagnosisCreate(
        encounter_id=encounter_id,
        icd10_code=icd10_code,
        description=description,
        diagnosis_type=diagnosis_type,
    )


def _crear_signos_vitales_schema(
    encounter_id: uuid.UUID,
    patient_id: uuid.UUID,
    weight: float | None = 75.0,
    height: float | None = 170.0,
    temperature: float | None = 36.5,
    heart_rate: int | None = 72,
    blood_pressure_sys: int | None = 120,
    blood_pressure_dia: int | None = 80,
) -> VitalSignsCreate:
    """Crea un schema VitalSignsCreate con signos vitales tipicos."""
    return VitalSignsCreate(
        encounter_id=encounter_id,
        patient_id=patient_id,
        weight=weight,
        height=height,
        temperature=temperature,
        heart_rate=heart_rate,
        blood_pressure_sys=blood_pressure_sys,
        blood_pressure_dia=blood_pressure_dia,
    )


def _crear_orden_schema(
    encounter_id: uuid.UUID,
    patient_id: uuid.UUID,
    order_type: str = "lab",
    priority: str = "routine",
    details_json: dict | None = None,
) -> MedicalOrderCreate:
    """Crea un schema MedicalOrderCreate con orden de laboratorio por defecto."""
    if details_json is None:
        details_json = {
            "test_code": "CBC",
            "test_name": "Hemograma completo",
            "instructions": "Ayuno de 8 horas",
        }
    return MedicalOrderCreate(
        encounter_id=encounter_id,
        patient_id=patient_id,
        order_type=order_type,
        priority=priority,
        details_json=details_json,
    )


def _crear_problema_schema(
    patient_id: uuid.UUID,
    icd10_code: str = "E11",
    description: str = "Diabetes mellitus tipo 2",
) -> ProblemListCreate:
    """Crea un schema ProblemListCreate con problema cronico de ejemplo."""
    return ProblemListCreate(
        patient_id=patient_id,
        icd10_code=icd10_code,
        description=description,
    )


# =============================================
# Helper asincrono: crear un encuentro en BD
# =============================================

async def _crear_encuentro_en_bd(
    db: AsyncSession,
    patient_id: uuid.UUID | None = None,
    provider_id: uuid.UUID | None = None,
    encounter_type: str = "ambulatory",
) -> Encounter:
    """Crea un encuentro en la BD y lo devuelve (helper reutilizable)."""
    svc = EncounterService(db)
    pid = patient_id or _id()
    prov = provider_id or _id()
    data = _crear_encuentro_schema(
        patient_id=pid, provider_id=prov, encounter_type=encounter_type
    )
    return await svc.create_encounter(data, created_by=prov)


# =============================================
# Tests: EncounterService
# =============================================

class TestEncounterServiceCreacion:
    """Tests para la creacion de encuentros clinicos."""

    @pytest.mark.asyncio
    async def test_crear_encuentro_ambulatorio(self, db_session: AsyncSession):
        """Verifica que se crea un encuentro ambulatorio con estado in_progress."""
        svc = EncounterService(db_session)
        patient_id = _id()
        provider_id = _id()
        data = _crear_encuentro_schema(
            patient_id=patient_id,
            provider_id=provider_id,
            encounter_type="ambulatory",
            chief_complaint="Fiebre alta hace 2 dias",
        )

        encuentro = await svc.create_encounter(data, created_by=provider_id)

        assert encuentro.id is not None
        assert encuentro.patient_id == patient_id
        assert encuentro.provider_id == provider_id
        assert encuentro.encounter_type == "ambulatory"
        assert encuentro.status == "in_progress"
        assert encuentro.chief_complaint == "Fiebre alta hace 2 dias"

    @pytest.mark.asyncio
    async def test_crear_encuentro_emergencia(self, db_session: AsyncSession):
        """Verifica que se puede crear un encuentro de tipo emergencia."""
        svc = EncounterService(db_session)
        data = _crear_encuentro_schema(encounter_type="emergency")

        encuentro = await svc.create_encounter(data, created_by=_id())

        assert encuentro.encounter_type == "emergency"
        assert encuentro.status == "in_progress"

    @pytest.mark.asyncio
    async def test_crear_encuentro_hospitalizacion(self, db_session: AsyncSession):
        """Verifica creacion de encuentro de hospitalizacion (inpatient)."""
        svc = EncounterService(db_session)
        data = _crear_encuentro_schema(encounter_type="inpatient")

        encuentro = await svc.create_encounter(data, created_by=_id())

        assert encuentro.encounter_type == "inpatient"


class TestEncounterServiceConsulta:
    """Tests para la consulta y obtencion de encuentros."""

    @pytest.mark.asyncio
    async def test_obtener_encuentro_existente(self, db_session: AsyncSession):
        """Verifica que se obtiene un encuentro con sus relaciones cargadas."""
        encuentro = await _crear_encuentro_en_bd(db_session)

        svc = EncounterService(db_session)
        resultado = await svc.get_encounter(encuentro.id)

        assert resultado is not None
        assert resultado.id == encuentro.id
        assert resultado.clinical_notes == []
        assert resultado.diagnoses == []
        assert resultado.vital_signs == []
        assert resultado.medical_orders == []

    @pytest.mark.asyncio
    async def test_obtener_encuentro_inexistente(self, db_session: AsyncSession):
        """Verifica que retorna None para un ID inexistente."""
        svc = EncounterService(db_session)

        resultado = await svc.get_encounter(_id())

        assert resultado is None

    @pytest.mark.asyncio
    async def test_listar_encuentros_sin_filtros(self, db_session: AsyncSession):
        """Verifica que se listan todos los encuentros activos."""
        svc = EncounterService(db_session)
        # Crear 3 encuentros
        for _ in range(3):
            await _crear_encuentro_en_bd(db_session)

        encuentros, total = await svc.list_encounters()

        assert total == 3
        assert len(encuentros) == 3

    @pytest.mark.asyncio
    async def test_listar_encuentros_filtro_paciente(self, db_session: AsyncSession):
        """Verifica filtrado de encuentros por patient_id."""
        svc = EncounterService(db_session)
        paciente_objetivo = _id()

        # 2 encuentros del paciente objetivo
        await _crear_encuentro_en_bd(db_session, patient_id=paciente_objetivo)
        await _crear_encuentro_en_bd(db_session, patient_id=paciente_objetivo)
        # 1 encuentro de otro paciente
        await _crear_encuentro_en_bd(db_session)

        encuentros, total = await svc.list_encounters(patient_id=paciente_objetivo)

        assert total == 2
        assert len(encuentros) == 2
        assert all(e.patient_id == paciente_objetivo for e in encuentros)

    @pytest.mark.asyncio
    async def test_listar_encuentros_filtro_tipo(self, db_session: AsyncSession):
        """Verifica filtrado por tipo de encuentro."""
        svc = EncounterService(db_session)
        await _crear_encuentro_en_bd(db_session, encounter_type="ambulatory")
        await _crear_encuentro_en_bd(db_session, encounter_type="emergency")
        await _crear_encuentro_en_bd(db_session, encounter_type="emergency")

        encuentros, total = await svc.list_encounters(encounter_type="emergency")

        assert total == 2
        assert all(e.encounter_type == "emergency" for e in encuentros)

    @pytest.mark.asyncio
    async def test_listar_encuentros_paginacion(self, db_session: AsyncSession):
        """Verifica que la paginacion offset/limit funciona correctamente."""
        svc = EncounterService(db_session)
        for _ in range(5):
            await _crear_encuentro_en_bd(db_session)

        # Primera pagina: 2 resultados
        encuentros, total = await svc.list_encounters(offset=0, limit=2)
        assert total == 5
        assert len(encuentros) == 2

        # Segunda pagina: 2 resultados
        encuentros2, total2 = await svc.list_encounters(offset=2, limit=2)
        assert total2 == 5
        assert len(encuentros2) == 2

        # Los IDs deben ser diferentes entre paginas
        ids_pag1 = {e.id for e in encuentros}
        ids_pag2 = {e.id for e in encuentros2}
        assert ids_pag1.isdisjoint(ids_pag2)


class TestEncounterServiceTransiciones:
    """Tests para transiciones de estado de encuentros (completar, cancelar)."""

    @pytest.mark.asyncio
    async def test_completar_encuentro(self, db_session: AsyncSession):
        """Verifica que completar un encuentro cambia su estado y registra la disposicion."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = EncounterService(db_session)
        medico_id = _id()

        completado = await svc.complete_encounter(
            encuentro.id, disposition="alta", updated_by=medico_id
        )

        assert completado is not None
        assert completado.status == "completed"
        assert completado.disposition == "alta"
        assert completado.end_datetime is not None
        assert completado.updated_by == medico_id

    @pytest.mark.asyncio
    async def test_completar_encuentro_inexistente(self, db_session: AsyncSession):
        """Verifica que completar un encuentro inexistente retorna None."""
        svc = EncounterService(db_session)

        resultado = await svc.complete_encounter(_id(), disposition="alta")

        assert resultado is None

    @pytest.mark.asyncio
    async def test_actualizar_encuentro_en_progreso(self, db_session: AsyncSession):
        """Verifica que se puede actualizar un encuentro en progreso."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = EncounterService(db_session)
        data = EncounterUpdate(chief_complaint="Dolor abdominal agudo")

        actualizado = await svc.update_encounter(encuentro.id, data, updated_by=_id())

        assert actualizado is not None
        assert actualizado.chief_complaint == "Dolor abdominal agudo"

    @pytest.mark.asyncio
    async def test_actualizar_encuentro_completado_lanza_error(
        self, db_session: AsyncSession
    ):
        """Verifica que no se puede modificar un encuentro ya completado."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = EncounterService(db_session)
        await svc.complete_encounter(encuentro.id, disposition="alta")

        data = EncounterUpdate(chief_complaint="Intento de cambio")

        with pytest.raises(ValueError, match="No se puede modificar un encuentro completado"):
            await svc.update_encounter(encuentro.id, data)

    @pytest.mark.asyncio
    async def test_actualizar_encuentro_inexistente(self, db_session: AsyncSession):
        """Verifica que actualizar un encuentro inexistente retorna None."""
        svc = EncounterService(db_session)
        data = EncounterUpdate(chief_complaint="No existe")

        resultado = await svc.update_encounter(_id(), data)

        assert resultado is None

    @pytest.mark.asyncio
    async def test_cancelar_encuentro_en_progreso(self, db_session: AsyncSession):
        """Verifica que se puede cancelar un encuentro en progreso."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = EncounterService(db_session)
        medico_id = _id()

        cancelado = await svc.cancel_encounter(encuentro.id, updated_by=medico_id)

        assert cancelado is not None
        assert cancelado.status == "cancelled"
        assert cancelado.updated_by == medico_id

    @pytest.mark.asyncio
    async def test_cancelar_encuentro_completado_lanza_error(
        self, db_session: AsyncSession
    ):
        """Verifica que no se puede cancelar un encuentro ya completado."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = EncounterService(db_session)
        await svc.complete_encounter(encuentro.id, disposition="alta")

        with pytest.raises(ValueError, match="No se puede cancelar un encuentro completado"):
            await svc.cancel_encounter(encuentro.id)

    @pytest.mark.asyncio
    async def test_cancelar_encuentro_inexistente(self, db_session: AsyncSession):
        """Verifica que cancelar un encuentro inexistente retorna None."""
        svc = EncounterService(db_session)

        resultado = await svc.cancel_encounter(_id())

        assert resultado is None


# =============================================
# Tests: ClinicalNoteService
# =============================================

class TestClinicalNoteServiceCreacion:
    """Tests para la creacion de notas clinicas."""

    @pytest.mark.asyncio
    async def test_crear_nota_soap(self, db_session: AsyncSession):
        """Verifica la creacion de una nota clinica tipo SOAP."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)
        medico_id = _id()

        data = _crear_nota_schema(encuentro.id)
        nota = await svc.create_note(data, created_by=medico_id)

        assert nota.id is not None
        assert nota.encounter_id == encuentro.id
        assert nota.note_type == "soap"
        assert nota.is_signed is False
        assert nota.signed_at is None
        assert nota.created_by == medico_id
        assert "subjective" in nota.content_json

    @pytest.mark.asyncio
    async def test_crear_nota_procedimiento(self, db_session: AsyncSession):
        """Verifica creacion de nota de tipo procedimiento."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        data = _crear_nota_schema(
            encuentro.id,
            note_type="procedure",
            content_json={
                "procedure": "Sutura de herida cortante en antebrazo derecho",
                "anesthesia": "Lidocaina 2% local",
                "findings": "Herida limpia, 3cm de longitud",
                "complications": "Ninguna",
            },
        )
        nota = await svc.create_note(data)

        assert nota.note_type == "procedure"
        assert nota.content_json["procedure"] is not None


class TestClinicalNoteServiceFirma:
    """Tests para la firma e inmutabilidad de notas clinicas."""

    @pytest.mark.asyncio
    async def test_firmar_nota(self, db_session: AsyncSession):
        """Verifica que firmar una nota la marca como inmutable."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        data = _crear_nota_schema(encuentro.id)
        nota = await svc.create_note(data)
        medico_id = _id()

        firmada = await svc.sign_note(nota.id, signed_by=medico_id)

        assert firmada is not None
        assert firmada.is_signed is True
        assert firmada.signed_at is not None
        assert firmada.signed_by == medico_id

    @pytest.mark.asyncio
    async def test_firmar_nota_ya_firmada_lanza_error(self, db_session: AsyncSession):
        """Verifica que intentar firmar una nota ya firmada lanza ValueError."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        data = _crear_nota_schema(encuentro.id)
        nota = await svc.create_note(data)
        medico_id = _id()

        await svc.sign_note(nota.id, signed_by=medico_id)

        with pytest.raises(ValueError, match="La nota ya esta firmada"):
            await svc.sign_note(nota.id, signed_by=_id())

    @pytest.mark.asyncio
    async def test_firmar_nota_inexistente(self, db_session: AsyncSession):
        """Verifica que firmar una nota inexistente retorna None."""
        svc = ClinicalNoteService(db_session)

        resultado = await svc.sign_note(_id(), signed_by=_id())

        assert resultado is None


class TestClinicalNoteServiceEnmienda:
    """Tests para la validacion de enmiendas (addendums)."""

    @pytest.mark.asyncio
    async def test_crear_enmienda_a_nota_firmada(self, db_session: AsyncSession):
        """Verifica que se puede crear una enmienda para una nota firmada."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        # Crear y firmar nota original
        data_original = _crear_nota_schema(encuentro.id)
        nota_original = await svc.create_note(data_original)
        await svc.sign_note(nota_original.id, signed_by=_id())

        # Crear enmienda
        data_enmienda = _crear_nota_schema(
            encuentro.id,
            note_type="addendum",
            content_json={"addendum": "Se agrega resultado de laboratorio: hemoglobina 12.5"},
            amendment_of=nota_original.id,
            amendment_reason="Resultado de lab recibido despues de la consulta",
        )
        enmienda = await svc.create_note(data_enmienda)

        assert enmienda.id is not None
        assert enmienda.amendment_of == nota_original.id
        assert enmienda.note_type == "addendum"

    @pytest.mark.asyncio
    async def test_crear_enmienda_a_nota_sin_firmar_lanza_error(
        self, db_session: AsyncSession
    ):
        """Verifica que no se puede enmendar una nota que no esta firmada."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        # Crear nota sin firmar
        data_original = _crear_nota_schema(encuentro.id)
        nota_sin_firmar = await svc.create_note(data_original)

        # Intentar crear enmienda a nota sin firmar
        data_enmienda = _crear_nota_schema(
            encuentro.id,
            note_type="addendum",
            amendment_of=nota_sin_firmar.id,
            amendment_reason="Correccion de datos",
        )

        with pytest.raises(ValueError, match="Solo se pueden enmendar notas firmadas"):
            await svc.create_note(data_enmienda)

    @pytest.mark.asyncio
    async def test_crear_enmienda_a_nota_inexistente_lanza_error(
        self, db_session: AsyncSession
    ):
        """Verifica que no se puede enmendar una nota que no existe."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        data_enmienda = _crear_nota_schema(
            encuentro.id,
            note_type="addendum",
            amendment_of=_id(),  # ID inexistente
            amendment_reason="Correccion",
        )

        with pytest.raises(ValueError, match="Solo se pueden enmendar notas firmadas"):
            await svc.create_note(data_enmienda)


class TestClinicalNoteServiceConsulta:
    """Tests para la consulta de notas clinicas."""

    @pytest.mark.asyncio
    async def test_obtener_nota_por_id(self, db_session: AsyncSession):
        """Verifica la obtencion de una nota clinica por su ID."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)
        data = _crear_nota_schema(encuentro.id)
        nota = await svc.create_note(data)

        resultado = await svc.get_note(nota.id)

        assert resultado is not None
        assert resultado.id == nota.id

    @pytest.mark.asyncio
    async def test_obtener_nota_inexistente(self, db_session: AsyncSession):
        """Verifica que retorna None para una nota inexistente."""
        svc = ClinicalNoteService(db_session)

        resultado = await svc.get_note(_id())

        assert resultado is None

    @pytest.mark.asyncio
    async def test_obtener_notas_por_encuentro(self, db_session: AsyncSession):
        """Verifica que se obtienen todas las notas de un encuentro."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        # Crear 3 notas para el mismo encuentro
        for tipo in ["soap", "progress", "procedure"]:
            data = _crear_nota_schema(encuentro.id, note_type=tipo)
            await svc.create_note(data)

        notas = await svc.get_encounter_notes(encuentro.id)

        assert len(notas) == 3

    @pytest.mark.asyncio
    async def test_notas_de_encuentro_vacio(self, db_session: AsyncSession):
        """Verifica que un encuentro sin notas devuelve lista vacia."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = ClinicalNoteService(db_session)

        notas = await svc.get_encounter_notes(encuentro.id)

        assert notas == []


# =============================================
# Tests: DiagnosisService
# =============================================

class TestDiagnosisServiceCRUD:
    """Tests para el servicio de diagnosticos CIE-10."""

    @pytest.mark.asyncio
    async def test_crear_diagnostico(self, db_session: AsyncSession):
        """Verifica la creacion de un diagnostico principal."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = DiagnosisService(db_session)
        medico_id = _id()

        data = _crear_diagnostico_schema(encuentro.id)
        dx = await svc.create_diagnosis(data, created_by=medico_id)

        assert dx.id is not None
        assert dx.encounter_id == encuentro.id
        assert dx.icd10_code == "G44.2"
        assert dx.description == "Cefalea tensional cronica"
        assert dx.diagnosis_type == "principal"
        assert dx.status == "active"
        assert dx.created_by == medico_id

    @pytest.mark.asyncio
    async def test_crear_diagnostico_secundario(self, db_session: AsyncSession):
        """Verifica creacion de un diagnostico secundario."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = DiagnosisService(db_session)

        data = _crear_diagnostico_schema(
            encuentro.id,
            icd10_code="I10",
            description="Hipertension arterial esencial",
            diagnosis_type="secondary",
        )
        dx = await svc.create_diagnosis(data)

        assert dx.diagnosis_type == "secondary"
        assert dx.icd10_code == "I10"

    @pytest.mark.asyncio
    async def test_obtener_diagnosticos_paciente(self, db_session: AsyncSession):
        """Verifica la obtencion de diagnosticos por paciente (a traves de encuentros)."""
        patient_id = _id()
        svc_enc = EncounterService(db_session)
        svc_dx = DiagnosisService(db_session)

        # Crear 2 encuentros para el mismo paciente
        enc1 = await svc_enc.create_encounter(
            _crear_encuentro_schema(patient_id=patient_id), created_by=_id()
        )
        enc2 = await svc_enc.create_encounter(
            _crear_encuentro_schema(patient_id=patient_id), created_by=_id()
        )

        # Diagnostico en cada encuentro
        await svc_dx.create_diagnosis(
            _crear_diagnostico_schema(enc1.id, icd10_code="G44.2")
        )
        await svc_dx.create_diagnosis(
            _crear_diagnostico_schema(enc2.id, icd10_code="I10")
        )

        diagnosticos = await svc_dx.get_patient_diagnoses(patient_id)

        assert len(diagnosticos) == 2

    @pytest.mark.asyncio
    async def test_obtener_diagnosticos_paciente_filtrado_por_estado(
        self, db_session: AsyncSession
    ):
        """Verifica filtrado de diagnosticos por estado (activo/resuelto)."""
        patient_id = _id()
        svc_enc = EncounterService(db_session)
        svc_dx = DiagnosisService(db_session)

        enc = await svc_enc.create_encounter(
            _crear_encuentro_schema(patient_id=patient_id), created_by=_id()
        )

        dx1 = await svc_dx.create_diagnosis(
            _crear_diagnostico_schema(enc.id, icd10_code="G44.2")
        )
        await svc_dx.create_diagnosis(
            _crear_diagnostico_schema(enc.id, icd10_code="I10")
        )
        # Resolver el primer diagnostico
        await svc_dx.update_diagnosis(
            dx1.id,
            DiagnosisUpdate(status="resolved", resolved_date=date.today()),
        )

        # Solo diagnosticos activos
        activos = await svc_dx.get_patient_diagnoses(patient_id, status="active")
        assert len(activos) == 1
        assert activos[0].icd10_code == "I10"

    @pytest.mark.asyncio
    async def test_actualizar_diagnostico(self, db_session: AsyncSession):
        """Verifica la actualizacion de un diagnostico (ej: marcar resuelto)."""
        encuentro = await _crear_encuentro_en_bd(db_session)
        svc = DiagnosisService(db_session)

        data = _crear_diagnostico_schema(encuentro.id)
        dx = await svc.create_diagnosis(data)

        update_data = DiagnosisUpdate(
            status="resolved",
            resolved_date=date.today(),
            notes="Paciente asintomatico tras tratamiento",
        )
        actualizado = await svc.update_diagnosis(dx.id, update_data, updated_by=_id())

        assert actualizado is not None
        assert actualizado.status == "resolved"
        assert actualizado.resolved_date == date.today()
        assert actualizado.notes == "Paciente asintomatico tras tratamiento"

    @pytest.mark.asyncio
    async def test_actualizar_diagnostico_inexistente(self, db_session: AsyncSession):
        """Verifica que actualizar un diagnostico inexistente retorna None."""
        svc = DiagnosisService(db_session)
        update_data = DiagnosisUpdate(status="resolved")

        resultado = await svc.update_diagnosis(_id(), update_data)

        assert resultado is None


# =============================================
# Tests: VitalSignsService
# =============================================

class TestVitalSignsServiceRegistro:
    """Tests para el registro y calculo automatico de signos vitales."""

    @pytest.mark.asyncio
    async def test_registrar_signos_vitales_con_calculo_bmi(
        self, db_session: AsyncSession
    ):
        """
        Verifica que se calcula automaticamente el BMI cuando se
        proporcionan peso (kg) y altura (cm).
        Formula: BMI = peso / (altura_m ^ 2)
        Ejemplo: 75 / (1.70^2) = 75 / 2.89 = 25.95... redondeado a 26.0
        """
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = VitalSignsService(db_session)
        enfermera_id = _id()

        data = _crear_signos_vitales_schema(
            encounter_id=encuentro.id,
            patient_id=patient_id,
            weight=75.0,
            height=170.0,
        )
        vitales = await svc.record_vitals(data, measured_by=enfermera_id)

        assert vitales.id is not None
        assert vitales.weight == 75.0
        assert vitales.height == 170.0
        # BMI = 75 / (1.70^2) = 25.95... redondeado a 26.0
        bmi_esperado = round(75.0 / (1.70 ** 2), 1)
        assert vitales.bmi == bmi_esperado
        assert vitales.measured_by == enfermera_id

    @pytest.mark.asyncio
    async def test_registrar_signos_sin_peso_sin_bmi(self, db_session: AsyncSession):
        """Verifica que no se calcula BMI si falta el peso."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = VitalSignsService(db_session)

        data = _crear_signos_vitales_schema(
            encounter_id=encuentro.id,
            patient_id=patient_id,
            weight=None,
            height=170.0,
        )
        vitales = await svc.record_vitals(data)

        assert vitales.bmi is None

    @pytest.mark.asyncio
    async def test_registrar_signos_sin_altura_sin_bmi(self, db_session: AsyncSession):
        """Verifica que no se calcula BMI si falta la altura."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = VitalSignsService(db_session)

        data = _crear_signos_vitales_schema(
            encounter_id=encuentro.id,
            patient_id=patient_id,
            weight=80.0,
            height=None,
        )
        vitales = await svc.record_vitals(data)

        assert vitales.bmi is None

    @pytest.mark.asyncio
    async def test_registrar_signos_altura_cero_sin_bmi(self, db_session: AsyncSession):
        """Verifica que no se calcula BMI si la altura es cero (evita division por cero)."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = VitalSignsService(db_session)

        data = _crear_signos_vitales_schema(
            encounter_id=encuentro.id,
            patient_id=patient_id,
            weight=70.0,
            height=0.0,
        )
        vitales = await svc.record_vitals(data)

        assert vitales.bmi is None

    @pytest.mark.asyncio
    async def test_registrar_signos_completos(self, db_session: AsyncSession):
        """Verifica el registro de todos los campos de signos vitales."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = VitalSignsService(db_session)

        data = VitalSignsCreate(
            encounter_id=encuentro.id,
            patient_id=patient_id,
            temperature=37.2,
            heart_rate=88,
            blood_pressure_sys=140,
            blood_pressure_dia=90,
            respiratory_rate=18,
            oxygen_saturation=97.5,
            weight=85.0,
            height=175.0,
            pain_scale=3,
            glucose=110.0,
            notes="Paciente ligeramente hipertenso",
        )
        vitales = await svc.record_vitals(data)

        assert vitales.temperature == 37.2
        assert vitales.heart_rate == 88
        assert vitales.blood_pressure_sys == 140
        assert vitales.blood_pressure_dia == 90
        assert vitales.respiratory_rate == 18
        assert vitales.oxygen_saturation == 97.5
        assert vitales.pain_scale == 3
        assert vitales.glucose == 110.0
        assert vitales.notes == "Paciente ligeramente hipertenso"
        assert vitales.bmi is not None

    @pytest.mark.asyncio
    async def test_historial_signos_vitales(self, db_session: AsyncSession):
        """Verifica la obtencion del historial de signos vitales de un paciente."""
        patient_id = _id()
        svc_enc = EncounterService(db_session)
        svc_vs = VitalSignsService(db_session)

        # Crear multiples registros de vitales en encuentros distintos
        for _ in range(3):
            enc = await svc_enc.create_encounter(
                _crear_encuentro_schema(patient_id=patient_id), created_by=_id()
            )
            data = _crear_signos_vitales_schema(
                encounter_id=enc.id, patient_id=patient_id
            )
            await svc_vs.record_vitals(data)

        historial = await svc_vs.get_patient_vitals_history(patient_id)

        assert len(historial) == 3

    @pytest.mark.asyncio
    async def test_historial_signos_vitales_limite(self, db_session: AsyncSession):
        """Verifica que el parametro limit restringe el numero de resultados."""
        patient_id = _id()
        svc_enc = EncounterService(db_session)
        svc_vs = VitalSignsService(db_session)

        for _ in range(5):
            enc = await svc_enc.create_encounter(
                _crear_encuentro_schema(patient_id=patient_id), created_by=_id()
            )
            await svc_vs.record_vitals(
                _crear_signos_vitales_schema(encounter_id=enc.id, patient_id=patient_id)
            )

        historial = await svc_vs.get_patient_vitals_history(patient_id, limit=2)

        assert len(historial) == 2


# =============================================
# Tests: AllergyService
# =============================================

class TestAllergyServiceCRUD:
    """Tests para el servicio de alergias del paciente."""

    @pytest.mark.asyncio
    async def test_crear_alergia(self, db_session: AsyncSession):
        """Verifica la creacion de una alergia de tipo medicamento."""
        svc = AllergyService(db_session)
        patient_id = _id()

        alergia = await svc.create_allergy(
            patient_id=patient_id,
            allergen="Penicilina",
            allergen_type="drug",
            reaction="Urticaria generalizada",
            severity="severe",
            status="active",
        )

        assert alergia.id is not None
        assert alergia.patient_id == patient_id
        assert alergia.allergen == "Penicilina"
        assert alergia.allergen_type == "drug"
        assert alergia.reaction == "Urticaria generalizada"
        assert alergia.severity == "severe"

    @pytest.mark.asyncio
    async def test_obtener_alergias_paciente(self, db_session: AsyncSession):
        """Verifica la obtencion de alergias activas de un paciente."""
        svc = AllergyService(db_session)
        patient_id = _id()

        await svc.create_allergy(
            patient_id=patient_id,
            allergen="Penicilina",
            allergen_type="drug",
            severity="severe",
        )
        await svc.create_allergy(
            patient_id=patient_id,
            allergen="Mani",
            allergen_type="food",
            severity="moderate",
        )
        # Alergia de otro paciente (no debe aparecer)
        await svc.create_allergy(
            patient_id=_id(),
            allergen="Latex",
            allergen_type="latex",
            severity="mild",
        )

        alergias = await svc.get_patient_allergies(patient_id)

        assert len(alergias) == 2

    @pytest.mark.asyncio
    async def test_verificar_alergia_medicamento_encontrada(
        self, db_session: AsyncSession
    ):
        """Verifica que check_drug_allergy detecta una alergia a medicamento."""
        svc = AllergyService(db_session)
        patient_id = _id()

        await svc.create_allergy(
            patient_id=patient_id,
            allergen="Penicilina",
            allergen_type="drug",
            severity="severe",
            status="active",
        )
        await svc.create_allergy(
            patient_id=patient_id,
            allergen="Amoxicilina",
            allergen_type="drug",
            severity="moderate",
            status="active",
        )

        # Buscar por nombre parcial (ilike)
        resultado = await svc.check_drug_allergy(patient_id, "Penicilina")

        assert len(resultado) == 1
        assert resultado[0].allergen == "Penicilina"

    @pytest.mark.asyncio
    async def test_verificar_alergia_medicamento_sin_coincidencia(
        self, db_session: AsyncSession
    ):
        """Verifica que check_drug_allergy retorna lista vacia si no hay coincidencia."""
        svc = AllergyService(db_session)
        patient_id = _id()

        await svc.create_allergy(
            patient_id=patient_id,
            allergen="Penicilina",
            allergen_type="drug",
            severity="severe",
            status="active",
        )

        resultado = await svc.check_drug_allergy(patient_id, "Ibuprofeno")

        assert resultado == []

    @pytest.mark.asyncio
    async def test_verificar_alergia_excluye_tipo_no_medicamento(
        self, db_session: AsyncSession
    ):
        """Verifica que check_drug_allergy solo busca alergias de tipo 'drug'."""
        svc = AllergyService(db_session)
        patient_id = _id()

        # Alergia alimentaria con nombre que coincide
        await svc.create_allergy(
            patient_id=patient_id,
            allergen="Mani",
            allergen_type="food",
            severity="severe",
            status="active",
        )

        resultado = await svc.check_drug_allergy(patient_id, "Mani")

        assert resultado == []

    @pytest.mark.asyncio
    async def test_actualizar_alergia(self, db_session: AsyncSession):
        """Verifica la actualizacion de severidad y estado de una alergia."""
        svc = AllergyService(db_session)
        patient_id = _id()

        alergia = await svc.create_allergy(
            patient_id=patient_id,
            allergen="Sulfas",
            allergen_type="drug",
            severity="moderate",
            status="active",
        )

        update_data = AllergyUpdate(severity="mild", status="inactive")
        actualizada = await svc.update_allergy(
            alergia.id, update_data, updated_by=_id()
        )

        assert actualizada is not None
        assert actualizada.severity == "mild"
        assert actualizada.status == "inactive"

    @pytest.mark.asyncio
    async def test_actualizar_alergia_inexistente(self, db_session: AsyncSession):
        """Verifica que actualizar una alergia inexistente retorna None."""
        svc = AllergyService(db_session)
        update_data = AllergyUpdate(severity="severe")

        resultado = await svc.update_allergy(_id(), update_data)

        assert resultado is None


# =============================================
# Tests: MedicalOrderService
# =============================================

class TestMedicalOrderServiceCRUD:
    """Tests para el servicio de ordenes medicas."""

    @pytest.mark.asyncio
    async def test_crear_orden_laboratorio(self, db_session: AsyncSession):
        """Verifica la creacion de una orden de laboratorio."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = MedicalOrderService(db_session)
        medico_id = _id()

        data = _crear_orden_schema(
            encounter_id=encuentro.id, patient_id=patient_id
        )
        orden = await svc.create_order(data, ordered_by=medico_id)

        assert orden.id is not None
        assert orden.encounter_id == encuentro.id
        assert orden.patient_id == patient_id
        assert orden.ordered_by == medico_id
        assert orden.order_type == "lab"
        assert orden.priority == "routine"
        assert orden.status == "pending"
        assert orden.details_json["test_code"] == "CBC"

    @pytest.mark.asyncio
    async def test_crear_orden_imagen_urgente(self, db_session: AsyncSession):
        """Verifica creacion de una orden de imagen con prioridad urgente."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = MedicalOrderService(db_session)

        data = _crear_orden_schema(
            encounter_id=encuentro.id,
            patient_id=patient_id,
            order_type="imaging",
            priority="urgent",
            details_json={
                "modality": "CT",
                "body_part": "abdomen",
                "contrast": True,
            },
        )
        orden = await svc.create_order(data, ordered_by=_id())

        assert orden.order_type == "imaging"
        assert orden.priority == "urgent"
        assert orden.details_json["modality"] == "CT"

    @pytest.mark.asyncio
    async def test_actualizar_estado_orden_en_progreso(
        self, db_session: AsyncSession
    ):
        """Verifica transicion de estado de una orden a in_progress."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = MedicalOrderService(db_session)

        data = _crear_orden_schema(encounter_id=encuentro.id, patient_id=patient_id)
        orden = await svc.create_order(data, ordered_by=_id())

        update = MedicalOrderStatusUpdate(status="in_progress")
        actualizada = await svc.update_order_status(orden.id, update, updated_by=_id())

        assert actualizada is not None
        assert actualizada.status == "in_progress"
        assert actualizada.completed_at is None

    @pytest.mark.asyncio
    async def test_actualizar_estado_orden_completada_con_resultado(
        self, db_session: AsyncSession
    ):
        """Verifica que completar una orden registra fecha y resumen de resultado."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = MedicalOrderService(db_session)

        data = _crear_orden_schema(encounter_id=encuentro.id, patient_id=patient_id)
        orden = await svc.create_order(data, ordered_by=_id())

        update = MedicalOrderStatusUpdate(
            status="completed",
            result_summary="Hemograma: Hb 13.5, Hto 40%, Leucocitos 7500",
        )
        completada = await svc.update_order_status(orden.id, update, updated_by=_id())

        assert completada is not None
        assert completada.status == "completed"
        assert completada.completed_at is not None
        assert "Hemograma" in completada.result_summary

    @pytest.mark.asyncio
    async def test_actualizar_estado_orden_inexistente(
        self, db_session: AsyncSession
    ):
        """Verifica que actualizar una orden inexistente retorna None."""
        svc = MedicalOrderService(db_session)
        update = MedicalOrderStatusUpdate(status="completed")

        resultado = await svc.update_order_status(_id(), update)

        assert resultado is None

    @pytest.mark.asyncio
    async def test_obtener_orden_por_id(self, db_session: AsyncSession):
        """Verifica la obtencion de una orden medica por su ID."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = MedicalOrderService(db_session)

        data = _crear_orden_schema(encounter_id=encuentro.id, patient_id=patient_id)
        orden = await svc.create_order(data, ordered_by=_id())

        resultado = await svc.get_order(orden.id)

        assert resultado is not None
        assert resultado.id == orden.id

    @pytest.mark.asyncio
    async def test_obtener_ordenes_por_encuentro(self, db_session: AsyncSession):
        """Verifica la lista de ordenes de un encuentro especifico."""
        patient_id = _id()
        encuentro = await _crear_encuentro_en_bd(db_session, patient_id=patient_id)
        svc = MedicalOrderService(db_session)

        # Crear 3 ordenes para el mismo encuentro
        for tipo in ["lab", "imaging", "medication"]:
            data = _crear_orden_schema(
                encounter_id=encuentro.id,
                patient_id=patient_id,
                order_type=tipo,
            )
            await svc.create_order(data, ordered_by=_id())

        ordenes = await svc.get_encounter_orders(encuentro.id)

        assert len(ordenes) == 3


# =============================================
# Tests: ProblemListService
# =============================================

class TestProblemListServiceCRUD:
    """Tests para el servicio de lista de problemas del paciente."""

    @pytest.mark.asyncio
    async def test_agregar_problema(self, db_session: AsyncSession):
        """Verifica que se agrega un problema a la lista del paciente."""
        svc = ProblemListService(db_session)
        patient_id = _id()
        medico_id = _id()

        data = _crear_problema_schema(patient_id=patient_id)
        problema = await svc.add_problem(data, created_by=medico_id)

        assert problema.id is not None
        assert problema.patient_id == patient_id
        assert problema.icd10_code == "E11"
        assert problema.description == "Diabetes mellitus tipo 2"
        assert problema.status == "active"
        assert problema.created_by == medico_id

    @pytest.mark.asyncio
    async def test_obtener_problemas_paciente(self, db_session: AsyncSession):
        """Verifica la obtencion de la lista de problemas activos."""
        svc = ProblemListService(db_session)
        patient_id = _id()

        await svc.add_problem(
            _crear_problema_schema(patient_id, icd10_code="E11", description="DM2")
        )
        await svc.add_problem(
            _crear_problema_schema(patient_id, icd10_code="I10", description="HTA")
        )
        # Problema de otro paciente
        await svc.add_problem(
            _crear_problema_schema(_id(), icd10_code="J45", description="Asma")
        )

        problemas = await svc.get_patient_problems(patient_id)

        assert len(problemas) == 2

    @pytest.mark.asyncio
    async def test_obtener_problemas_filtrado_por_estado(
        self, db_session: AsyncSession
    ):
        """Verifica filtrado de problemas por estado (activo/resuelto)."""
        svc = ProblemListService(db_session)
        patient_id = _id()

        p1 = await svc.add_problem(
            _crear_problema_schema(patient_id, icd10_code="E11", description="DM2")
        )
        await svc.add_problem(
            _crear_problema_schema(patient_id, icd10_code="I10", description="HTA")
        )

        # Marcar un problema como resuelto
        await svc.update_problem(p1.id, ProblemListUpdate(status="resolved"))

        activos = await svc.get_patient_problems(patient_id, status="active")
        assert len(activos) == 1
        assert activos[0].icd10_code == "I10"

    @pytest.mark.asyncio
    async def test_actualizar_problema(self, db_session: AsyncSession):
        """Verifica la actualizacion de estado y notas de un problema."""
        svc = ProblemListService(db_session)
        patient_id = _id()

        data = _crear_problema_schema(patient_id)
        problema = await svc.add_problem(data)
        medico_id = _id()

        update = ProblemListUpdate(
            status="inactive",
            notes="Paciente controlado con metformina 850mg BID",
        )
        actualizado = await svc.update_problem(
            problema.id, update, updated_by=medico_id
        )

        assert actualizado is not None
        assert actualizado.status == "inactive"
        assert actualizado.notes == "Paciente controlado con metformina 850mg BID"
        assert actualizado.updated_by == medico_id

    @pytest.mark.asyncio
    async def test_actualizar_problema_inexistente(self, db_session: AsyncSession):
        """Verifica que actualizar un problema inexistente retorna None."""
        svc = ProblemListService(db_session)
        update = ProblemListUpdate(status="resolved")

        resultado = await svc.update_problem(_id(), update)

        assert resultado is None

    @pytest.mark.asyncio
    async def test_eliminar_problema_soft_delete(self, db_session: AsyncSession):
        """Verifica que eliminar un problema hace soft delete (is_active=False)."""
        svc = ProblemListService(db_session)
        patient_id = _id()

        p1 = await svc.add_problem(
            _crear_problema_schema(patient_id, icd10_code="E11", description="DM2")
        )
        await svc.add_problem(
            _crear_problema_schema(patient_id, icd10_code="I10", description="HTA")
        )

        eliminado = await svc.remove_problem(p1.id, updated_by=_id())

        assert eliminado is True
        # Verificar que ya no aparece en la lista activa
        problemas = await svc.get_patient_problems(patient_id)
        assert len(problemas) == 1
        assert problemas[0].icd10_code == "I10"

    @pytest.mark.asyncio
    async def test_eliminar_problema_inexistente(self, db_session: AsyncSession):
        """Verifica que eliminar un problema inexistente retorna False."""
        svc = ProblemListService(db_session)

        resultado = await svc.remove_problem(_id())

        assert resultado is False


# =============================================
# Tests: ClinicalTemplateService
# =============================================

class TestClinicalTemplateServiceCRUD:
    """Tests para el servicio de plantillas clinicas."""

    @pytest.mark.asyncio
    async def test_crear_plantilla_soap(self, db_session: AsyncSession):
        """Verifica la creacion de una plantilla clinica tipo SOAP."""
        svc = ClinicalTemplateService(db_session)
        medico_id = _id()

        template_data = {
            "name": "Nota SOAP - Medicina General",
            "specialty_code": "MED-GEN",
            "template_type": "soap",
            "schema_json": {
                "fields": [
                    {"name": "subjective", "type": "textarea", "required": True},
                    {"name": "objective", "type": "textarea", "required": True},
                    {"name": "assessment", "type": "textarea", "required": True},
                    {"name": "plan", "type": "textarea", "required": True},
                ],
            },
            "is_default": True,
        }
        plantilla = await svc.create_template(template_data, created_by=medico_id)

        assert plantilla.id is not None
        assert plantilla.name == "Nota SOAP - Medicina General"
        assert plantilla.specialty_code == "MED-GEN"
        assert plantilla.template_type == "soap"
        assert plantilla.is_default is True
        assert plantilla.created_by == medico_id
        assert len(plantilla.schema_json["fields"]) == 4

    @pytest.mark.asyncio
    async def test_obtener_plantilla_existente(self, db_session: AsyncSession):
        """Verifica la obtencion de una plantilla por ID."""
        svc = ClinicalTemplateService(db_session)
        template_data = {
            "name": "Nota de Egreso",
            "template_type": "discharge",
            "schema_json": {"fields": []},
        }
        plantilla = await svc.create_template(template_data)

        resultado = await svc.get_template(plantilla.id)

        assert resultado is not None
        assert resultado.id == plantilla.id
        assert resultado.name == "Nota de Egreso"

    @pytest.mark.asyncio
    async def test_obtener_plantilla_inexistente(self, db_session: AsyncSession):
        """Verifica que retorna None para una plantilla inexistente."""
        svc = ClinicalTemplateService(db_session)

        resultado = await svc.get_template(_id())

        assert resultado is None

    @pytest.mark.asyncio
    async def test_listar_plantillas_por_especialidad(
        self, db_session: AsyncSession
    ):
        """Verifica filtrado de plantillas por codigo de especialidad."""
        svc = ClinicalTemplateService(db_session)

        await svc.create_template({
            "name": "SOAP Cardiologia",
            "specialty_code": "CARD",
            "template_type": "soap",
            "schema_json": {"fields": []},
        })
        await svc.create_template({
            "name": "SOAP Pediatria",
            "specialty_code": "PED",
            "template_type": "soap",
            "schema_json": {"fields": []},
        })
        await svc.create_template({
            "name": "Procedimiento Cardiologia",
            "specialty_code": "CARD",
            "template_type": "procedure",
            "schema_json": {"fields": []},
        })

        # Filtrar solo cardiologia
        plantillas_card = await svc.list_templates(specialty_code="CARD")
        assert len(plantillas_card) == 2
        assert all(p.specialty_code == "CARD" for p in plantillas_card)

    @pytest.mark.asyncio
    async def test_listar_plantillas_por_tipo(self, db_session: AsyncSession):
        """Verifica filtrado de plantillas por tipo (soap, procedure, etc)."""
        svc = ClinicalTemplateService(db_session)

        await svc.create_template({
            "name": "SOAP General",
            "template_type": "soap",
            "schema_json": {"fields": []},
        })
        await svc.create_template({
            "name": "Procedimiento General",
            "template_type": "procedure",
            "schema_json": {"fields": []},
        })

        plantillas_soap = await svc.list_templates(template_type="soap")
        assert len(plantillas_soap) == 1
        assert plantillas_soap[0].template_type == "soap"

    @pytest.mark.asyncio
    async def test_listar_plantillas_sin_filtros(self, db_session: AsyncSession):
        """Verifica que sin filtros se retornan todas las plantillas activas."""
        svc = ClinicalTemplateService(db_session)

        await svc.create_template({
            "name": "Template A",
            "template_type": "soap",
            "schema_json": {},
        })
        await svc.create_template({
            "name": "Template B",
            "template_type": "procedure",
            "schema_json": {},
        })

        todas = await svc.list_templates()
        assert len(todas) == 2

    @pytest.mark.asyncio
    async def test_eliminar_plantilla_soft_delete(self, db_session: AsyncSession):
        """Verifica que eliminar una plantilla hace soft delete."""
        svc = ClinicalTemplateService(db_session)
        plantilla = await svc.create_template({
            "name": "Template Temporal",
            "template_type": "soap",
            "schema_json": {},
        })

        eliminada = await svc.delete_template(plantilla.id, updated_by=_id())

        assert eliminada is True
        # Verificar que ya no es visible
        resultado = await svc.get_template(plantilla.id)
        assert resultado is None

    @pytest.mark.asyncio
    async def test_eliminar_plantilla_inexistente(self, db_session: AsyncSession):
        """Verifica que eliminar una plantilla inexistente retorna False."""
        svc = ClinicalTemplateService(db_session)

        resultado = await svc.delete_template(_id())

        assert resultado is False


# =============================================
# Tests: Flujo completo de un encuentro clinico
# =============================================

class TestFlujoCompletoEncuentro:
    """
    Tests de integracion ligera que simulan un flujo clinico completo:
    crear encuentro -> registrar vitales -> crear nota -> diagnosticar -> ordenar -> completar.
    """

    @pytest.mark.asyncio
    async def test_flujo_consulta_ambulatoria_completa(
        self, db_session: AsyncSession
    ):
        """
        Simula una consulta ambulatoria completa: desde la apertura del
        encuentro hasta su finalizacion con alta medica.
        """
        patient_id = _id()
        provider_id = _id()

        # 1. Crear encuentro
        svc_enc = EncounterService(db_session)
        enc_data = _crear_encuentro_schema(
            patient_id=patient_id,
            provider_id=provider_id,
            chief_complaint="Dolor toracico opresivo",
        )
        encuentro = await svc_enc.create_encounter(enc_data, created_by=provider_id)
        assert encuentro.status == "in_progress"

        # 2. Registrar signos vitales
        svc_vs = VitalSignsService(db_session)
        vitales = await svc_vs.record_vitals(
            _crear_signos_vitales_schema(
                encounter_id=encuentro.id,
                patient_id=patient_id,
                blood_pressure_sys=150,
                blood_pressure_dia=95,
                heart_rate=92,
            ),
            measured_by=_id(),
        )
        assert vitales.blood_pressure_sys == 150

        # 3. Crear nota clinica SOAP
        svc_nota = ClinicalNoteService(db_session)
        nota = await svc_nota.create_note(
            _crear_nota_schema(
                encuentro.id,
                content_json={
                    "subjective": "Dolor toracico opresivo irradiado a brazo izquierdo",
                    "objective": "PA: 150/95, FC: 92, EKG: ritmo sinusal sin cambios ST",
                    "assessment": "Dolor toracico atipico, HTA no controlada",
                    "plan": "Enzimas cardiacas, RX torax, ajuste antihipertensivo",
                },
            ),
            created_by=provider_id,
        )
        assert nota.note_type == "soap"

        # 4. Firmar nota
        firmada = await svc_nota.sign_note(nota.id, signed_by=provider_id)
        assert firmada.is_signed is True

        # 5. Registrar diagnostico
        svc_dx = DiagnosisService(db_session)
        dx = await svc_dx.create_diagnosis(
            _crear_diagnostico_schema(
                encuentro.id,
                icd10_code="R07.9",
                description="Dolor toracico no especificado",
            ),
            created_by=provider_id,
        )
        assert dx.icd10_code == "R07.9"

        # 6. Crear orden de laboratorio
        svc_ord = MedicalOrderService(db_session)
        orden = await svc_ord.create_order(
            _crear_orden_schema(
                encounter_id=encuentro.id,
                patient_id=patient_id,
                order_type="lab",
                priority="urgent",
                details_json={
                    "test_code": "TROPONIN",
                    "test_name": "Troponina I",
                    "instructions": "Stat",
                },
            ),
            ordered_by=provider_id,
        )
        assert orden.priority == "urgent"

        # 7. Completar encuentro
        completado = await svc_enc.complete_encounter(
            encuentro.id, disposition="alta", updated_by=provider_id
        )
        assert completado.status == "completed"
        assert completado.disposition == "alta"
        assert completado.end_datetime is not None

        # 8. Verificar que el encuentro cargado tiene las relaciones
        enc_completo = await svc_enc.get_encounter(encuentro.id)
        assert len(enc_completo.clinical_notes) == 1
        assert len(enc_completo.diagnoses) == 1
        assert len(enc_completo.vital_signs) == 1
        assert len(enc_completo.medical_orders) == 1
