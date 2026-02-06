"""
Sistema de eventos para comunicacion entre modulos (Event-Driven Architecture).
Usa Redis Streams para desacoplar modulos manteniendo trazabilidad.
"""

import json
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Any, Callable, Awaitable

from app.core.cache import redis_client


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
    Publica un evento de dominio.
    1. Lo persiste en Redis Stream para durabilidad
    2. Ejecuta handlers locales registrados
    """
    # Persistir en Redis Stream
    stream_key = f"events:{event.aggregate_type}"
    await redis_client.xadd(
        stream_key,
        {"data": json.dumps(asdict(event))},
        maxlen=10000,
    )

    # Ejecutar handlers locales
    handlers = _event_handlers.get(event.event_type, [])
    for handler in handlers:
        try:
            await handler(event)
        except Exception as e:
            # TODO: Log error y enviar a dead letter queue
            print(f"Error en handler de evento {event.event_type}: {e}")


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
