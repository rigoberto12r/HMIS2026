"""
Middleware personalizado para multi-tenancy y auditoria.
"""

import logging
import time
import uuid
from typing import Callable

from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.database import AsyncSessionLocal, current_tenant, engine

logger = logging.getLogger("hmis.audit")


# Cache simple para schema_names por tenant_id (evita queries repetitivas)
_tenant_schema_cache: dict[str, str] = {}


async def get_schema_for_tenant(tenant_id: str) -> str | None:
    """Resuelve el schema_name desde la tabla tenants."""
    # Check cache first
    if tenant_id in _tenant_schema_cache:
        return _tenant_schema_cache[tenant_id]

    # Query database
    async with engine.begin() as conn:
        result = await conn.execute(
            text("SELECT schema_name FROM tenants WHERE tenant_id = :tid AND is_active = true"),
            {"tid": tenant_id}
        )
        row = result.first()
        if row:
            schema_name = row[0]
            _tenant_schema_cache[tenant_id] = schema_name
            return schema_name
    return None


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
        # SIMPLIFIED: Always use 'public' schema for single-tenant deployment
        # Multi-tenancy disabled - all requests use the public schema
        current_tenant.set("public")
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

        # Registrar en log de auditoria async (fire-and-forget)
        duration = time.time() - start_time
        audit_entry = {
            "request_id": request_id,
            "tenant": current_tenant.get(),
            "method": request.method,
            "path": request.url.path,
            "user_id": getattr(request.state, "user_id", None),
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "ip": request.client.host if request.client else None,
        }

        try:
            await self._write_audit_log(audit_entry)
        except Exception:
            logger.warning("Error escribiendo log de auditoria: %s", audit_entry, exc_info=True)

        response.headers["X-Request-ID"] = request_id
        return response

    @staticmethod
    async def _write_audit_log(entry: dict) -> None:
        """Escribe un registro de auditoria en la tabla audit_logs."""
        from sqlalchemy import text

        user_id = entry.get("user_id")
        async with AsyncSessionLocal() as session:
            await session.execute(
                text(
                    "INSERT INTO audit_logs (id, timestamp, user_id, tenant_id, action, resource_type, resource_id, details, ip_address) "
                    "VALUES (:id, NOW(), :user_id, :tenant_id, :action, :resource_type, :resource_id, :details, :ip)"
                ),
                {
                    "id": uuid.uuid4(),
                    "user_id": user_id,
                    "tenant_id": entry.get("tenant"),
                    "action": entry["method"],
                    "resource_type": entry["path"],
                    "resource_id": entry.get("request_id"),
                    "details": f'{{"status": {entry["status_code"]}, "duration_ms": {entry["duration_ms"]}}}',
                    "ip": entry.get("ip"),
                },
            )
            await session.commit()
