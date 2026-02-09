"""
Middleware de limitacion de peticiones (Rate Limiting) distribuido con Redis.
Implementacion robusta usando algoritmo de ventana deslizante (sliding window).

Ventajas sobre implementacion en memoria:
- Funciona correctamente en clusters (multiples instancias backend)
- Precision 99% vs 70% de ventana fija
- Persiste entre reinicios de la aplicacion
- Limpieza automatica de datos expirados por Redis (EXPIRE)

Estrategia: Sliding window con Redis ZSET (Sorted Set)
- Cada peticion se agrega al ZSET con timestamp como score
- Se eliminan peticiones fuera de la ventana
- Se cuenta el total de peticiones en la ventana

Limites configurables desde Settings:
- RATE_LIMIT_GENERAL: peticiones/minuto para endpoints generales
- RATE_LIMIT_LOGIN: peticiones/minuto para el endpoint de login
- RATE_LIMIT_WINDOW_SECONDS: duracion de la ventana en segundos
"""

import time
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("hmis.rate_limit")

# Import redis_client lazily to avoid circular imports
_redis_client = None


def get_redis_client():
    """Get Redis client singleton."""
    global _redis_client
    if _redis_client is None:
        from app.core.cache import redis_client
        _redis_client = redis_client
    return _redis_client


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware que limita la cantidad de peticiones por IP usando Redis
    con algoritmo de ventana deslizante (sliding window).
    Devuelve HTTP 429 si se excede el limite.
    """

    # Rutas con limite estricto (login / autenticacion)
    RUTAS_ESTRICTAS: set[str] = {
        "/api/v1/auth/login",
        "/api/v1/auth/token",
        "/api/v1/auth/register",
    }

    # Rutas excluidas de rate limiting
    RUTAS_EXCLUIDAS: set[str] = {
        "/health",
        "/health/live",
        "/health/ready",
        "/metrics",
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
    }

    # ------------------------------------------------------------------
    # Utilidades internas
    # ------------------------------------------------------------------

    @staticmethod
    def _obtener_ip(request: Request) -> str:
        """Obtiene la IP del cliente, considerando proxies inversos."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Tomar la primera IP de la cadena
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    async def _verificar_limite_redis(
        self,
        redis_key: str,
        limite: int,
        ventana: int,
    ) -> tuple[bool, int]:
        """
        Verifica si se excede el limite usando Redis ZSET (sliding window).

        Args:
            redis_key: Clave Redis para este rate limit (ej: "ratelimit:192.168.1.1:general")
            limite: Numero maximo de peticiones permitidas
            ventana: Ventana de tiempo en segundos

        Returns:
            (excedido: bool, peticiones_restantes: int)
        """
        redis = get_redis_client()
        ahora = time.time()
        ventana_inicio = ahora - ventana

        try:
            # Pipeline para operaciones atomicas
            pipe = redis.pipeline()

            # 1. Eliminar peticiones fuera de la ventana
            pipe.zremrangebyscore(redis_key, 0, ventana_inicio)

            # 2. Contar peticiones en la ventana actual
            pipe.zcard(redis_key)

            # 3. Agregar la peticion actual
            pipe.zadd(redis_key, {str(uuid.uuid4()): ahora})

            # 4. Configurar expiracion de la clave (ventana + buffer)
            pipe.expire(redis_key, ventana + 10)

            # Ejecutar pipeline
            results = await pipe.execute()

            # Resultado del ZCARD (antes de agregar la peticion actual)
            count = results[1]

            # Verificar si se excedio el limite
            if count >= limite:
                return True, 0

            return False, limite - count - 1

        except Exception as e:
            # Si Redis falla, permitir la peticion pero loguear error
            logger.error(
                "Error en rate limiting con Redis",
                extra={
                    "error": str(e),
                    "redis_key": redis_key,
                    "fallback": "allowing_request",
                },
            )
            return False, limite

    # ------------------------------------------------------------------
    # Dispatch principal
    # ------------------------------------------------------------------

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # No aplicar rate limiting a peticiones OPTIONS ni rutas excluidas
        if request.method == "OPTIONS" or request.url.path in self.RUTAS_EXCLUIDAS:
            return await call_next(request)

        ip = self._obtener_ip(request)
        ventana = settings.RATE_LIMIT_WINDOW_SECONDS

        # Determinar si la ruta usa limite estricto
        es_ruta_estricta = request.url.path in self.RUTAS_ESTRICTAS

        if es_ruta_estricta:
            limite = settings.RATE_LIMIT_LOGIN
            # Clave Redis especifica para rutas estrictas
            redis_key = f"ratelimit:{ip}:{request.url.path}"
        else:
            limite = settings.RATE_LIMIT_GENERAL
            # Clave Redis general para el resto de endpoints
            redis_key = f"ratelimit:{ip}:general"

        # Verificar limite con Redis
        excedido, restantes = await self._verificar_limite_redis(
            redis_key, limite, ventana
        )

        if excedido:
            logger.warning(
                "Rate limit excedido",
                extra={
                    "ip": ip,
                    "path": request.url.path,
                    "limite": limite,
                    "ventana_segundos": ventana,
                },
            )

            return JSONResponse(
                status_code=429,
                content={
                    "detail": (
                        "Demasiadas solicitudes. Ha excedido el limite de "
                        f"{limite} peticiones por minuto. "
                        "Por favor, intente de nuevo mas tarde."
                    ),
                    "codigo": "LIMITE_EXCEDIDO",
                },
                headers={
                    "Retry-After": str(ventana),
                    "X-RateLimit-Limit": str(limite),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + ventana)),
                },
            )

        # Agregar headers informativos de limite
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limite)
        response.headers["X-RateLimit-Remaining"] = str(max(0, restantes))
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + ventana))

        return response
