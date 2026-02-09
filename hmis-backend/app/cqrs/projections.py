"""
Event projections for materialized views (CQRS pattern).

Projections listen to domain events and update denormalized/materialized views
for fast read access. This enables eventual consistency while maintaining
excellent read performance.
"""

import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import redis_client
from app.shared.events import DomainEvent, subscribe, _event_handlers

logger = logging.getLogger(__name__)


# ─── Materialized View Projections ──────────────────────────────


class ARAgingProjection:
    """
    Maintains materialized view of AR aging buckets in Redis.

    Updated on INVOICE_GENERATED and PAYMENT_RECEIVED events for fast reads.
    """

    CACHE_KEY_TEMPLATE = "projection:ar_aging:{tenant_id}"
    TTL_SECONDS = 3600  # 1 hour

    @staticmethod
    async def update_on_invoice_generated(event: DomainEvent) -> None:
        """
        Update AR aging projection when invoice is generated.

        This allows AR aging queries to read from cache instead of hitting DB.
        """
        try:
            tenant_id = event.tenant_id
            payload = event.payload

            # Extract invoice data
            invoice_id = payload.get("invoice_id")
            grand_total = payload.get("grand_total", 0)
            status = payload.get("status", "pending")

            # Update cache
            cache_key = ARAgingProjection.CACHE_KEY_TEMPLATE.format(tenant_id=tenant_id)

            # Increment counters
            pipe = redis_client.pipeline()
            pipe.hincrby(cache_key, "total_invoices", 1)
            pipe.hincrbyfloat(cache_key, "total_ar", float(grand_total))
            pipe.hincrby(cache_key, f"status:{status}", 1)
            pipe.expire(cache_key, ARAgingProjection.TTL_SECONDS)
            await pipe.execute()

            logger.info(
                f"AR aging projection updated for invoice {invoice_id}",
                extra={"tenant_id": tenant_id, "invoice_id": invoice_id},
            )

        except Exception as e:
            logger.error(
                f"Failed to update AR aging projection: {e}",
                extra={"event": event},
                exc_info=True,
            )

    @staticmethod
    async def update_on_payment_received(event: DomainEvent) -> None:
        """
        Update AR aging projection when payment is received.
        """
        try:
            tenant_id = event.tenant_id
            payload = event.payload

            amount = payload.get("amount", 0)

            # Update cache
            cache_key = ARAgingProjection.CACHE_KEY_TEMPLATE.format(tenant_id=tenant_id)

            pipe = redis_client.pipeline()
            pipe.hincrbyfloat(cache_key, "total_ar", -float(amount))  # Reduce AR
            pipe.hincrbyfloat(cache_key, "total_collected", float(amount))
            pipe.expire(cache_key, ARAgingProjection.TTL_SECONDS)
            await pipe.execute()

            logger.info(
                f"AR aging projection updated for payment",
                extra={"tenant_id": tenant_id, "amount": amount},
            )

        except Exception as e:
            logger.error(
                f"Failed to update AR aging projection on payment: {e}",
                exc_info=True,
            )

    @staticmethod
    async def get_cached_summary(tenant_id: str) -> dict[str, Any] | None:
        """
        Get cached AR aging summary.

        Returns None if cache miss, triggering a full DB query.
        """
        cache_key = ARAgingProjection.CACHE_KEY_TEMPLATE.format(tenant_id=tenant_id)

        data = await redis_client.hgetall(cache_key)

        if not data:
            return None

        return {
            "total_invoices": int(data.get(b"total_invoices", 0)),
            "total_ar": float(data.get(b"total_ar", 0)),
            "total_collected": float(data.get(b"total_collected", 0)),
            "cached_at": datetime.now().isoformat(),
        }


class DiagnosisTrendsProjection:
    """
    Maintains top diagnoses counts in Redis sorted sets.

    Updated on DIAGNOSIS_ADDED event for fast trending queries.
    """

    CACHE_KEY_TEMPLATE = "projection:diagnoses:{tenant_id}"
    TTL_SECONDS = 7200  # 2 hours

    @staticmethod
    async def update_on_diagnosis_added(event: DomainEvent) -> None:
        """
        Increment diagnosis count in sorted set.
        """
        try:
            tenant_id = event.tenant_id
            payload = event.payload

            icd10_code = payload.get("icd10_code")
            encounter_id = payload.get("encounter_id")

            if not icd10_code:
                return

            # Update sorted set (score = count)
            cache_key = DiagnosisTrendsProjection.CACHE_KEY_TEMPLATE.format(
                tenant_id=tenant_id
            )

            pipe = redis_client.pipeline()
            pipe.zincrby(cache_key, 1, icd10_code)
            pipe.expire(cache_key, DiagnosisTrendsProjection.TTL_SECONDS)
            await pipe.execute()

            logger.info(
                f"Diagnosis trends projection updated for {icd10_code}",
                extra={"tenant_id": tenant_id, "icd10_code": icd10_code},
            )

        except Exception as e:
            logger.error(
                f"Failed to update diagnosis trends projection: {e}",
                exc_info=True,
            )

    @staticmethod
    async def get_top_diagnoses(tenant_id: str, limit: int = 20) -> list[dict]:
        """
        Get top diagnoses from cache.

        Returns empty list if cache miss.
        """
        cache_key = DiagnosisTrendsProjection.CACHE_KEY_TEMPLATE.format(tenant_id=tenant_id)

        # Get top N with scores (descending order)
        results = await redis_client.zrevrange(cache_key, 0, limit - 1, withscores=True)

        return [
            {"icd10_code": code.decode(), "count": int(score)} for code, score in results
        ]


class RevenueProjection:
    """
    Maintains daily revenue metrics in Redis time series.

    Updated on INVOICE_GENERATED and PAYMENT_RECEIVED events.
    """

    CACHE_KEY_TEMPLATE = "projection:revenue:{tenant_id}:{date}"

    @staticmethod
    async def update_on_invoice_generated(event: DomainEvent) -> None:
        """
        Increment revenue counters for the day.
        """
        try:
            tenant_id = event.tenant_id
            payload = event.payload

            grand_total = payload.get("grand_total", 0)
            today = datetime.now().date().isoformat()

            cache_key = RevenueProjection.CACHE_KEY_TEMPLATE.format(
                tenant_id=tenant_id, date=today
            )

            pipe = redis_client.pipeline()
            pipe.hincrbyfloat(cache_key, "total_invoiced", float(grand_total))
            pipe.hincrby(cache_key, "invoice_count", 1)
            pipe.expire(cache_key, 86400 * 90)  # Keep 90 days
            await pipe.execute()

            logger.info(
                f"Revenue projection updated for {today}",
                extra={"tenant_id": tenant_id, "amount": grand_total},
            )

        except Exception as e:
            logger.error(
                f"Failed to update revenue projection: {e}",
                exc_info=True,
            )

    @staticmethod
    async def update_on_payment_received(event: DomainEvent) -> None:
        """
        Increment payment counters for the day.
        """
        try:
            tenant_id = event.tenant_id
            payload = event.payload

            amount = payload.get("amount", 0)
            today = datetime.now().date().isoformat()

            cache_key = RevenueProjection.CACHE_KEY_TEMPLATE.format(
                tenant_id=tenant_id, date=today
            )

            pipe = redis_client.pipeline()
            pipe.hincrbyfloat(cache_key, "total_collected", float(amount))
            pipe.hincrby(cache_key, "payment_count", 1)
            pipe.expire(cache_key, 86400 * 90)
            await pipe.execute()

            logger.info(
                f"Revenue projection updated for payment on {today}",
                extra={"tenant_id": tenant_id, "amount": amount},
            )

        except Exception as e:
            logger.error(
                f"Failed to update revenue projection on payment: {e}",
                exc_info=True,
            )

    @staticmethod
    async def get_daily_summary(tenant_id: str, date: str) -> dict[str, Any]:
        """
        Get revenue summary for a specific date.
        """
        cache_key = RevenueProjection.CACHE_KEY_TEMPLATE.format(
            tenant_id=tenant_id, date=date
        )

        data = await redis_client.hgetall(cache_key)

        if not data:
            return {
                "date": date,
                "total_invoiced": 0,
                "total_collected": 0,
                "invoice_count": 0,
                "payment_count": 0,
            }

        return {
            "date": date,
            "total_invoiced": float(data.get(b"total_invoiced", 0)),
            "total_collected": float(data.get(b"total_collected", 0)),
            "invoice_count": int(data.get(b"invoice_count", 0)),
            "payment_count": int(data.get(b"payment_count", 0)),
        }


# ─── Event Subscriptions ─────────────────────────────────────────


def register_projections() -> None:
    """
    Register all projection handlers to domain events.

    Call this during application startup.
    """
    # Helper function to register handler
    def register(event_type: str, handler):
        if event_type not in _event_handlers:
            _event_handlers[event_type] = []
        _event_handlers[event_type].append(handler)

    # AR Aging projections
    register("invoice.generated", ARAgingProjection.update_on_invoice_generated)
    register("payment.received", ARAgingProjection.update_on_payment_received)

    # Diagnosis trends projections
    register("diagnosis.added", DiagnosisTrendsProjection.update_on_diagnosis_added)

    # Revenue projections
    register("invoice.generated", RevenueProjection.update_on_invoice_generated)
    register("payment.received", RevenueProjection.update_on_payment_received)

    logger.info("CQRS projections registered successfully")
