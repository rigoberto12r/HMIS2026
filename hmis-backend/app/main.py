"""
HMIS SaaS - Punto de entrada principal de la aplicacion FastAPI.
Sistema de Gestion Hospitalaria Cloud-Native para Latinoamerica.
"""

import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.middleware import TenantMiddleware, AuditMiddleware
from app.core.metrics import PrometheusMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.modules.auth.routes import router as auth_router
from app.modules.patients.routes import router as patients_router
from app.modules.appointments.routes import router as appointments_router
from app.modules.emr.routes import router as emr_router
from app.modules.billing.routes import router as billing_router
from app.modules.pharmacy.routes import router as pharmacy_router

logger = get_logger("hmis.app")


def _init_sentry() -> None:
    """Inicializa Sentry si hay DSN configurado."""
    dsn = getattr(settings, "SENTRY_DSN", "")
    if dsn:
        sentry_sdk.init(
            dsn=dsn,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
            profiles_sample_rate=0.1,
            send_default_pii=False,
        )
        logger.info("Sentry inicializado para entorno %s", settings.ENVIRONMENT)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicacion: inicializacion y limpieza."""
    # Configurar logging estructurado
    setup_logging()
    logger.info("Iniciando HMIS SaaS v1.0.0 [%s]", settings.ENVIRONMENT)

    # Inicializar Sentry
    _init_sentry()

    # Verificar conexiones
    from app.core.database import engine
    from app.core.cache import redis_client

    async with engine.begin() as conn:
        await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
    logger.info("Conexion a base de datos verificada")

    await redis_client.ping()
    logger.info("Conexion a Redis verificada")

    logger.info("HMIS SaaS listo para recibir peticiones")
    yield

    # Limpieza
    logger.info("Deteniendo HMIS SaaS...")
    await engine.dispose()
    await redis_client.close()


def create_app() -> FastAPI:
    """Fabrica de la aplicacion FastAPI."""
    app = FastAPI(
        title="HMIS SaaS",
        description=(
            "Sistema de Gestion Hospitalaria Cloud-Native para Latinoamerica. "
            "API REST para gestion de pacientes, citas, historia clinica electronica, "
            "facturacion, farmacia e inventario."
        ),
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ------ Middleware (orden importa: ultimo registrado se ejecuta primero) ------

    # CORS - origenes dependientes del entorno
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Host de confianza
    allowed_hosts = settings.get_allowed_hosts()
    if allowed_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    # Metricas Prometheus
    app.add_middleware(PrometheusMiddleware)

    # Rate limiting
    app.add_middleware(RateLimitMiddleware)

    # Multi-tenancy
    app.add_middleware(TenantMiddleware)

    # Auditoria regulatoria
    app.add_middleware(AuditMiddleware)

    # ------ Rutas de modulos ------

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Autenticacion"])
    app.include_router(patients_router, prefix="/api/v1/patients", tags=["Pacientes"])
    app.include_router(appointments_router, prefix="/api/v1/appointments", tags=["Citas"])
    app.include_router(emr_router, prefix="/api/v1/emr", tags=["Historia Clinica Electronica"])
    app.include_router(billing_router, prefix="/api/v1/billing", tags=["Facturacion y Seguros"])
    app.include_router(pharmacy_router, prefix="/api/v1/pharmacy", tags=["Farmacia e Inventario"])

    # ------ Endpoints de sistema ------

    @app.get("/health", tags=["Sistema"])
    async def health_check():
        """Verificacion de salud del servicio."""
        return {"status": "ok", "version": "1.0.0", "servicio": "HMIS SaaS"}

    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        """Endpoint de metricas Prometheus."""
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/api/v1", tags=["Sistema"])
    async def api_root():
        """Raiz de la API v1 con enlaces a modulos disponibles."""
        return {
            "mensaje": "HMIS SaaS API v1",
            "modulos": {
                "autenticacion": "/api/v1/auth",
                "pacientes": "/api/v1/patients",
                "citas": "/api/v1/appointments",
                "historia_clinica": "/api/v1/emr",
                "facturacion": "/api/v1/billing",
                "farmacia": "/api/v1/pharmacy",
            },
            "documentacion": "/api/docs",
        }

    return app


app = create_app()
