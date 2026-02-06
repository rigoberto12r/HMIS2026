"""
Rutas de administracion del sistema: onboarding de tenants, gestion de schemas.
Solo accesible por superadmins.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, engine
from app.core.security import hash_password
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User

router = APIRouter()


# =============================================
# Schemas
# =============================================

class TenantCreateRequest(BaseModel):
    """Solicitud para crear un nuevo tenant (hospital)."""
    tenant_id: str = Field(
        ..., min_length=3, max_length=50,
        pattern=r"^[a-z][a-z0-9_]*$",
        description="Identificador unico del tenant (ej: hospital_central)",
    )
    hospital_name: str = Field(..., max_length=200)
    country: str = Field(default="DO", max_length=2)
    admin_email: str
    admin_password: str = Field(min_length=8, max_length=128)
    admin_first_name: str = Field(max_length=100)
    admin_last_name: str = Field(max_length=100)


class TenantResponse(BaseModel):
    """Respuesta de creacion de tenant."""
    tenant_id: str
    schema_name: str
    hospital_name: str
    admin_email: str
    mensaje: str


class TenantListItem(BaseModel):
    """Item de la lista de tenants."""
    tenant_id: str
    hospital_name: str
    country: str
    created_at: str
    is_active: bool


# =============================================
# Endpoints
# =============================================

@router.post("/tenants", response_model=TenantResponse, status_code=201)
async def create_tenant(
    data: TenantCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Crea un nuevo tenant (hospital) con su schema, tablas y usuario admin.

    Solo accesible por superadmins.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Solo superadmins pueden crear tenants")

    schema_name = f"tenant_{data.tenant_id}"

    # Verificar que no exista
    result = await db.execute(
        text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema"),
        {"schema": schema_name},
    )
    if result.scalar():
        raise HTTPException(status_code=409, detail=f"El tenant '{data.tenant_id}' ya existe")

    # Crear schema y tablas
    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE SCHEMA {schema_name}"))

    # Registrar en tabla maestra de tenants (public)
    await db.execute(
        text(
            "INSERT INTO tenants (id, tenant_id, schema_name, hospital_name, country, is_active, created_at) "
            "VALUES (:id, :tenant_id, :schema, :name, :country, true, NOW())"
        ),
        {
            "id": uuid.uuid4(),
            "tenant_id": data.tenant_id,
            "schema": schema_name,
            "name": data.hospital_name,
            "country": data.country,
        },
    )

    # Crear tablas en el nuevo schema via migracion
    async with engine.begin() as conn:
        await conn.execute(text(f"SET search_path TO {schema_name}, public"))
        # Crear las tablas base replicando la estructura del schema public
        from app.core.database import Base
        await conn.run_sync(Base.metadata.create_all)

    # Crear usuario admin del tenant
    admin = User(
        email=data.admin_email,
        hashed_password=hash_password(data.admin_password),
        first_name=data.admin_first_name,
        last_name=data.admin_last_name,
        is_verified=True,
        is_superuser=False,
        tenant_id=data.tenant_id,
        language="es",
        timezone="America/Santo_Domingo",
    )
    db.add(admin)
    await db.flush()

    return TenantResponse(
        tenant_id=data.tenant_id,
        schema_name=schema_name,
        hospital_name=data.hospital_name,
        admin_email=data.admin_email,
        mensaje=f"Tenant '{data.hospital_name}' creado exitosamente con schema {schema_name}",
    )


@router.get("/tenants", response_model=list[TenantListItem])
async def list_tenants(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista todos los tenants registrados. Solo superadmins."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Solo superadmins pueden listar tenants")

    result = await db.execute(
        text(
            "SELECT tenant_id, hospital_name, country, created_at, is_active "
            "FROM tenants ORDER BY created_at DESC"
        )
    )
    rows = result.fetchall()

    return [
        TenantListItem(
            tenant_id=row[0],
            hospital_name=row[1],
            country=row[2],
            created_at=str(row[3]),
            is_active=row[4],
        )
        for row in rows
    ]


@router.patch("/tenants/{tenant_id}/deactivate")
async def deactivate_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un tenant (no elimina datos). Solo superadmins."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Solo superadmins pueden desactivar tenants")

    result = await db.execute(
        text("UPDATE tenants SET is_active = false WHERE tenant_id = :tid RETURNING tenant_id"),
        {"tid": tenant_id},
    )
    if not result.scalar():
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' no encontrado")

    return {"mensaje": f"Tenant '{tenant_id}' desactivado exitosamente"}
