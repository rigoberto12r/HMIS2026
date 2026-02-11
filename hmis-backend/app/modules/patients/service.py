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
from app.modules.patients.repository import PatientRepository, PatientInsuranceRepository
from app.modules.patients.schemas import (
    PatientCreate,
    PatientSearchParams,
    PatientUpdate,
)
from app.shared.events import DomainEvent, PATIENT_REGISTERED, PATIENT_UPDATED, publish
from app.shared.exceptions import ConflictError, NotFoundError


class PatientService:
    """Servicio de logica de negocio para pacientes."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PatientRepository(Patient, db)
        self.insurance_repo = PatientInsuranceRepository(PatientInsurance, db)

    async def create_patient(self, data: PatientCreate, created_by: uuid.UUID | None = None) -> Patient:
        """
        Registra un nuevo paciente.
        1. Verifica duplicados por documento
        2. Genera MRN unico
        3. Crea registros de seguros asociados
        4. Publica evento de registro
        """
        # Verificar duplicados
        duplicate = await self.repo.find_by_document(data.document_type, data.document_number)
        if duplicate:
            raise ConflictError(
                f"Ya existe un paciente con {data.document_type} {data.document_number}",
                details={"mrn": duplicate.mrn, "patient_id": str(duplicate.id)}
            )

        # Generar MRN unico
        counter = await self.repo.get_mrn_counter()
        mrn = f"HMIS-{counter + 1:08d}"

        # Crear paciente
        patient_data = data.model_dump(exclude={"insurance_policies"})
        patient = Patient(
            **patient_data,
            mrn=mrn,
            created_by=created_by,
        )
        await self.repo.create(patient)

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
        return await self.repo.get_with_insurance(patient_id)

    async def get_patient_by_mrn(self, mrn: str) -> Patient | None:
        """Obtiene un paciente por su numero de historia clinica (MRN)."""
        return await self.repo.find_by_mrn(mrn)

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
        return await self.repo.search(
            query=params.query,
            gender=params.gender,
            offset=offset,
            limit=limit,
        )

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

    async def get_stats(self) -> dict:
        """
        Obtiene estadisticas de pacientes del tenant actual.
        - Total de pacientes activos
        - Pacientes nuevos este mes
        - Pacientes con status activo
        """
        # Total de pacientes activos (no borrados)
        total_stmt = select(func.count(Patient.id)).where(Patient.is_active == True)
        total_result = await self.db.execute(total_stmt)
        total_patients = total_result.scalar() or 0

        # Pacientes nuevos este mes
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        new_month_stmt = select(func.count(Patient.id)).where(
            Patient.is_active == True,
            Patient.created_at >= start_of_month,
        )
        new_month_result = await self.db.execute(new_month_stmt)
        new_this_month = new_month_result.scalar() or 0

        # Pacientes con status activo
        active_stmt = select(func.count(Patient.id)).where(
            Patient.is_active == True,
            Patient.status == "active",
        )
        active_result = await self.db.execute(active_stmt)
        active_patients = active_result.scalar() or 0

        return {
            "total_patients": total_patients,
            "new_this_month": new_this_month,
            "active_patients": active_patients,
        }

