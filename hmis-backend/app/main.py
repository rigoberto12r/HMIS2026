"""
HMIS SaaS - Punto de entrada principal de la aplicacion FastAPI.
Sistema de Gestion Hospitalaria Cloud-Native para Latinoamerica.
"""

import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.middleware import TenantMiddleware, AuditMiddleware
from app.core.metrics import PrometheusMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.shared.exceptions import DomainException

# Optional: OpenTelemetry distributed tracing (requires opentelemetry packages)
try:
    from app.core.tracing import setup_tracing
    TRACING_AVAILABLE = True
except ImportError:
    TRACING_AVAILABLE = False
    setup_tracing = None
from app.modules.auth.routes import router as auth_router
from app.modules.patients.routes import router as patients_router
from app.modules.appointments.routes import router as appointments_router
from app.modules.emr.routes import router as emr_router
from app.modules.billing.routes import router as billing_router
from app.modules.pharmacy.routes import router as pharmacy_router
from app.modules.admin.routes import router as admin_router
from app.modules.portal.routes import router as portal_router
from app.modules.reports.routes import router as reports_router
from app.modules.reports.cqrs_routes import router as cqrs_reports_router
from app.modules.fhir.routes import router as fhir_router
from app.modules.ccda.routes import router as ccda_router
from app.modules.smart.routes import router as smart_router, build_smart_configuration

# Optional: Stripe payment routes (if stripe package is installed)
try:
    from app.modules.billing.payment_routes import router as payment_router
    STRIPE_AVAILABLE = True
except ImportError:
    payment_router = None
    STRIPE_AVAILABLE = False

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

    # Iniciar programador de tareas en segundo plano
    from app.tasks import start_scheduler
    start_scheduler()
    logger.info("Programador de tareas en segundo plano iniciado")

    # Registrar proyecciones CQRS
    from app.cqrs.projections import register_projections
    register_projections()
    logger.info("Proyecciones CQRS registradas")

    logger.info("HMIS SaaS listo para recibir peticiones")
    yield

    # Limpieza
    logger.info("Deteniendo HMIS SaaS...")
    from app.tasks import stop_scheduler
    stop_scheduler()
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

    # ------ OpenTelemetry Tracing ------
    # Configure distributed tracing (instruments FastAPI, SQLAlchemy, Redis)
    if TRACING_AVAILABLE:
        setup_tracing(app)
    else:
        logger.info("OpenTelemetry tracing not available (dependencies not installed)")

    # ------ Exception Handlers ------

    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException):
        """Maneja excepciones de dominio con respuestas HTTP semanticas."""
        logger.warning(
            "DomainException: %s",
            exc.message,
            extra={
                "status_code": exc.status_code,
                "path": request.url.path,
                "details": exc.details,
            },
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, **exc.details},
        )

    # ------ Middleware (orden importa: ultimo registrado se ejecuta primero) ------

    # Auditoria regulatoria
    app.add_middleware(AuditMiddleware)

    # Multi-tenancy
    app.add_middleware(TenantMiddleware)

    # Rate limiting
    app.add_middleware(RateLimitMiddleware)

    # Metricas Prometheus
    app.add_middleware(PrometheusMiddleware)

    # Host de confianza
    allowed_hosts = settings.get_allowed_hosts()
    if allowed_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    # CORS - DEBE SER EL ULTIMO para ejecutarse primero y agregar headers a todas las respuestas
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------ Rutas de modulos ------

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Autenticacion"])
    app.include_router(patients_router, prefix="/api/v1/patients", tags=["Pacientes"])
    app.include_router(appointments_router, prefix="/api/v1/appointments", tags=["Citas"])
    app.include_router(emr_router, prefix="/api/v1/emr", tags=["Historia Clinica Electronica"])
    app.include_router(billing_router, prefix="/api/v1/billing", tags=["Facturacion y Seguros"])
    if STRIPE_AVAILABLE:
        app.include_router(payment_router, prefix="/api/v1/payments", tags=["Stripe Payments"])
    else:
        logger.info("Stripe payment routes not available (stripe package not installed)")
    app.include_router(pharmacy_router, prefix="/api/v1/pharmacy", tags=["Farmacia e Inventario"])
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["Administracion"])
    app.include_router(portal_router, prefix="/api/v1/portal", tags=["Patient Portal"])
    app.include_router(reports_router, prefix="/api/v1/reports", tags=["Custom Reports"])
    app.include_router(cqrs_reports_router, prefix="/api/v1/cqrs/reports", tags=["CQRS Reports (Read Replica)"])
    app.include_router(fhir_router, prefix="/api/v1/fhir", tags=["FHIR R4 Interoperability"])
    app.include_router(ccda_router, prefix="/api/v1/ccda", tags=["C-CDA R2.1 Export"])
    app.include_router(smart_router, prefix="/api/v1/smart", tags=["SMART on FHIR"])

    # ------ SMART on FHIR Discovery (must be at root per spec) ------

    @app.get("/.well-known/smart-configuration", tags=["SMART on FHIR"])
    async def smart_configuration(request: Request):
        """SMART on FHIR discovery document (public, no auth)."""
        base_url = str(request.base_url).rstrip("/")
        return JSONResponse(content=build_smart_configuration(base_url))

    # ------ Endpoints de sistema ------

    @app.get("/health", tags=["Sistema"])
    async def health_check():
        """Verificacion basica de salud del servicio."""
        return {"status": "ok", "version": "1.0.0", "servicio": "HMIS SaaS"}

    @app.get("/health/live", tags=["Sistema"])
    async def health_live():
        """Liveness probe: el proceso esta vivo."""
        return {"status": "alive"}

    @app.get("/health/ready", tags=["Sistema"])
    async def health_ready():
        """Readiness probe: la app puede recibir trafico (DB + Redis OK)."""
        from app.core.database import engine
        from app.core.cache import redis_client

        checks = {"database": False, "redis": False}
        try:
            async with engine.connect() as conn:
                await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            checks["database"] = True
        except Exception:
            pass

        try:
            await redis_client.ping()
            checks["redis"] = True
        except Exception:
            pass

        all_ok = all(checks.values())
        status_code = 200 if all_ok else 503
        return Response(
            content=__import__("json").dumps({
                "status": "ready" if all_ok else "not_ready",
                "checks": checks,
            }),
            status_code=status_code,
            media_type="application/json",
        )

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
                "fhir_r4": "/api/v1/fhir",
                "ccda_r21": "/api/v1/ccda",
            },
            "documentacion": "/api/docs",
        }

    return app


app = create_app()
