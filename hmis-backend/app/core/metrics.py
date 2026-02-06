"""
Middleware y utilidades de metricas Prometheus.
Expone metricas en /metrics para scraping.

Metricas expuestas:
- hmis_http_requests_total: Total de peticiones HTTP por metodo, ruta y status.
- hmis_http_request_duration_seconds: Histograma de duracion por ruta.
- hmis_active_requests: Peticiones activas concurrentes.
- hmis_db_operations_total: Operaciones de base de datos por tipo.
"""

import time
from typing import Callable

from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ------------------------------------------------------------------
# Definicion de metricas
# ------------------------------------------------------------------

HTTP_REQUESTS_TOTAL = Counter(
    "hmis_http_requests_total",
    "Total de peticiones HTTP",
    ["method", "path_template", "status_code"],
)

HTTP_REQUEST_DURATION = Histogram(
    "hmis_http_request_duration_seconds",
    "Duracion de peticiones HTTP en segundos",
    ["method", "path_template"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

ACTIVE_REQUESTS = Gauge(
    "hmis_active_requests",
    "Peticiones activas concurrentes",
)

DB_OPERATIONS = Counter(
    "hmis_db_operations_total",
    "Operaciones de base de datos",
    ["operation", "module"],
)


# ------------------------------------------------------------------
# Utilidades
# ------------------------------------------------------------------

def _normalize_path(path: str) -> str:
    """
    Normaliza rutas para agrupar metricas.
    /api/v1/patients/uuid-123 -> /api/v1/patients/{id}
    """
    parts = path.strip("/").split("/")
    normalized = []
    for part in parts:
        # Si parece un UUID o ID numerico, reemplazar
        if len(part) == 36 and part.count("-") == 4:
            normalized.append("{id}")
        elif part.isdigit():
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/" + "/".join(normalized)


def track_db_operation(operation: str, module: str) -> None:
    """Registra una operacion de base de datos."""
    DB_OPERATIONS.labels(operation=operation, module=module).inc()


# ------------------------------------------------------------------
# Middleware
# ------------------------------------------------------------------

class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    Middleware que recopila metricas de cada request HTTP.
    Excluye /metrics y /health del tracking para evitar ruido.
    """

    EXCLUDED_PATHS = {"/metrics", "/health", "/api/docs", "/api/redoc", "/api/openapi.json"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # No medir endpoints de infraestructura
        if path in self.EXCLUDED_PATHS:
            return await call_next(request)

        method = request.method
        path_template = _normalize_path(path)

        ACTIVE_REQUESTS.inc()
        start_time = time.time()

        try:
            response = await call_next(request)
            status_code = str(response.status_code)
        except Exception:
            status_code = "500"
            raise
        finally:
            duration = time.time() - start_time
            ACTIVE_REQUESTS.dec()

            HTTP_REQUESTS_TOTAL.labels(
                method=method,
                path_template=path_template,
                status_code=status_code,
            ).inc()

            HTTP_REQUEST_DURATION.labels(
                method=method,
                path_template=path_template,
            ).observe(duration)

        return response
