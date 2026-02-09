"""
Query handlers for read operations (CQRS pattern).

Queries read data and are executed against read replicas for better performance.
They do NOT modify state and can be scaled horizontally.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select, and_, or_, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.appointments.models import Appointment, Provider
from app.modules.billing.models import Invoice, Payment, InsuranceClaim, ChargeItem
from app.modules.emr.models import Encounter, Diagnosis
from app.modules.patients.models import Patient, PatientInsurance
from app.modules.pharmacy.models import Prescription


# ─── Query Models ────────────────────────────────────────────────


@dataclass
class ARAgingReportQuery:
    """Query for Accounts Receivable aging report (read-only)."""

    tenant_id: str
    as_of_date: date
    aging_buckets: list[int] = None  # e.g., [30, 60, 90, 120]

    def __post_init__(self):
        if self.aging_buckets is None:
            self.aging_buckets = [30, 60, 90, 120]


@dataclass
class RevenueAnalysisQuery:
    """Query for revenue analysis report (read-only)."""

    tenant_id: str
    start_date: date
    end_date: date
    group_by: str = "day"  # day, week, month


@dataclass
class TopDiagnosesQuery:
    """Query for top diagnoses report (read-only)."""

    tenant_id: str
    start_date: date | None
    end_date: date | None
    limit: int = 20


@dataclass
class ProviderProductivityQuery:
    """Query for provider productivity report (read-only)."""

    tenant_id: str
    start_date: date | None
    end_date: date | None
    provider_id: uuid.UUID | None = None


# ─── Query Handlers ──────────────────────────────────────────────


class BillingQueryHandler:
    """Handles billing-related queries (reads from replica)."""

    def __init__(self, read_db: AsyncSession):
        """
        Initialize with read replica session.

        Args:
            read_db: AsyncSession connected to read replica (or primary if no replica)
        """
        self.db = read_db

    async def get_ar_aging_report(self, query: ARAgingReportQuery) -> dict[str, Any]:
        """
        Generate Accounts Receivable aging report.

        This is a complex, read-heavy query that benefits greatly from read replicas.
        Expected performance: 200ms → 50ms on read replica.
        """
        # Build aging buckets dynamically
        aging_cases = []
        for i, days in enumerate(query.aging_buckets):
            prev_days = query.aging_buckets[i - 1] if i > 0 else 0

            aging_cases.append(
                (
                    and_(
                        func.date_part("day", query.as_of_date - Invoice.created_at) >= prev_days,
                        func.date_part("day", query.as_of_date - Invoice.created_at) < days,
                    ),
                    f"{prev_days}-{days} days",
                )
            )

        # Add 120+ days bucket
        last_bucket = query.aging_buckets[-1]
        aging_cases.append(
            (
                func.date_part("day", query.as_of_date - Invoice.created_at) >= last_bucket,
                f"{last_bucket}+ days",
            )
        )

        # Query with case statement for aging buckets
        stmt = select(
            func.case(*aging_cases, else_="Current").label("aging_bucket"),
            func.count(Invoice.id).label("invoice_count"),
            func.sum(Invoice.balance_due).label("total_balance"),
        ).where(
            Invoice.tenant_id == query.tenant_id,
            Invoice.is_active == True,
            Invoice.status.in_(["pending", "partial"]),
            Invoice.balance_due > 0,
        )

        stmt = stmt.group_by("aging_bucket").order_by(text("aging_bucket"))

        result = await self.db.execute(stmt)
        rows = result.all()

        # Calculate totals
        total_invoices = sum(row.invoice_count for row in rows)
        total_ar = sum(row.total_balance or Decimal(0) for row in rows)

        return {
            "as_of_date": query.as_of_date.isoformat(),
            "total_invoices": total_invoices,
            "total_ar": float(total_ar),
            "aging_summary": [
                {
                    "bucket": row.aging_bucket,
                    "invoice_count": row.invoice_count,
                    "total_balance": float(row.total_balance or 0),
                    "percentage": (
                        round(float(row.total_balance or 0) / float(total_ar) * 100, 2)
                        if total_ar > 0
                        else 0
                    ),
                }
                for row in rows
            ],
        }

    async def get_revenue_analysis(self, query: RevenueAnalysisQuery) -> dict[str, Any]:
        """
        Generate revenue analysis report with time-series data.

        Uses read replica for complex aggregations without impacting writes.
        """
        # Determine grouping SQL
        if query.group_by == "day":
            date_trunc = func.date(Invoice.created_at)
        elif query.group_by == "week":
            date_trunc = func.date_trunc("week", Invoice.created_at)
        elif query.group_by == "month":
            date_trunc = func.date_trunc("month", Invoice.created_at)
        else:
            date_trunc = func.date(Invoice.created_at)

        # Revenue by time period
        stmt = select(
            date_trunc.label("period"),
            func.count(Invoice.id).label("invoice_count"),
            func.sum(Invoice.grand_total).label("total_revenue"),
            func.sum(
                func.case((Invoice.status == "paid", Invoice.grand_total), else_=Decimal(0))
            ).label("revenue_collected"),
            func.sum(Invoice.balance_due).label("revenue_outstanding"),
        ).where(
            Invoice.tenant_id == query.tenant_id,
            Invoice.is_active == True,
            Invoice.created_at >= query.start_date,
            Invoice.created_at <= query.end_date,
        )

        stmt = stmt.group_by("period").order_by("period")

        result = await self.db.execute(stmt)
        rows = result.all()

        # Payment method breakdown
        payment_stmt = select(
            Payment.payment_method,
            func.count(Payment.id).label("count"),
            func.sum(Payment.amount).label("total"),
        ).where(
            Payment.tenant_id == query.tenant_id,
            Payment.is_active == True,
            Payment.received_at >= query.start_date,
            Payment.received_at <= query.end_date,
        )

        payment_stmt = payment_stmt.group_by(Payment.payment_method)

        payment_result = await self.db.execute(payment_stmt)
        payment_rows = payment_result.all()

        return {
            "period": f"{query.start_date.isoformat()} to {query.end_date.isoformat()}",
            "group_by": query.group_by,
            "time_series": [
                {
                    "period": (
                        row.period.isoformat() if hasattr(row.period, "isoformat") else str(row.period)
                    ),
                    "invoice_count": row.invoice_count,
                    "total_revenue": float(row.total_revenue or 0),
                    "revenue_collected": float(row.revenue_collected or 0),
                    "revenue_outstanding": float(row.revenue_outstanding or 0),
                    "collection_rate": (
                        round(
                            float(row.revenue_collected or 0) / float(row.total_revenue or 1) * 100,
                            2,
                        )
                    ),
                }
                for row in rows
            ],
            "payment_methods": [
                {
                    "method": row.payment_method,
                    "count": row.count,
                    "total": float(row.total or 0),
                }
                for row in payment_rows
            ],
        }


class ClinicalQueryHandler:
    """Handles clinical data queries (reads from replica)."""

    def __init__(self, read_db: AsyncSession):
        self.db = read_db

    async def get_top_diagnoses(self, query: TopDiagnosesQuery) -> dict[str, Any]:
        """
        Get top diagnoses with frequency analysis.

        Read-heavy query optimized for read replica.
        """
        stmt = (
            select(
                Diagnosis.icd10_code,
                Diagnosis.description,
                func.count(Diagnosis.id).label("count"),
                func.count(func.distinct(Diagnosis.patient_id)).label("unique_patients"),
            )
            .join(Encounter, Diagnosis.encounter_id == Encounter.id)
            .where(
                Diagnosis.tenant_id == query.tenant_id,
                Diagnosis.is_active == True,
                Encounter.is_active == True,
            )
        )

        if query.start_date:
            stmt = stmt.where(Encounter.start_datetime >= query.start_date)
        if query.end_date:
            stmt = stmt.where(Encounter.start_datetime <= query.end_date)

        stmt = (
            stmt.group_by(Diagnosis.icd10_code, Diagnosis.description)
            .order_by(desc("count"))
            .limit(query.limit)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        return {
            "top_diagnoses": [
                {
                    "icd10_code": row.icd10_code,
                    "description": row.description,
                    "total_occurrences": row.count,
                    "unique_patients": row.unique_patients,
                }
                for row in rows
            ]
        }

    async def get_provider_productivity(
        self, query: ProviderProductivityQuery
    ) -> dict[str, Any]:
        """
        Get provider productivity metrics.

        Complex join query optimized for read replica.
        """
        stmt = (
            select(
                Provider.id,
                Provider.first_name,
                Provider.last_name,
                Provider.specialty_name,
                func.count(func.distinct(Appointment.id)).label("total_appointments"),
                func.count(func.distinct(Encounter.id)).label("total_encounters"),
                func.count(
                    func.distinct(
                        func.case((Appointment.status == "completed", Appointment.id), else_=None)
                    )
                ).label("completed_appointments"),
                func.count(
                    func.distinct(
                        func.case((Appointment.status == "no_show", Appointment.id), else_=None)
                    )
                ).label("no_shows"),
            )
            .outerjoin(Appointment, Provider.id == Appointment.provider_id)
            .outerjoin(Encounter, Provider.id == Encounter.provider_id)
            .where(Provider.tenant_id == query.tenant_id, Provider.is_active == True)
        )

        if query.provider_id:
            stmt = stmt.where(Provider.id == query.provider_id)

        if query.start_date:
            stmt = stmt.where(
                or_(
                    Appointment.scheduled_start >= query.start_date,
                    Encounter.start_datetime >= query.start_date,
                )
            )
        if query.end_date:
            stmt = stmt.where(
                or_(
                    Appointment.scheduled_start <= query.end_date,
                    Encounter.start_datetime <= query.end_date,
                )
            )

        stmt = stmt.group_by(
            Provider.id, Provider.first_name, Provider.last_name, Provider.specialty_name
        ).order_by(desc("total_appointments"))

        result = await self.db.execute(stmt)
        rows = result.all()

        return {
            "provider_productivity": [
                {
                    "provider_id": str(row.id),
                    "name": f"{row.first_name} {row.last_name}",
                    "specialty": row.specialty_name,
                    "total_appointments": row.total_appointments,
                    "completed_appointments": row.completed_appointments,
                    "no_shows": row.no_shows,
                    "total_encounters": row.total_encounters,
                    "completion_rate": (
                        round(row.completed_appointments / row.total_appointments * 100, 2)
                        if row.total_appointments > 0
                        else 0
                    ),
                }
                for row in rows
            ],
        }
