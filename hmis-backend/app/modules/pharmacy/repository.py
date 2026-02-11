"""
Pharmacy module repositories.

Implements data access patterns for pharmacy entities.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pharmacy.models import Prescription
from app.shared.repository import BaseRepository


class PrescriptionRepository(BaseRepository[Prescription]):
    """Repository for prescription data access."""

    async def find_by_patient(
        self,
        patient_id: UUID,
        *,
        status: str | None = None,
        limit: int = 100,
    ) -> list[Prescription]:
        """
        Find prescriptions for a patient.

        Args:
            patient_id: Patient UUID
            status: Filter by prescription status (active, dispensed, cancelled, etc.)
            limit: Maximum number of results

        Returns:
            List of prescriptions ordered by creation date (newest first)
        """
        query = (
            select(Prescription)
            .where(Prescription.patient_id == patient_id)
            .where(Prescription.is_active == True)
        )

        if status:
            query = query.where(Prescription.status == status)

        query = query.order_by(Prescription.created_at.desc()).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def find_by_encounter(
        self,
        encounter_id: UUID,
    ) -> list[Prescription]:
        """
        Find all prescriptions for an encounter.

        Args:
            encounter_id: Encounter UUID

        Returns:
            List of prescriptions ordered by creation date
        """
        query = (
            select(Prescription)
            .where(Prescription.encounter_id == encounter_id)
            .where(Prescription.is_active == True)
            .order_by(Prescription.created_at.desc())
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def find_active_by_patient(
        self,
        patient_id: UUID,
    ) -> list[Prescription]:
        """
        Find active prescriptions for a patient.

        Args:
            patient_id: Patient UUID

        Returns:
            List of active prescriptions ordered by creation date (newest first)
        """
        return await self.find_by_patient(patient_id, status="active")
