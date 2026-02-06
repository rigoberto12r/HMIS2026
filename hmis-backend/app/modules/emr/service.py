"""
Servicio de Historia Clinica Electronica (EMR).
Logica de negocio: encuentros, notas, diagnosticos, signos vitales, ordenes.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.emr.models import (
    Allergy,
    ClinicalNote,
    Diagnosis,
    Encounter,
    MedicalOrder,
    PatientProblemList,
    VitalSigns,
)
from app.modules.emr.schemas import (
    ClinicalNoteCreate,
    DiagnosisCreate,
    EncounterCreate,
    EncounterUpdate,
    MedicalOrderCreate,
    MedicalOrderStatusUpdate,
    VitalSignsCreate,
)
from app.shared.events import (
    CLINICAL_NOTE_SIGNED,
    ENCOUNTER_COMPLETED,
    ENCOUNTER_STARTED,
    ORDER_CREATED,
    DomainEvent,
    publish,
)


class EncounterService:
    """Servicio de gestion de encuentros clinicos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_encounter(
        self, data: EncounterCreate, created_by: uuid.UUID | None = None
    ) -> Encounter:
        """Crea un nuevo encuentro clinico."""
        encounter = Encounter(
            **data.model_dump(),
            created_by=created_by,
        )
        self.db.add(encounter)
        await self.db.flush()

        await publish(DomainEvent(
            event_type=ENCOUNTER_STARTED,
            aggregate_type="encounter",
            aggregate_id=str(encounter.id),
            data={
                "patient_id": str(data.patient_id),
                "provider_id": str(data.provider_id),
                "encounter_type": data.encounter_type,
            },
            user_id=str(created_by) if created_by else None,
        ))

        return encounter

    async def get_encounter(self, encounter_id: uuid.UUID) -> Encounter | None:
        """Obtiene un encuentro con todas sus relaciones."""
        stmt = (
            select(Encounter)
            .where(Encounter.id == encounter_id, Encounter.is_active == True)
            .options(
                selectinload(Encounter.clinical_notes),
                selectinload(Encounter.diagnoses),
                selectinload(Encounter.vital_signs),
                selectinload(Encounter.medical_orders),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def complete_encounter(
        self, encounter_id: uuid.UUID, disposition: str | None = None,
        updated_by: uuid.UUID | None = None,
    ) -> Encounter | None:
        """Completa un encuentro clinico."""
        encounter = await self.get_encounter(encounter_id)
        if not encounter:
            return None

        encounter.status = "completed"
        encounter.end_datetime = datetime.now(timezone.utc)
        encounter.disposition = disposition
        encounter.updated_by = updated_by
        await self.db.flush()

        await publish(DomainEvent(
            event_type=ENCOUNTER_COMPLETED,
            aggregate_type="encounter",
            aggregate_id=str(encounter.id),
            data={"disposition": disposition},
            user_id=str(updated_by) if updated_by else None,
        ))

        return encounter

    async def list_encounters(
        self,
        patient_id: uuid.UUID | None = None,
        provider_id: uuid.UUID | None = None,
        encounter_type: str | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Encounter], int]:
        """Lista encuentros con filtros."""
        stmt = select(Encounter).where(Encounter.is_active == True)
        count_stmt = select(func.count()).select_from(Encounter).where(Encounter.is_active == True)

        if patient_id:
            stmt = stmt.where(Encounter.patient_id == patient_id)
            count_stmt = count_stmt.where(Encounter.patient_id == patient_id)
        if provider_id:
            stmt = stmt.where(Encounter.provider_id == provider_id)
            count_stmt = count_stmt.where(Encounter.provider_id == provider_id)
        if encounter_type:
            stmt = stmt.where(Encounter.encounter_type == encounter_type)
            count_stmt = count_stmt.where(Encounter.encounter_type == encounter_type)
        if status:
            stmt = stmt.where(Encounter.status == status)
            count_stmt = count_stmt.where(Encounter.status == status)

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        stmt = stmt.offset(offset).limit(limit).order_by(Encounter.start_datetime.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total


class ClinicalNoteService:
    """Servicio de notas clinicas."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_note(
        self, data: ClinicalNoteCreate, created_by: uuid.UUID | None = None
    ) -> ClinicalNote:
        """Crea una nota clinica (SOAP, procedimiento, egreso, enmienda)."""
        # Si es enmienda, verificar que la nota original existe y esta firmada
        if data.amendment_of:
            original = await self.db.execute(
                select(ClinicalNote).where(ClinicalNote.id == data.amendment_of)
            )
            original_note = original.scalar_one_or_none()
            if not original_note or not original_note.is_signed:
                raise ValueError("Solo se pueden enmendar notas firmadas")

        note = ClinicalNote(
            **data.model_dump(),
            created_by=created_by,
        )
        self.db.add(note)
        await self.db.flush()
        return note

    async def sign_note(
        self, note_id: uuid.UUID, signed_by: uuid.UUID
    ) -> ClinicalNote | None:
        """
        Firma una nota clinica. Una vez firmada, no puede modificarse.
        Solo se permiten enmiendas (addendums).
        """
        stmt = select(ClinicalNote).where(ClinicalNote.id == note_id)
        result = await self.db.execute(stmt)
        note = result.scalar_one_or_none()

        if not note:
            return None
        if note.is_signed:
            raise ValueError("La nota ya esta firmada. Use una enmienda para cambios.")

        note.is_signed = True
        note.signed_at = datetime.now(timezone.utc)
        note.signed_by = signed_by
        await self.db.flush()

        await publish(DomainEvent(
            event_type=CLINICAL_NOTE_SIGNED,
            aggregate_type="clinical_note",
            aggregate_id=str(note.id),
            data={"encounter_id": str(note.encounter_id)},
            user_id=str(signed_by),
        ))

        return note


class DiagnosisService:
    """Servicio de diagnosticos."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_diagnosis(
        self, data: DiagnosisCreate, created_by: uuid.UUID | None = None
    ) -> Diagnosis:
        diagnosis = Diagnosis(**data.model_dump(), created_by=created_by)
        self.db.add(diagnosis)
        await self.db.flush()
        return diagnosis

    async def get_patient_diagnoses(
        self, patient_id: uuid.UUID, status: str | None = None
    ) -> list[Diagnosis]:
        """Obtiene diagnosticos de un paciente a traves de sus encuentros."""
        stmt = (
            select(Diagnosis)
            .join(Encounter, Diagnosis.encounter_id == Encounter.id)
            .where(Encounter.patient_id == patient_id, Diagnosis.is_active == True)
        )
        if status:
            stmt = stmt.where(Diagnosis.status == status)

        stmt = stmt.order_by(Diagnosis.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class VitalSignsService:
    """Servicio de signos vitales."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_vitals(
        self, data: VitalSignsCreate, measured_by: uuid.UUID | None = None
    ) -> VitalSigns:
        """Registra signos vitales con calculo automatico de BMI."""
        vitals = VitalSigns(
            **data.model_dump(),
            measured_by=measured_by,
        )

        # Calcular BMI si tenemos peso y altura
        if vitals.weight and vitals.height and vitals.height > 0:
            height_m = vitals.height / 100
            vitals.bmi = round(vitals.weight / (height_m ** 2), 1)

        self.db.add(vitals)
        await self.db.flush()
        return vitals

    async def get_patient_vitals_history(
        self, patient_id: uuid.UUID, limit: int = 20
    ) -> list[VitalSigns]:
        """Historial de signos vitales para trending."""
        stmt = (
            select(VitalSigns)
            .where(VitalSigns.patient_id == patient_id)
            .order_by(VitalSigns.measured_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class AllergyService:
    """Servicio de alergias."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_allergy(self, **kwargs) -> Allergy:
        allergy = Allergy(**kwargs)
        self.db.add(allergy)
        await self.db.flush()
        return allergy

    async def get_patient_allergies(self, patient_id: uuid.UUID) -> list[Allergy]:
        stmt = (
            select(Allergy)
            .where(Allergy.patient_id == patient_id, Allergy.is_active == True)
            .order_by(Allergy.severity.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def check_drug_allergy(self, patient_id: uuid.UUID, drug_name: str) -> list[Allergy]:
        """Verifica alergias a un medicamento especifico."""
        stmt = select(Allergy).where(
            Allergy.patient_id == patient_id,
            Allergy.allergen_type == "drug",
            Allergy.status == "active",
            Allergy.is_active == True,
            Allergy.allergen.ilike(f"%{drug_name}%"),
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class MedicalOrderService:
    """Servicio de ordenes medicas."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_order(
        self, data: MedicalOrderCreate, ordered_by: uuid.UUID
    ) -> MedicalOrder:
        """Crea una orden medica y publica evento."""
        order = MedicalOrder(
            **data.model_dump(),
            ordered_by=ordered_by,
            created_by=ordered_by,
        )
        self.db.add(order)
        await self.db.flush()

        await publish(DomainEvent(
            event_type=ORDER_CREATED,
            aggregate_type="medical_order",
            aggregate_id=str(order.id),
            data={
                "order_type": data.order_type,
                "patient_id": str(data.patient_id),
                "priority": data.priority,
            },
            user_id=str(ordered_by),
        ))

        return order

    async def update_order_status(
        self, order_id: uuid.UUID, data: MedicalOrderStatusUpdate,
        updated_by: uuid.UUID | None = None,
    ) -> MedicalOrder | None:
        stmt = select(MedicalOrder).where(MedicalOrder.id == order_id)
        result = await self.db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            return None

        order.status = data.status
        order.updated_by = updated_by
        if data.result_summary:
            order.result_summary = data.result_summary
        if data.status == "completed":
            order.completed_at = datetime.now(timezone.utc)

        await self.db.flush()
        return order
