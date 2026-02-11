"""
Sistema de eventos para comunicacion entre modulos (Event-Driven Architecture).
Usa Redis Streams para desacoplar modulos manteniendo trazabilidad.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Any, Callable, Awaitable

from app.core.cache import redis_client

logger = logging.getLogger(__name__)


@dataclass
class DomainEvent:
    """Evento de dominio base."""
    event_type: str
    aggregate_type: str
    aggregate_id: str
    data: dict[str, Any]
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    tenant_id: str | None = None
    user_id: str | None = None


# Registro de handlers por tipo de evento
_event_handlers: dict[str, list[Callable[[DomainEvent], Awaitable[None]]]] = {}


def subscribe(event_type: str):
    """Decorador para suscribir un handler a un tipo de evento."""
    def decorator(func: Callable[[DomainEvent], Awaitable[None]]):
        if event_type not in _event_handlers:
            _event_handlers[event_type] = []
        _event_handlers[event_type].append(func)
        return func
    return decorator


async def publish(event: DomainEvent) -> None:
    """
    Publica un evento de dominio con DLQ y retry logic.
    1. Lo persiste en Redis Stream para durabilidad
    2. Ejecuta handlers locales con reintentos automáticos
    3. Si falla después de 3 reintentos, envía a Dead Letter Queue
    """
    # Persistir en Redis Stream
    stream_key = f"events:{event.aggregate_type}"
    await redis_client.xadd(
        stream_key,
        {"data": json.dumps(asdict(event))},
        maxlen=10000,
    )

    # Ejecutar handlers locales con retry logic
    handlers = _event_handlers.get(event.event_type, [])
    for handler in handlers:
        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
                await handler(event)
                break  # Handler exitoso, salir del loop
            except Exception as e:
                retry_count += 1
                logger.error(
                    "Error en handler de evento",
                    extra={
                        "event_type": event.event_type,
                        "event_id": event.event_id,
                        "handler": handler.__name__,
                        "retry_attempt": retry_count,
                        "error": str(e),
                        "aggregate_type": event.aggregate_type,
                        "aggregate_id": event.aggregate_id,
                    },
                    exc_info=True,
                )

                if retry_count >= max_retries:
                    # Enviar a Dead Letter Queue después de 3 intentos
                    await _send_to_dlq(event, handler.__name__, str(e))
                    logger.critical(
                        "Evento enviado a DLQ después de 3 intentos fallidos",
                        extra={
                            "event_type": event.event_type,
                            "event_id": event.event_id,
                            "handler": handler.__name__,
                            "error": str(e),
                        },
                    )
                else:
                    # Exponential backoff: 2^retry_count segundos
                    backoff_seconds = 2 ** retry_count
                    logger.warning(
                        f"Reintentando handler en {backoff_seconds}s (intento {retry_count}/{max_retries})",
                        extra={
                            "event_type": event.event_type,
                            "event_id": event.event_id,
                            "handler": handler.__name__,
                            "backoff_seconds": backoff_seconds,
                        },
                    )
                    await asyncio.sleep(backoff_seconds)


async def _send_to_dlq(event: DomainEvent, handler_name: str, error_message: str) -> None:
    """
    Envía un evento fallido al Dead Letter Queue en Redis.
    DLQ usa un Redis Stream separado para análisis posterior.
    """
    dlq_entry = {
        "event_data": json.dumps(asdict(event)),
        "handler": handler_name,
        "error": error_message,
        "failed_at": datetime.now(timezone.utc).isoformat(),
        "event_type": event.event_type,
        "event_id": event.event_id,
        "aggregate_type": event.aggregate_type,
        "aggregate_id": event.aggregate_id,
    }

    try:
        await redis_client.xadd(
            "events:dlq",
            dlq_entry,
            maxlen=5000,  # Mantener últimos 5000 eventos fallidos
        )
    except Exception as dlq_error:
        logger.critical(
            "CRÍTICO: No se pudo enviar evento a DLQ",
            extra={
                "event_id": event.event_id,
                "dlq_error": str(dlq_error),
                "original_error": error_message,
            },
            exc_info=True,
        )


# =============================================
# Tipos de eventos predefinidos del sistema
# =============================================

# Pacientes
PATIENT_REGISTERED = "patient.registered"
PATIENT_UPDATED = "patient.updated"

# Citas
APPOINTMENT_CREATED = "appointment.created"
APPOINTMENT_CONFIRMED = "appointment.confirmed"
APPOINTMENT_CANCELLED = "appointment.cancelled"
APPOINTMENT_COMPLETED = "appointment.completed"
APPOINTMENT_NO_SHOW = "appointment.no_show"

# Historia Clinica
ENCOUNTER_STARTED = "encounter.started"
ENCOUNTER_COMPLETED = "encounter.completed"
CLINICAL_NOTE_SIGNED = "clinical_note.signed"
ORDER_CREATED = "medical_order.created"

# Facturacion
CHARGE_CREATED = "charge.created"
INVOICE_GENERATED = "invoice.generated"
PAYMENT_RECEIVED = "payment.received"
CLAIM_SUBMITTED = "insurance_claim.submitted"
CLAIM_ADJUDICATED = "insurance_claim.adjudicated"

# Farmacia
PRESCRIPTION_CREATED = "prescription.created"
MEDICATION_DISPENSED = "medication.dispensed"
STOCK_LOW = "stock.low_alert"
STOCK_EXPIRED = "stock.expiration_alert"

# Clinical Decision Support
CDS_ALERT_GENERATED = "cds.alert_generated"
CDS_ALERT_OVERRIDDEN = "cds.alert_overridden"
