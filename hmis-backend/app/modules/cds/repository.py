"""
Repositories for Clinical Decision Support data access.
"""

from uuid import UUID

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cds.models import CDSAlertOverride, DrugInteraction
from app.shared.repository import BaseRepository


class CDSRepository(BaseRepository[DrugInteraction]):
    """Repository for drug interaction knowledge base queries."""

    async def find_interactions_for_drug(
        self, drug_name: str
    ) -> list[DrugInteraction]:
        """
        Find all known interactions for a drug name.
        Case-insensitive LIKE on both drug_a_name and drug_b_name.
        Results ordered by severity (critical first).
        """
        drug_lower = drug_name.lower()
        stmt = (
            select(DrugInteraction)
            .where(
                DrugInteraction.is_active == True,  # noqa: E712
                or_(
                    func.lower(DrugInteraction.drug_a_name).contains(drug_lower),
                    func.lower(DrugInteraction.drug_b_name).contains(drug_lower),
                ),
            )
            .order_by(
                case(
                    (DrugInteraction.severity == "critical", 0),
                    (DrugInteraction.severity == "major", 1),
                    (DrugInteraction.severity == "moderate", 2),
                    else_=3,
                )
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_interaction_between(
        self, drug_a: str, drug_b: str
    ) -> list[DrugInteraction]:
        """
        Find interactions between two specific drugs.
        Checks both orderings: (A,B) and (B,A).
        """
        a_lower = drug_a.lower()
        b_lower = drug_b.lower()
        stmt = (
            select(DrugInteraction)
            .where(
                DrugInteraction.is_active == True,  # noqa: E712
                or_(
                    and_(
                        func.lower(DrugInteraction.drug_a_name).contains(a_lower),
                        func.lower(DrugInteraction.drug_b_name).contains(b_lower),
                    ),
                    and_(
                        func.lower(DrugInteraction.drug_a_name).contains(b_lower),
                        func.lower(DrugInteraction.drug_b_name).contains(a_lower),
                    ),
                ),
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class CDSAlertOverrideRepository(BaseRepository[CDSAlertOverride]):
    """Repository for CDS alert override audit trail."""

    async def find_by_prescription(
        self, prescription_id: UUID
    ) -> list[CDSAlertOverride]:
        stmt = (
            select(CDSAlertOverride)
            .where(
                CDSAlertOverride.is_active == True,  # noqa: E712
                CDSAlertOverride.prescription_id == prescription_id,
            )
            .order_by(CDSAlertOverride.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_patient(
        self, patient_id: UUID, *, limit: int = 50
    ) -> list[CDSAlertOverride]:
        stmt = (
            select(CDSAlertOverride)
            .where(
                CDSAlertOverride.is_active == True,  # noqa: E712
                CDSAlertOverride.patient_id == patient_id,
            )
            .order_by(CDSAlertOverride.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
