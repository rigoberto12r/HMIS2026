"""
OpenTelemetry distributed tracing configuration for HMIS 2026.
Provides end-to-end request tracing across FastAPI, SQLAlchemy, and Redis.
"""

import logging
from typing import Optional

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

from app.core.config import settings

logger = logging.getLogger(__name__)


def setup_tracing(app) -> Optional[TracerProvider]:
    """
    Configure OpenTelemetry distributed tracing.

    Instruments:
    - FastAPI (HTTP requests, routes, middleware)
    - SQLAlchemy (database queries, connections)
    - Redis (cache operations, pub/sub)

    Exports traces to OTLP collector (Jaeger/Tempo/etc.)

    Args:
        app: FastAPI application instance

    Returns:
        TracerProvider instance if tracing enabled, None otherwise
    """
    # Skip tracing in development/test to reduce noise
    if settings.ENVIRONMENT in ("development", "test"):
        logger.info("Tracing disabled in %s environment", settings.ENVIRONMENT)
        return None

    if not settings.OTLP_ENDPOINT:
        logger.warning("OTLP_ENDPOINT not configured, tracing disabled")
        return None

    try:
        # Create resource with service metadata
        resource = Resource.create(
            {
                SERVICE_NAME: "hmis-backend",
                SERVICE_VERSION: getattr(settings, "VERSION", "1.0.0"),
                "environment": settings.ENVIRONMENT,
                "deployment.environment": settings.ENVIRONMENT,
            }
        )

        # Configure trace provider
        provider = TracerProvider(resource=resource)

        # OTLP exporter (sends traces to Jaeger/Tempo via gRPC)
        otlp_exporter = OTLPSpanExporter(
            endpoint=settings.OTLP_ENDPOINT,
            insecure=settings.OTLP_INSECURE,  # Use TLS in production
        )

        # Batch processor (collects spans and sends in batches)
        processor = BatchSpanProcessor(
            otlp_exporter,
            max_queue_size=2048,
            max_export_batch_size=512,
            schedule_delay_millis=5000,  # Export every 5 seconds
        )
        provider.add_span_processor(processor)

        # Set as global trace provider
        trace.set_tracer_provider(provider)

        # Instrument FastAPI
        FastAPIInstrumentor.instrument_app(
            app,
            excluded_urls=settings.TRACING_EXCLUDED_URLS,  # Skip health checks, metrics
            tracer_provider=provider,
        )
        logger.info("FastAPI instrumentation enabled")

        # Instrument SQLAlchemy (auto-instruments all engines)
        SQLAlchemyInstrumentor().instrument(
            tracer_provider=provider,
            enable_commenter=True,  # Add trace context to SQL comments
        )
        logger.info("SQLAlchemy instrumentation enabled")

        # Instrument Redis
        RedisInstrumentor().instrument(
            tracer_provider=provider,
        )
        logger.info("Redis instrumentation enabled")

        logger.info(
            "OpenTelemetry tracing configured successfully",
            extra={
                "otlp_endpoint": settings.OTLP_ENDPOINT,
                "service_name": "hmis-backend",
                "environment": settings.ENVIRONMENT,
            },
        )

        return provider

    except Exception as e:
        logger.error(
            "Failed to configure OpenTelemetry tracing",
            extra={"error": str(e)},
            exc_info=True,
        )
        return None


def get_current_span() -> trace.Span:
    """
    Get the current active span for adding custom attributes.

    Usage:
        from app.core.tracing import get_current_span

        span = get_current_span()
        span.set_attribute("patient.id", str(patient_id))
        span.set_attribute("operation.type", "create_patient")
    """
    return trace.get_current_span()


def add_span_attributes(**attributes):
    """
    Add custom attributes to the current span.

    Usage:
        from app.core.tracing import add_span_attributes

        add_span_attributes(
            patient_id=str(patient.id),
            tenant_id="tenant_demo",
            operation="create_patient"
        )

    Args:
        **attributes: Key-value pairs to add as span attributes
    """
    span = get_current_span()
    for key, value in attributes.items():
        span.set_attribute(key, str(value))


def record_exception(exception: Exception, **attributes):
    """
    Record an exception in the current span.

    Usage:
        try:
            await some_operation()
        except Exception as e:
            record_exception(e, patient_id=str(patient_id))
            raise

    Args:
        exception: The exception to record
        **attributes: Additional context attributes
    """
    span = get_current_span()
    span.record_exception(exception)

    # Add custom attributes
    for key, value in attributes.items():
        span.set_attribute(f"exception.{key}", str(value))

    # Mark span as error
    span.set_status(trace.Status(trace.StatusCode.ERROR, str(exception)))
