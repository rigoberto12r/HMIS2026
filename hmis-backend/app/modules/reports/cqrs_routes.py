"""
CQRS example routes demonstrating read replica usage for reports.

These routes show how to use the CQRS pattern for high-performance read operations.
"""

import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_read_db, get_db, current_tenant
from app.modules.auth.dependencies import get_current_user
from app.shared.utils import parse_float_safe
from app.cqrs.queries import (
    BillingQueryHandler,
    ClinicalQueryHandler,
    ARAgingReportQuery,
    RevenueAnalysisQuery,
    TopDiagnosesQuery,
    ProviderProductivityQuery,
)
from app.cqrs.commands import (
    InvoiceCommandHandler,
    CreateInvoiceCommand,
)
from app.cqrs.projections import ARAgingProjection, DiagnosisTrendsProjection, RevenueProjection

router = APIRouter()


# ─── Query Examples (READ REPLICA) ───────────────────────────────


@router.get("/ar-aging")
async def get_ar_aging_report(
    read_db: Annotated[AsyncSession, Depends(get_read_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    as_of_date: date = Query(default_factory=date.today),
):
    """
    Accounts Receivable Aging Report (CQRS Query).

    This endpoint demonstrates:
    - Using read replica via get_read_db() dependency
    - Complex aggregation query offloaded from primary database
    - Expected latency: 50ms on read replica vs 200ms on primary (-75%)

    Benefits:
    - No impact on write operations
    - Can scale read replicas horizontally
    - Better performance for end users
    """
    tenant_id = current_tenant.get()

    # Initialize query handler with read replica session
    query_handler = BillingQueryHandler(read_db)

    # Execute query on read replica
    query = ARAgingReportQuery(
        tenant_id=tenant_id,
        as_of_date=as_of_date,
        aging_buckets=[30, 60, 90, 120],
    )

    result = await query_handler.get_ar_aging_report(query)

    # Try to get cached projection (even faster)
    cached_summary = await ARAgingProjection.get_cached_summary(tenant_id)
    if cached_summary:
        result["cached_summary"] = cached_summary

    return result


@router.get("/revenue-analysis")
async def get_revenue_analysis(
    read_db: Annotated[AsyncSession, Depends(get_read_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    start_date: date = Query(..., description="Start date for analysis"),
    end_date: date = Query(..., description="End date for analysis"),
    group_by: str = Query("day", regex="^(day|week|month)$"),
):
    """
    Revenue Analysis Report (CQRS Query).

    Uses read replica for time-series revenue analysis.
    """
    tenant_id = current_tenant.get()

    query_handler = BillingQueryHandler(read_db)

    query = RevenueAnalysisQuery(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        group_by=group_by,
    )

    result = await query_handler.get_revenue_analysis(query)

    # Add daily cached summaries if available
    if group_by == "day":
        cached_daily = []
        current = start_date
        while current <= end_date:
            daily_summary = await RevenueProjection.get_daily_summary(
                tenant_id, current.isoformat()
            )
            cached_daily.append(daily_summary)
            current = current.replace(day=current.day + 1)

        result["cached_daily_summaries"] = cached_daily

    return result


@router.get("/top-diagnoses")
async def get_top_diagnoses(
    read_db: Annotated[AsyncSession, Depends(get_read_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(20, le=100),
):
    """
    Top Diagnoses Report (CQRS Query).

    Uses read replica + cached projection for fast results.
    """
    tenant_id = current_tenant.get()

    query_handler = ClinicalQueryHandler(read_db)

    query = TopDiagnosesQuery(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )

    # Try cached projection first (fastest)
    cached_top = await DiagnosisTrendsProjection.get_top_diagnoses(tenant_id, limit=limit)

    # Get detailed data from read replica
    result = await query_handler.get_top_diagnoses(query)

    if cached_top:
        result["cached_top_diagnoses"] = cached_top

    return result


@router.get("/provider-productivity")
async def get_provider_productivity(
    read_db: Annotated[AsyncSession, Depends(get_read_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    provider_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    """
    Provider Productivity Report (CQRS Query).

    Complex join query executed on read replica.
    """
    tenant_id = current_tenant.get()

    query_handler = ClinicalQueryHandler(read_db)

    query = ProviderProductivityQuery(
        tenant_id=tenant_id,
        provider_id=provider_id,
        start_date=start_date,
        end_date=end_date,
    )

    result = await query_handler.get_provider_productivity(query)

    return result


# ─── Command Example (PRIMARY DATABASE) ──────────────────────────


@router.post("/invoices")
async def create_invoice_cqrs(
    invoice_data: dict,
    db: Annotated[AsyncSession, Depends(get_db)],  # NOTE: get_db() for writes
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Create Invoice (CQRS Command).

    This endpoint demonstrates:
    - Using primary database via get_db() dependency for WRITES
    - Command handler pattern for state modifications
    - Domain event publishing for projections

    IMPORTANT: Always use get_db() for write operations (commands).
    Only use get_read_db() for read operations (queries).
    """
    tenant_id = current_tenant.get()

    # Initialize command handler with primary database session
    command_handler = InvoiceCommandHandler(db)

    # Build command
    command = CreateInvoiceCommand(
        patient_id=uuid.UUID(invoice_data["patient_id"]),
        encounter_id=uuid.UUID(invoice_data.get("encounter_id")) if invoice_data.get("encounter_id") else None,
        charge_items=invoice_data["charge_items"],
        tax_rate=invoice_data.get("tax_rate", 0.18),  # 18% default
        tenant_id=tenant_id,
        user_id=uuid.UUID(current_user["user_id"]),
    )

    # Execute command on primary database
    # This will also publish events for projections
    invoice = await command_handler.create_invoice(command)

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "grand_total": parse_float_safe(invoice.grand_total, fallback=0.0, field_name="invoice.grand_total"),
        "status": invoice.status,
        "message": "Invoice created successfully. Projections will be updated asynchronously.",
    }


# ─── Performance Comparison ──────────────────────────────────────


@router.get("/performance-test")
async def performance_test(
    db: Annotated[AsyncSession, Depends(get_db)],
    read_db: Annotated[AsyncSession, Depends(get_read_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Performance comparison: Primary vs Read Replica.

    This endpoint runs the same query on both databases to demonstrate
    the performance difference.

    Expected results (production):
    - Primary DB: ~200ms
    - Read Replica: ~50ms (-75% latency)
    """
    import time

    tenant_id = current_tenant.get()

    # Query on primary database
    start_primary = time.time()
    primary_handler = BillingQueryHandler(db)
    primary_query = ARAgingReportQuery(tenant_id=tenant_id, as_of_date=date.today())
    primary_result = await primary_handler.get_ar_aging_report(primary_query)
    primary_duration = (time.time() - start_primary) * 1000  # ms

    # Query on read replica
    start_replica = time.time()
    replica_handler = BillingQueryHandler(read_db)
    replica_query = ARAgingReportQuery(tenant_id=tenant_id, as_of_date=date.today())
    replica_result = await replica_handler.get_ar_aging_report(replica_query)
    replica_duration = (time.time() - start_replica) * 1000  # ms

    improvement = ((primary_duration - replica_duration) / primary_duration) * 100 if primary_duration > 0 else 0

    return {
        "primary_db": {
            "duration_ms": round(primary_duration, 2),
            "result_count": len(primary_result.get("aging_summary", [])),
        },
        "read_replica": {
            "duration_ms": round(replica_duration, 2),
            "result_count": len(replica_result.get("aging_summary", [])),
        },
        "improvement": {
            "latency_reduction_ms": round(primary_duration - replica_duration, 2),
            "percentage_faster": round(improvement, 2),
        },
        "note": "Performance gains are more significant in production with real workload",
    }
