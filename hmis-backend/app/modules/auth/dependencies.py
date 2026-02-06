"""
Dependencias de FastAPI para autenticacion y autorizacion.
Proveen el usuario actual y verificacion de permisos.
"""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.modules.auth.models import User
from app.modules.auth.service import UserService

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependencia que extrae y valida el usuario actual desde el token JWT.
    Lanza 401 si el token es invalido o el usuario no existe.
    """
    token = credentials.credentials
    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tipo de token invalido",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no contiene identificador de usuario",
        )

    user_service = UserService(db)
    user = await user_service.get_user(uuid.UUID(user_id))

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o desactivado",
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Verifica que el usuario este activo."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )
    return current_user


def require_permissions(*required_permissions: str):
    """
    Fabrica de dependencias que verifica permisos especificos.
    Uso: Depends(require_permissions("patients:write", "billing:read"))
    """

    async def check_permissions(
        current_user: User = Depends(get_current_user),
    ) -> User:
        # Superusuarios tienen acceso completo
        if current_user.is_superuser:
            return current_user

        # Recopilar todos los permisos del usuario
        user_permissions: set[str] = set()
        for role in current_user.roles:
            for perm in role.permissions:
                user_permissions.add(perm)

        # Permiso comodin
        if "*" in user_permissions:
            return current_user

        # Verificar cada permiso requerido
        for perm in required_permissions:
            if perm not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permiso insuficiente: se requiere '{perm}'",
                )

        return current_user

    return check_permissions


def require_roles(*required_roles: str):
    """
    Fabrica de dependencias que verifica roles especificos.
    Uso: Depends(require_roles("admin", "medico"))
    """

    async def check_roles(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.is_superuser:
            return current_user

        user_roles = {role.name for role in current_user.roles}

        if not user_roles.intersection(set(required_roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere uno de estos roles: {', '.join(required_roles)}",
            )

        return current_user

    return check_roles
