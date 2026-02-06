"""
Servicio de gestion de pacientes.
Logica de negocio: registro, busqueda, duplicados, vinculacion de seguros.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.patients.models import Patient, PatientInsurance
from app.modules.patients.schemas import (
    PatientCreate,
    PatientSearchParams,
    PatientUpdate,
)
from app.shared.events import DomainEvent, PATIENT_REGISTERED, PATIENT_UPDATED, publish


class PatientService:
    """Servicio de logica de negocio para pacientes."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_patient(self, data: PatientCreate, created_by: uuid.UUID | None = None) -> Patient:
        """
        Registra un nuevo paciente.
        1. Verifica duplicados por documento
        2. Genera MRN unico
        3. Crea registros de seguros asociados
        4. Publica evento de registro
        """
        # Verificar duplicados
        duplicate = await self._check_duplicate(data.document_type, data.document_number)
        if duplicate:
            raise ValueError(
                f"Ya existe un paciente con {data.document_type} {data.document_number} "
                f"(MRN: {duplicate.mrn})"
            )

        # Generar MRN unico
        mrn = await self._generate_mrn()

        # Crear paciente
        patient_data = data.model_dump(exclude={"insurance_policies"})
        patient = Patient(
            **patient_data,
            mrn=mrn,
            created_by=created_by,
        )
        self.db.add(patient)
        await self.db.flush()

        # Crear polizas de seguro
        for policy_data in data.insurance_policies:
            policy = PatientInsurance(
                patient_id=patient.id,
                **policy_data.model_dump(),
                created_by=created_by,
            )
            self.db.add(policy)

        await self.db.flush()

        # Publicar evento
        await publish(DomainEvent(
            event_type=PATIENT_REGISTERED,
            aggregate_type="patient",
            aggregate_id=str(patient.id),
            data={"mrn": mrn, "document_number": data.document_number},
            user_id=str(created_by) if created_by else None,
        ))

        return patient

    async def get_patient(self, patient_id: uuid.UUID) -> Patient | None:
        """Obtiene un paciente por ID con sus seguros."""
        stmt = (
            select(Patient)
            .where(Patient.id == patient_id, Patient.is_active == True)
            .options(selectinload(Patient.insurance_policies))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_patient_by_mrn(self, mrn: str) -> Patient | None:
        """Obtiene un paciente por su numero de historia clinica (MRN)."""
        stmt = (
            select(Patient)
            .where(Patient.mrn == mrn, Patient.is_active == True)
            .options(selectinload(Patient.insurance_policies))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_patient(
        self,
        patient_id: uuid.UUID,
        data: PatientUpdate,
        updated_by: uuid.UUID | None = None,
    ) -> Patient | None:
        """Actualiza datos de un paciente."""
        patient = await self.get_patient(patient_id)
        if not patient:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(patient, field, value)

        patient.updated_by = updated_by
        await self.db.flush()

        await publish(DomainEvent(
            event_type=PATIENT_UPDATED,
            aggregate_type="patient",
            aggregate_id=str(patient.id),
            data={"fields_updated": list(update_data.keys())},
            user_id=str(updated_by) if updated_by else None,
        ))

        return patient

    async def search_patients(
        self,
        params: PatientSearchParams,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Patient], int]:
        """
        Busqueda de pacientes con filtros multiples.
        Soporta busqueda por nombre, documento y MRN.
        """
        stmt = select(Patient).where(Patient.is_active == True)
        count_base = select(func.count()).select_from(Patient).where(Patient.is_active == True)

        # Busqueda por texto (nombre, documento, MRN)
        if params.query:
            search_filter = or_(
                Patient.first_name.ilike(f"%{params.query}%"),
                Patient.last_name.ilike(f"%{params.query}%"),
                Patient.document_number.ilike(f"%{params.query}%"),
                Patient.mrn.ilike(f"%{params.query}%"),
            )
            stmt = stmt.where(search_filter)
            count_base = count_base.where(search_filter)

        if params.document_type:
            stmt = stmt.where(Patient.document_type == params.document_type)
            count_base = count_base.where(Patient.document_type == params.document_type)

        if params.gender:
            stmt = stmt.where(Patient.gender == params.gender)
            count_base = count_base.where(Patient.gender == params.gender)

        if params.status:
            stmt = stmt.where(Patient.status == params.status)
            count_base = count_base.where(Patient.status == params.status)

        # Total
        count_result = await self.db.execute(count_base)
        total = count_result.scalar() or 0

        # Resultados paginados
        stmt = stmt.offset(offset).limit(limit).order_by(Patient.created_at.desc())
        result = await self.db.execute(stmt)
        patients = list(result.scalars().all())

        return patients, total

    async def add_insurance(
        self,
        patient_id: uuid.UUID,
        insurer_name: str,
        policy_number: str,
        **kwargs,
    ) -> PatientInsurance:
        """Agrega una poliza de seguro a un paciente."""
        policy = PatientInsurance(
            patient_id=patient_id,
            insurer_name=insurer_name,
            policy_number=policy_number,
            **kwargs,
        )
        self.db.add(policy)
        await self.db.flush()
        return policy

    # --- Metodos privados ---

    async def _check_duplicate(self, document_type: str, document_number: str) -> Patient | None:
        """Verifica si ya existe un paciente con el mismo documento."""
        stmt = select(Patient).where(
            Patient.document_type == document_type,
            Patient.document_number == document_number,
            Patient.is_active == True,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _generate_mrn(self) -> str:
        """
        Genera un numero de historia clinica unico.
        Formato: HMIS-XXXXXXXX (secuencial con padding).
        """
        stmt = select(func.count()).select_from(Patient)
        result = await self.db.execute(stmt)
        count = (result.scalar() or 0) + 1
        return f"HMIS-{count:08d}"
