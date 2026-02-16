"""
Inpatient Management Repository

Data access layer for inpatient operations.
"""

from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.inpatient.models import Admission, Bed, Discharge, Transfer
from app.shared.repository import BaseRepository
from app.shared.utils import parse_float_safe


class BedRepository(BaseRepository[Bed]):
    """Repository for bed operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Bed, db)

    async def find_available(
        self,
        unit: Optional[str] = None,
        bed_type: Optional[str] = None,
        gender: Optional[str] = None,
        required_features: Optional[list[str]] = None,
    ) -> list[Bed]:
        """
        Find available beds matching criteria.

        Args:
            unit: Filter by unit/ward
            bed_type: Filter by bed type
            gender: Patient gender (male/female)
            required_features: List of required features

        Returns:
            List of available beds
        """
        query = select(Bed).where(
            and_(Bed.status == "available", Bed.is_active == True)
        )

        if unit:
            query = query.where(Bed.unit == unit)

        if bed_type:
            query = query.where(Bed.bed_type == bed_type)

        if gender:
            # Match beds with no gender restriction or matching restriction
            query = query.where(
                or_(Bed.gender_restriction == "any", Bed.gender_restriction == gender)
            )

        result = await self.db.execute(query)
        beds = result.scalars().all()

        # Filter by required features if specified
        if required_features:
            beds = [
                bed
                for bed in beds
                if all(bed.features.get(feature) for feature in required_features)
            ]

        return list(beds)

    async def find_by_unit(self, unit: str) -> list[Bed]:
        """Find all beds in a specific unit."""
        query = select(Bed).where(
            and_(Bed.unit == unit, Bed.is_active == True)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def find_occupied(self) -> list[Bed]:
        """Find all occupied beds."""
        query = select(Bed).where(
            and_(Bed.status == "occupied", Bed.is_active == True)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_status(self, bed_id: UUID, status: str) -> Optional[Bed]:
        """
        Update bed status.

        Args:
            bed_id: Bed ID
            status: New status

        Returns:
            Updated bed or None
        """
        bed = await self.get(bed_id)
        if bed:
            bed.status = status
            if status == "available":
                bed.last_cleaned_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(bed)
        return bed

    async def count_by_status(self) -> dict[str, int]:
        """
        Count beds by status.

        Returns:
            Dictionary with status counts
        """
        query = select(Bed.status, func.count(Bed.id)).where(
            Bed.is_active == True
        ).group_by(Bed.status)
        result = await self.db.execute(query)
        return {status: count for status, count in result.all()}

    async def count_by_unit(self, unit: str) -> dict[str, int]:
        """
        Count beds by status for a specific unit.

        Args:
            unit: Unit name

        Returns:
            Dictionary with status counts
        """
        query = (
            select(Bed.status, func.count(Bed.id))
            .where(and_(Bed.unit == unit, Bed.is_active == True))
            .group_by(Bed.status)
        )
        result = await self.db.execute(query)
        return {status: count for status, count in result.all()}


class AdmissionRepository(BaseRepository[Admission]):
    """Repository for admission operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Admission, db)

    async def find_active(self, limit: int = 100, offset: int = 0) -> list[Admission]:
        """
        Find all active admissions.

        Args:
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of active admissions
        """
        query = (
            select(Admission)
            .where(Admission.status == "active")
            .options(
                joinedload(Admission.patient),
                joinedload(Admission.bed),
                joinedload(Admission.attending_physician),
            )
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(query)
        return list(result.unique().scalars().all())

    async def find_by_patient(self, patient_id: UUID) -> list[Admission]:
        """Find all admissions for a patient."""
        query = (
            select(Admission)
            .where(Admission.patient_id == patient_id)
            .options(
                joinedload(Admission.bed),
                joinedload(Admission.admitting_physician),
                joinedload(Admission.attending_physician),
            )
            .order_by(Admission.admission_date.desc())
        )
        result = await self.db.execute(query)
        return list(result.unique().scalars().all())

    async def find_by_date_range(
        self, start_date: datetime, end_date: datetime
    ) -> list[Admission]:
        """Find admissions within a date range."""
        query = (
            select(Admission)
            .where(
                and_(
                    Admission.admission_date >= start_date,
                    Admission.admission_date <= end_date,
                )
            )
            .options(
                joinedload(Admission.patient),
                joinedload(Admission.bed),
            )
        )
        result = await self.db.execute(query)
        return list(result.unique().scalars().all())

    async def get_active_by_bed(self, bed_id: UUID) -> Optional[Admission]:
        """
        Get active admission for a specific bed.

        Args:
            bed_id: Bed ID

        Returns:
            Active admission or None
        """
        query = select(Admission).where(
            and_(Admission.bed_id == bed_id, Admission.status == "active")
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_average_los(self) -> float:
        """
        Calculate average length of stay for discharged patients.

        Returns:
            Average LOS in days
        """
        query = (
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        Discharge.discharge_date - Admission.admission_date,
                    )
                    / 86400
                )
            )
            .join(Discharge, Discharge.admission_id == Admission.id)
            .where(Admission.status == "discharged")
        )
        result = await self.db.execute(query)
        avg_los = result.scalar()
        return parse_float_safe(avg_los, fallback=0.0, field_name="avg_los") if avg_los else 0.0

    async def count_active(self) -> int:
        """Count active admissions."""
        query = select(func.count(Admission.id)).where(Admission.status == "active")
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def count_by_date(self, target_date: date) -> int:
        """
        Count admissions on a specific date.

        Args:
            target_date: Date to count admissions

        Returns:
            Number of admissions
        """
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())

        query = select(func.count(Admission.id)).where(
            and_(
                Admission.admission_date >= start_datetime,
                Admission.admission_date <= end_datetime,
            )
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_with_details(self, admission_id: UUID) -> Optional[Admission]:
        """
        Get admission with all related data.

        Args:
            admission_id: Admission ID

        Returns:
            Admission with loaded relationships
        """
        query = (
            select(Admission)
            .where(Admission.id == admission_id)
            .options(
                joinedload(Admission.patient),
                joinedload(Admission.bed),
                joinedload(Admission.admitting_physician),
                joinedload(Admission.attending_physician),
                joinedload(Admission.transfers),
                joinedload(Admission.discharge),
            )
        )
        result = await self.db.execute(query)
        return result.unique().scalar_one_or_none()


class TransferRepository(BaseRepository[Transfer]):
    """Repository for transfer operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Transfer, db)

    async def find_by_admission(self, admission_id: UUID) -> list[Transfer]:
        """Find all transfers for an admission."""
        query = (
            select(Transfer)
            .where(Transfer.admission_id == admission_id)
            .options(
                joinedload(Transfer.from_bed),
                joinedload(Transfer.to_bed),
                joinedload(Transfer.ordered_by),
                joinedload(Transfer.performed_by),
            )
            .order_by(Transfer.transfer_date.asc())
        )
        result = await self.db.execute(query)
        return list(result.unique().scalars().all())

    async def find_by_date(self, target_date: date) -> list[Transfer]:
        """Find all transfers on a specific date."""
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())

        query = select(Transfer).where(
            and_(
                Transfer.transfer_date >= start_datetime,
                Transfer.transfer_date <= end_datetime,
            )
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_date(self, target_date: date) -> int:
        """Count transfers on a specific date."""
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())

        query = select(func.count(Transfer.id)).where(
            and_(
                Transfer.transfer_date >= start_datetime,
                Transfer.transfer_date <= end_datetime,
            )
        )
        result = await self.db.execute(query)
        return result.scalar() or 0


class DischargeRepository(BaseRepository[Discharge]):
    """Repository for discharge operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Discharge, db)

    async def find_by_date_range(
        self, start_date: datetime, end_date: datetime
    ) -> list[Discharge]:
        """Find discharges within a date range."""
        query = (
            select(Discharge)
            .where(
                and_(
                    Discharge.discharge_date >= start_date,
                    Discharge.discharge_date <= end_date,
                )
            )
            .options(
                joinedload(Discharge.admission),
                joinedload(Discharge.discharge_physician),
            )
        )
        result = await self.db.execute(query)
        return list(result.unique().scalars().all())

    async def count_by_type(
        self, start_date: datetime, end_date: datetime
    ) -> dict[str, int]:
        """
        Count discharges by type within a date range.

        Args:
            start_date: Start of date range
            end_date: End of date range

        Returns:
            Dictionary with discharge type counts
        """
        query = (
            select(Discharge.discharge_type, func.count(Discharge.id))
            .where(
                and_(
                    Discharge.discharge_date >= start_date,
                    Discharge.discharge_date <= end_date,
                )
            )
            .group_by(Discharge.discharge_type)
        )
        result = await self.db.execute(query)
        return {discharge_type: count for discharge_type, count in result.all()}

    async def count_by_date(self, target_date: date) -> int:
        """Count discharges on a specific date."""
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time())

        query = select(func.count(Discharge.id)).where(
            and_(
                Discharge.discharge_date >= start_datetime,
                Discharge.discharge_date <= end_datetime,
            )
        )
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_by_admission(self, admission_id: UUID) -> Optional[Discharge]:
        """Get discharge by admission ID."""
        query = (
            select(Discharge)
            .where(Discharge.admission_id == admission_id)
            .options(joinedload(Discharge.discharge_physician))
        )
        result = await self.db.execute(query)
        return result.unique().scalar_one_or_none()
