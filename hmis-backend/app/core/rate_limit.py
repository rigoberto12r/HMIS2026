"""
Middleware de limitacion de peticiones (Rate Limiting) en memoria.
Implementacion ligera sin dependencia de Redis para el MVP.

Estrategia: ventana fija por IP. Cada IP tiene un contador y un
timestamp de inicio de ventana. Al expirar la ventana se reinicia.

Limites configurables desde Settings:
- RATE_LIMIT_GENERAL: peticiones/minuto para endpoints generales.
- RATE_LIMIT_LOGIN: peticiones/minuto para el endpoint de login.
- RATE_LIMIT_WINDOW_SECONDS: duracion de la ventana en segundos.
"""

import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware que limita la cantidad de peticiones por IP en una ventana
    de tiempo. Devuelve HTTP 429 con mensaje en espanol si se excede el limite.
    """

    # Rutas con limite estricto (login / autenticacion)
    RUTAS_ESTRICTAS: set[str] = {
        "/api/v1/auth/login",
        "/api/v1/auth/token",
    }

    def __init__(self, app: "ASGIApp") -> None:  # noqa: F821
        super().__init__(app)
        # Almacen en memoria: {ip: (contador, inicio_ventana)}
        self._general: dict[str, tuple[int, float]] = {}
        # Almacen separado para rutas estrictas
        self._estricto: dict[str, tuple[int, float]] = {}

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
        return "desconocido"

    def _verificar_limite(
        self,
        almacen: dict[str, tuple[int, float]],
        ip: str,
        limite: int,
        ventana: int,
    ) -> tuple[bool, int]:
        """
        Verifica si la IP excede el limite dentro de la ventana.
        Retorna (excedido: bool, peticiones_restantes: int).
        """
        ahora = time.time()
        contador, inicio = almacen.get(ip, (0, ahora))

        # Si la ventana expiro, reiniciar
        if ahora - inicio >= ventana:
            almacen[ip] = (1, ahora)
            return False, limite - 1

        # Incrementar contador
        nuevo_contador = contador + 1
        almacen[ip] = (nuevo_contador, inicio)

        if nuevo_contador > limite:
            return True, 0

        return False, limite - nuevo_contador

    def _limpiar_entradas_expiradas(self, almacen: dict[str, tuple[int, float]], ventana: int) -> None:
        """Elimina entradas cuya ventana ya expiro para liberar memoria."""
        ahora = time.time()
        claves_expiradas = [
            ip for ip, (_, inicio) in almacen.items() if ahora - inicio >= ventana
        ]
        for clave in claves_expiradas:
            del almacen[clave]

    # ------------------------------------------------------------------
    # Dispatch principal
    # ------------------------------------------------------------------

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Rutas de salud y documentacion no tienen limite
        if request.url.path in ("/health", "/api/docs", "/api/redoc", "/api/openapi.json"):
            return await call_next(request)

        ip = self._obtener_ip(request)
        ventana = settings.RATE_LIMIT_WINDOW_SECONDS

        # Limpieza periodica ligera (cada 100 peticiones aprox.)
        if len(self._general) > 1000:
            self._limpiar_entradas_expiradas(self._general, ventana)
        if len(self._estricto) > 500:
            self._limpiar_entradas_expiradas(self._estricto, ventana)

        # Determinar si la ruta usa limite estricto
        es_ruta_estricta = request.url.path in self.RUTAS_ESTRICTAS

        if es_ruta_estricta:
            limite = settings.RATE_LIMIT_LOGIN
            excedido, restantes = self._verificar_limite(
                self._estricto, ip, limite, ventana
            )
        else:
            limite = settings.RATE_LIMIT_GENERAL
            excedido, restantes = self._verificar_limite(
                self._general, ip, limite, ventana
            )

        if excedido:
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
                },
            )

        # Agregar headers informativos de limite
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limite)
        response.headers["X-RateLimit-Remaining"] = str(restantes)
        return response
