"""
Repository for patient data access.

Encapsulates all database queries for Patient and PatientInsurance entities.
"""

from uuid import UUID

from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.modules.patients.models import Patient, PatientInsurance
from app.shared.repository import BaseRepository


class PatientRepository(BaseRepository[Patient]):
    """Repository for patient-specific queries."""

    async def find_by_document(self, document_type: str, document_number: str) -> Patient | None:
        """
        Find patient by document type and number.

        Args:
            document_type: Document type (e.g., "cedula", "passport")
            document_number: Document number

        Returns:
            Patient or None if not found
        """
        return await self.find_one_by(
            document_type=document_type,
            document_number=document_number
        )

    async def find_by_mrn(self, mrn: str) -> Patient | None:
        """
        Find patient by Medical Record Number.

        Args:
            mrn: Medical Record Number

        Returns:
            Patient with insurance policies loaded, or None
        """
        stmt = (
            select(Patient)
            .where(Patient.mrn == mrn, Patient.is_active == True)
            .options(selectinload(Patient.insurance_policies))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_insurance(self, patient_id: UUID) -> Patient | None:
        """
        Get patient by ID with insurance policies eager-loaded.

        Args:
            patient_id: Patient UUID

        Returns:
            Patient with insurance policies, or None
        """
        stmt = (
            select(Patient)
            .where(Patient.id == patient_id, Patient.is_active == True)
            .options(selectinload(Patient.insurance_policies))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def search(
        self,
        *,
        query: str | None = None,
        gender: str | None = None,
        blood_type: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Patient], int]:
        """
        Search patients with pagination and filters.

        Args:
            query: Search text (matches first_name, last_name, MRN, document_number)
            gender: Gender filter (M/F/O)
            blood_type: Blood type filter (e.g., "A+", "O-")
            offset: Number of results to skip
            limit: Maximum number of results

        Returns:
            Tuple of (patients, total_count)
        """
        # Base query
        stmt = select(Patient).where(Patient.is_active == True)

        # Apply text search
        if query:
            search_pattern = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Patient.first_name.ilike(search_pattern),
                    Patient.last_name.ilike(search_pattern),
                    Patient.mrn.ilike(search_pattern),
                    Patient.document_number.ilike(search_pattern),
                )
            )

        # Apply filters
        if gender:
            stmt = stmt.where(Patient.gender == gender)
        if blood_type:
            stmt = stmt.where(Patient.blood_type == blood_type)

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Get paginated results
        stmt = stmt.order_by(Patient.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        patients = list(result.scalars().all())

        return patients, total

    async def get_mrn_counter(self) -> int:
        """
        Get current MRN counter (highest numeric MRN).

        Returns:
            Current counter value (0 if no patients exist)
        """
        stmt = select(func.max(func.cast(func.substr(Patient.mrn, 4), func.Integer)))
        stmt = stmt.where(Patient.mrn.like("MRN%"))
        result = await self.db.execute(stmt)
        max_mrn = result.scalar_one_or_none()
        return max_mrn or 0


class PatientInsuranceRepository(BaseRepository[PatientInsurance]):
    """Repository for patient insurance policies."""

    async def find_by_patient(self, patient_id: UUID) -> list[PatientInsurance]:
        """
        Get all insurance policies for a patient.

        Args:
            patient_id: Patient UUID

        Returns:
            List of active insurance policies
        """
        return await self.find_by(patient_id=patient_id, order_by=PatientInsurance.created_at.desc())

    async def find_primary_policy(self, patient_id: UUID) -> PatientInsurance | None:
        """
        Get patient's primary insurance policy.

        Args:
            patient_id: Patient UUID

        Returns:
            Primary insurance policy or None
        """
        return await self.find_one_by(patient_id=patient_id, is_primary=True)
