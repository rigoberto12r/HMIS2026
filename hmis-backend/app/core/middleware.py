"""
Middleware personalizado para multi-tenancy y auditoria.
"""

import time
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.database import current_tenant


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware de Multi-Tenancy.
    Resuelve el tenant desde:
    1. Header X-Tenant-ID
    2. Subdominio (hospital1.hmis.app -> tenant_hospital1)

    Establece el tenant en el context var para que la sesion de BD
    use automaticamente el schema correcto.
    """

    EXCLUDED_PATHS = {"/health", "/api/docs", "/api/redoc", "/api/openapi.json", "/api/v1"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Rutas excluidas de tenancy (endpoints publicos)
        if request.url.path in self.EXCLUDED_PATHS:
            current_tenant.set(None)
            return await call_next(request)

        # Rutas de autenticacion no requieren tenant
        if request.url.path.startswith("/api/v1/auth"):
            current_tenant.set(None)
            return await call_next(request)

        tenant_id = None

        # 1. Intentar desde header
        tenant_id = request.headers.get(settings.TENANT_HEADER)

        # 2. Intentar desde subdominio
        if not tenant_id and settings.TENANT_SUBDOMAIN_ENABLED:
            host = request.headers.get("host", "")
            parts = host.split(".")
            if len(parts) >= 3:
                subdomain = parts[0]
                if subdomain not in ("www", "api", "admin"):
                    tenant_id = f"tenant_{subdomain}"

        if not tenant_id:
            return JSONResponse(
                status_code=400,
                content={
                    "detail": "Tenant no identificado. Proporcione el header X-Tenant-ID o use un subdominio valido."
                },
            )

        # Establecer el tenant en el contexto de la request
        current_tenant.set(tenant_id)

        response = await call_next(request)
        return response


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware de Auditoria.
    Registra todas las operaciones de escritura (POST, PUT, PATCH, DELETE)
    sobre datos clinicos para cumplimiento regulatorio.
    """

    AUDITED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Solo auditar metodos de escritura
        if request.method not in self.AUDITED_METHODS:
            return await call_next(request)

        request_id = str(uuid.uuid4())
        start_time = time.time()

        # Agregar request_id al state para uso en handlers
        request.state.request_id = request_id
        request.state.start_time = start_time

        response = await call_next(request)

        # Registrar en log de auditoria
        duration = time.time() - start_time
        # TODO: Escribir a tabla de auditoria async
        # audit_entry = {
        #     "request_id": request_id,
        #     "tenant": current_tenant.get(),
        #     "method": request.method,
        #     "path": request.url.path,
        #     "user": getattr(request.state, "user_id", None),
        #     "status_code": response.status_code,
        #     "duration_ms": round(duration * 1000, 2),
        #     "ip": request.client.host if request.client else None,
        # }

        response.headers["X-Request-ID"] = request_id
        return response
