"""
Rutas de autenticacion y gestion de usuarios.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import (
    get_current_active_user,
    require_permissions,
    require_roles,
)
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RoleCreate,
    RoleResponse,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.modules.auth.service import AuthService, RoleService, UserService
from app.shared.schemas import MessageResponse, PaginatedResponse, PaginationParams

router = APIRouter()


# =============================================
# Autenticacion
# =============================================

@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Iniciar sesion con email y contrasena."""
    service = AuthService(db)
    result = await service.authenticate(data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales invalidas",
        )
    return result


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Renovar tokens usando refresh token."""
    service = AuthService(db)
    result = await service.refresh_tokens(data.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalido o expirado",
        )
    return result


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
):
    """Obtener perfil del usuario autenticado."""
    return UserResponse.model_validate(current_user)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Cambiar contrasena del usuario autenticado."""
    from app.core.security import verify_password, hash_password

    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contrasena actual incorrecta",
        )

    current_user.hashed_password = hash_password(data.new_password)
    await db.flush()

    return MessageResponse(mensaje="Contrasena actualizada correctamente")


# =============================================
# Gestion de Usuarios
# =============================================

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_permissions("users:write")),
    db: AsyncSession = Depends(get_db),
):
    """Crear un nuevo usuario (requiere permiso users:write)."""
    service = UserService(db)
    try:
        user = await service.create_user(data, tenant_id=current_user.tenant_id)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/users", response_model=PaginatedResponse[UserResponse])
async def list_users(
    pagination: Annotated[PaginationParams, Depends()],
    current_user: User = Depends(require_permissions("users:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar usuarios del tenant actual."""
    service = UserService(db)
    users, total = await service.list_users(
        tenant_id=current_user.tenant_id,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_permissions("users:read")),
    db: AsyncSession = Depends(get_db),
):
    """Obtener un usuario por ID."""
    service = UserService(db)
    user = await service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    current_user: User = Depends(require_permissions("users:write")),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar un usuario."""
    service = UserService(db)
    user = await service.update_user(user_id, data)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_permissions("users:write")),
    db: AsyncSession = Depends(get_db),
):
    """Desactivar (soft delete) un usuario. No se puede eliminar a sí mismo."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puede eliminar su propia cuenta",
        )

    service = UserService(db)
    user = await service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    user.is_active = False
    await db.flush()

    return MessageResponse(mensaje=f"Usuario {user.email} desactivado exitosamente")


# =============================================
# Roles
# =============================================

@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    current_user: User = Depends(require_permissions("users:read")),
    db: AsyncSession = Depends(get_db),
):
    """Listar todos los roles disponibles."""
    from sqlalchemy import select
    from app.modules.auth.models import Role

    result = await db.execute(
        select(Role).where(Role.is_active == True).order_by(Role.name)
    )
    roles = result.scalars().all()
    return [RoleResponse.model_validate(r) for r in roles]


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Crear un nuevo rol (solo administradores)."""
    from app.modules.auth.models import Role

    role = Role(**data.model_dump())
    db.add(role)
    await db.flush()
    return RoleResponse.model_validate(role)


@router.post("/roles/seed-defaults", response_model=MessageResponse)
async def seed_default_roles(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Crear roles por defecto del sistema."""
    service = RoleService(db)
    roles = await service.create_default_roles()
    return MessageResponse(
        mensaje=f"Se crearon {len(roles)} roles por defecto",
    )
