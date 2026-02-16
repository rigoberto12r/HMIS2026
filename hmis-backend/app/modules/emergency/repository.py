"""
Emergency Department repositories.

Data access layer for ED visits, triage, track board, and metrics.
"""

from datetime import date, datetime
from typing import Sequence
from uuid import UUID

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.modules.emergency.models import (
    EDMetrics,
    EDTrackBoardItem,
    EDVisit,
    TriageAssessment,
)
from app.shared.repository import BaseRepository
from app.shared.utils import parse_int_safe


class EDVisitRepository(BaseRepository[EDVisit]):
    """Repository for ED visits."""

    def __init__(self, db: AsyncSession):
        super().__init__(EDVisit, db)

    async def find_active(self) -> Sequence[EDVisit]:
        """Get all active ED visits (not departed)."""
        return await self.find_by(
            status=lambda: EDVisit.status != "departed",
            order_by=EDVisit.arrival_time.desc(),
        )

    async def find_by_status(self, status: str) -> Sequence[EDVisit]:
        """Get visits by status."""
        return await self.find_by(status=status, order_by=EDVisit.arrival_time)

    async def find_by_date_range(
        self, start: datetime, end: datetime
    ) -> Sequence[EDVisit]:
        """Get visits within date range."""
        stmt = (
            select(self.model)
            .where(
                and_(
                    self.model.arrival_time >= start,
                    self.model.arrival_time <= end,
                    self.model.is_active == True,
                )
            )
            .order_by(self.model.arrival_time)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_by_triage_level(self, level: int) -> Sequence[EDVisit]:
        """Get visits by ESI triage level."""
        return await self.find_by(
            triage_level=level, order_by=EDVisit.arrival_time
        )

    async def get_with_relations(self, id: UUID) -> EDVisit | None:
        """Get visit with patient, nurse, physician relationships."""
        stmt = (
            select(self.model)
            .where(self.model.id == id, self.model.is_active == True)
            .options(
                joinedload(self.model.patient),
                joinedload(self.model.triage_nurse),
                joinedload(self.model.physician),
                joinedload(self.model.triage_assessment),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(
        self, visit_id: UUID, status: str, timestamp: datetime | None = None
    ) -> EDVisit | None:
        """Update visit status with timestamp."""
        visit = await self.get(visit_id)
        if not visit:
            return None

        visit.status = status

        # Update departure time if status is departed
        if status == "departed" and timestamp:
            visit.departure_time = timestamp

        await self.update(visit)
        return visit

    async def assign_physician(
        self, visit_id: UUID, physician_id: UUID, assigned_at: datetime
    ) -> EDVisit | None:
        """Assign physician to ED visit."""
        visit = await self.get(visit_id)
        if not visit:
            return None

        visit.physician_id = physician_id
        visit.physician_assigned_at = assigned_at

        # Calculate door-to-doc time
        if visit.arrival_time:
            delta = assigned_at - visit.arrival_time
            visit.door_to_doc_minutes = parse_int_safe(
                delta.total_seconds() / 60,
                fallback=0,
                field_name="door_to_doc_minutes"
            )

        await self.update(visit)
        return visit

    async def assign_bed(self, visit_id: UUID, bed: str) -> EDVisit | None:
        """Assign bed to ED visit."""
        visit = await self.get(visit_id)
        if not visit:
            return None

        visit.assigned_bed = bed
        await self.update(visit)
        return visit

    async def set_disposition(
        self, visit_id: UUID, disposition: str, disposition_time: datetime
    ) -> EDVisit | None:
        """Set visit disposition."""
        visit = await self.get(visit_id)
        if not visit:
            return None

        visit.disposition = disposition
        visit.disposition_time = disposition_time
        visit.status = "disposition"

        await self.update(visit)
        return visit

    async def get_next_visit_number(self, date_str: str) -> str:
        """Generate next visit number for the day (ED-YYYYMMDD-XXXX)."""
        prefix = f"ED-{date_str}-"

        # Get max sequence for today
        stmt = select(func.max(EDVisit.visit_number)).where(
            EDVisit.visit_number.like(f"{prefix}%")
        )
        result = await self.db.execute(stmt)
        max_number = result.scalar_one_or_none()

        if max_number:
            # Extract sequence number and increment
            seq = parse_int_safe(
                max_number.split("-")[-1],
                fallback=0,
                field_name="ED visit sequence"
            )
            return f"{prefix}{seq + 1:04d}"
        else:
            # First visit of the day
            return f"{prefix}0001"


class TriageAssessmentRepository(BaseRepository[TriageAssessment]):
    """Repository for triage assessments."""

    def __init__(self, db: AsyncSession):
        super().__init__(TriageAssessment, db)

    async def find_by_visit(self, visit_id: UUID) -> TriageAssessment | None:
        """Get triage assessment for an ED visit."""
        return await self.find_one_by(ed_visit_id=visit_id)

    async def find_by_nurse(
        self, nurse_id: UUID, start: datetime, end: datetime
    ) -> Sequence[TriageAssessment]:
        """Get triage assessments performed by a nurse in date range."""
        stmt = (
            select(self.model)
            .where(
                and_(
                    self.model.triage_nurse_id == nurse_id,
                    self.model.triage_time >= start,
                    self.model.triage_time <= end,
                    self.model.is_active == True,
                )
            )
            .order_by(self.model.triage_time.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_esi_distribution(
        self, start: datetime, end: datetime
    ) -> dict[int, int]:
        """Get ESI level distribution for date range."""
        stmt = (
            select(
                self.model.esi_level,
                func.count(self.model.id).label("count"),
            )
            .where(
                and_(
                    self.model.triage_time >= start,
                    self.model.triage_time <= end,
                    self.model.is_active == True,
                )
            )
            .group_by(self.model.esi_level)
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        return {row[0]: row[1] for row in rows}


class EDTrackBoardRepository:
    """Repository for ED track board materialized view."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def refresh_view(self) -> None:
        """Refresh materialized view (call before reading)."""
        await self.db.execute(
            text("REFRESH MATERIALIZED VIEW CONCURRENTLY ed_track_board")
        )

    async def get_current_board(self) -> Sequence[EDTrackBoardItem]:
        """
        Get current ED track board.

        Returns all active visits sorted by triage level (ESI 1 first),
        then by arrival time.
        """
        await self.refresh_view()

        stmt = (
            select(EDTrackBoardItem)
            .order_by(
                EDTrackBoardItem.triage_level.asc().nulls_last(),
                EDTrackBoardItem.arrival_time.asc(),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_by_triage_level(self, level: int) -> Sequence[EDTrackBoardItem]:
        """Get track board items by ESI level."""
        await self.refresh_view()

        stmt = (
            select(EDTrackBoardItem)
            .where(EDTrackBoardItem.triage_level == level)
            .order_by(EDTrackBoardItem.arrival_time.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_by_status(self, status: str) -> Sequence[EDTrackBoardItem]:
        """Get track board items by status."""
        await self.refresh_view()

        stmt = (
            select(EDTrackBoardItem)
            .where(EDTrackBoardItem.status == status)
            .order_by(
                EDTrackBoardItem.triage_level.asc().nulls_last(),
                EDTrackBoardItem.arrival_time.asc(),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_prolonged_waits(self, threshold_minutes: int = 30) -> Sequence[EDTrackBoardItem]:
        """Get visits with prolonged wait times."""
        await self.refresh_view()

        stmt = (
            select(EDTrackBoardItem)
            .where(EDTrackBoardItem.waiting_time_minutes > threshold_minutes)
            .order_by(EDTrackBoardItem.waiting_time_minutes.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()


class EDMetricsRepository(BaseRepository[EDMetrics]):
    """Repository for ED metrics snapshots."""

    def __init__(self, db: AsyncSession):
        super().__init__(EDMetrics, db)

    async def get_by_date(self, snapshot_date: date) -> EDMetrics | None:
        """Get metrics for specific date."""
        return await self.find_one_by(snapshot_date=snapshot_date)

    async def get_date_range(
        self, start_date: date, end_date: date
    ) -> Sequence[EDMetrics]:
        """Get metrics for date range."""
        stmt = (
            select(self.model)
            .where(
                and_(
                    self.model.snapshot_date >= start_date,
                    self.model.snapshot_date <= end_date,
                    self.model.is_active == True,
                )
            )
            .order_by(self.model.snapshot_date.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_latest(self, limit: int = 30) -> Sequence[EDMetrics]:
        """Get latest metrics (default last 30 days)."""
        stmt = (
            select(self.model)
            .where(self.model.is_active == True)
            .order_by(self.model.snapshot_date.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
