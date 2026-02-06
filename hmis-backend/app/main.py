"""
HMIS SaaS - Punto de entrada principal de la aplicacion FastAPI.
Sistema de Gestion Hospitalaria Cloud-Native para Latinoamerica.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.middleware import TenantMiddleware, AuditMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.modules.auth.routes import router as auth_router
from app.modules.patients.routes import router as patients_router
from app.modules.appointments.routes import router as appointments_router
from app.modules.emr.routes import router as emr_router
from app.modules.billing.routes import router as billing_router
from app.modules.pharmacy.routes import router as pharmacy_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicacion: inicializacion y limpieza."""
    # Inicializacion
    from app.core.database import engine
    from app.core.cache import redis_client

    # Verificar conexion a base de datos
    async with engine.begin() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("SELECT 1")
        )

    # Verificar conexion a Redis
    await redis_client.ping()

    yield

    # Limpieza
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
    # Starlette ejecuta los middlewares en orden inverso al de registro,
    # asi que el ultimo add_middleware() es el primero en procesar la peticion.

    # CORS - origenes dependientes del entorno
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Host de confianza (proteccion contra host header attacks)
    allowed_hosts = settings.get_allowed_hosts()
    if allowed_hosts:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=allowed_hosts,
        )

    # Limite de peticiones - se ejecuta ANTES de TenantMiddleware
    app.add_middleware(RateLimitMiddleware)

    # Multi-tenancy: resuelve el tenant desde subdominio o header
    app.add_middleware(TenantMiddleware)

    # Auditoria: registra todas las operaciones sobre datos clinicos
    app.add_middleware(AuditMiddleware)

    # ------ Rutas ------

    app.include_router(
        auth_router,
        prefix="/api/v1/auth",
        tags=["Autenticacion"],
    )
    app.include_router(
        patients_router,
        prefix="/api/v1/patients",
        tags=["Pacientes"],
    )
    app.include_router(
        appointments_router,
        prefix="/api/v1/appointments",
        tags=["Citas"],
    )
    app.include_router(
        emr_router,
        prefix="/api/v1/emr",
        tags=["Historia Clinica Electronica"],
    )
    app.include_router(
        billing_router,
        prefix="/api/v1/billing",
        tags=["Facturacion y Seguros"],
    )
    app.include_router(
        pharmacy_router,
        prefix="/api/v1/pharmacy",
        tags=["Farmacia e Inventario"],
    )

    # ------ Endpoints de salud ------

    @app.get("/health", tags=["Sistema"])
    async def health_check():
        """Verificacion de salud del servicio."""
        return {"status": "ok", "version": "1.0.0", "servicio": "HMIS SaaS"}

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
