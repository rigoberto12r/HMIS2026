"""
Repository for Electronic Medical Records data access.

Encapsulates database queries for Encounter, ClinicalNote, Diagnosis, and related entities.
"""

from uuid import UUID
from datetime import datetime

from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.emr.models import (
    Encounter,
    ClinicalNote,
    Diagnosis,
    VitalSigns,
    MedicalOrder,
    Allergy,
    PatientProblemList,
)
from app.shared.repository import BaseRepository


class EncounterRepository(BaseRepository[Encounter]):
    """Repository for encounter-specific queries."""

    async def find_by_patient(
        self,
        patient_id: UUID,
        *,
        include_completed: bool = True,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Encounter], int]:
        """
        Find encounters for a patient.

        Args:
            patient_id: Patient UUID
            include_completed: Whether to include completed encounters
            offset: Number of results to skip
            limit: Maximum number of results

        Returns:
            Tuple of (encounters, total_count)
        """
        stmt = select(Encounter).where(
            Encounter.patient_id == patient_id,
            Encounter.is_active == True
        )

        if not include_completed:
            stmt = stmt.where(Encounter.status.in_(["scheduled", "in_progress"]))

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Get paginated results
        stmt = stmt.order_by(Encounter.start_datetime.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        encounters = list(result.scalars().all())

        return encounters, total

    async def get_with_details(self, encounter_id: UUID) -> Encounter | None:
        """
        Get encounter with all related entities eager-loaded.

        Args:
            encounter_id: Encounter UUID

        Returns:
            Encounter with notes, diagnoses, vitals, orders, or None
        """
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


class ClinicalNoteRepository(BaseRepository[ClinicalNote]):
    """Repository for clinical notes."""

    async def find_by_encounter(
        self,
        encounter_id: UUID,
        *,
        note_type: str | None = None,
    ) -> list[ClinicalNote]:
        """
        Find notes for an encounter.

        Args:
            encounter_id: Encounter UUID
            note_type: Optional note type filter (e.g., "SOAP", "Progress Note")

        Returns:
            List of clinical notes
        """
        filters = {"encounter_id": encounter_id}
        if note_type:
            filters["note_type"] = note_type

        return await self.find_by(
            order_by=ClinicalNote.created_at.desc(),
            **filters
        )

    async def find_unsigned_by_provider(
        self,
        provider_id: UUID,
        limit: int = 50,
    ) -> list[ClinicalNote]:
        """
        Find unsigned notes for a provider.

        Args:
            provider_id: Provider UUID
            limit: Maximum number of results

        Returns:
            List of unsigned notes
        """
        stmt = (
            select(ClinicalNote)
            .where(
                ClinicalNote.created_by == provider_id,
                ClinicalNote.is_signed == False,
                ClinicalNote.is_active == True,
            )
            .order_by(ClinicalNote.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class DiagnosisRepository(BaseRepository[Diagnosis]):
    """Repository for diagnoses."""

    async def find_by_encounter(
        self,
        encounter_id: UUID,
        *,
        is_primary: bool | None = None,
    ) -> list[Diagnosis]:
        """
        Find diagnoses for an encounter.

        Args:
            encounter_id: Encounter UUID
            is_primary: Filter by primary diagnosis flag

        Returns:
            List of diagnoses
        """
        filters = {"encounter_id": encounter_id}
        if is_primary is not None:
            filters["is_primary"] = is_primary

        return await self.find_by(
            order_by=Diagnosis.created_at.desc(),
            **filters
        )

    async def find_by_patient(
        self,
        patient_id: UUID,
        *,
        status: str | None = None,
        limit: int = 100,
    ) -> list[Diagnosis]:
        """
        Find diagnoses for a patient across all encounters.

        Args:
            patient_id: Patient UUID
            status: Optional status filter (e.g., "active", "resolved")
            limit: Maximum number of results

        Returns:
            List of diagnoses
        """
        # Join with Encounter to filter by patient_id
        stmt = (
            select(Diagnosis)
            .join(Encounter)
            .where(
                Encounter.patient_id == patient_id,
                Diagnosis.is_active == True,
            )
        )

        if status:
            stmt = stmt.where(Diagnosis.status == status)

        stmt = stmt.order_by(Diagnosis.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class VitalSignsRepository(BaseRepository[VitalSigns]):
    """Repository for vital signs."""

    async def find_by_encounter(self, encounter_id: UUID) -> list[VitalSigns]:
        """
        Find vital signs for an encounter.

        Args:
            encounter_id: Encounter UUID

        Returns:
            List of vital signs ordered by measurement time
        """
        return await self.find_by(
            encounter_id=encounter_id,
            order_by=VitalSigns.measured_at.desc()
        )

    async def find_recent_by_patient(
        self,
        patient_id: UUID,
        limit: int = 10,
    ) -> list[VitalSigns]:
        """
        Find recent vital signs for a patient.

        Args:
            patient_id: Patient UUID
            limit: Maximum number of results

        Returns:
            List of recent vital signs
        """
        stmt = (
            select(VitalSigns)
            .join(Encounter)
            .where(
                Encounter.patient_id == patient_id,
            )
            .order_by(VitalSigns.measured_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class AllergyRepository(BaseRepository[Allergy]):
    """Repository for patient allergies."""

    async def find_active_by_patient(self, patient_id: UUID) -> list[Allergy]:
        """
        Find active allergies for a patient.

        Args:
            patient_id: Patient UUID

        Returns:
            List of active allergies
        """
        return await self.find_by(
            patient_id=patient_id,
            status="active",
            order_by=Allergy.created_at.desc()
        )


class ProblemListRepository(BaseRepository[PatientProblemList]):
    """Repository for patient problem lists."""

    async def find_active_by_patient(self, patient_id: UUID) -> list[PatientProblemList]:
        """
        Find active problems for a patient.

        Args:
            patient_id: Patient UUID

        Returns:
            List of active problems ordered by onset date
        """
        return await self.find_by(
            patient_id=patient_id,
            status="active",
            order_by=PatientProblemList.onset_date.desc()
        )
