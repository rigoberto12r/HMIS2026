"""
Servicio de autenticacion y gestion de usuarios.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.modules.auth.models import AuditLog, Role, User, UserRole
from app.modules.auth.schemas import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)


class AuthService:
    """Servicio de autenticacion."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate(self, login: LoginRequest) -> TokenResponse | None:
        """Autentica un usuario y retorna tokens JWT."""
        stmt = select(User).where(User.email == login.email).options(selectinload(User.roles))
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            return None

        # Verificar bloqueo por intentos fallidos
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            return None

        if not verify_password(login.password, user.hashed_password):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.now(timezone.utc)
            await self.db.flush()
            return None

        # Autenticacion exitosa
        user.failed_login_attempts = 0
        user.last_login = datetime.now(timezone.utc)
        user.locked_until = None
        await self.db.flush()

        # Generar tokens
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "tenant_id": user.tenant_id,
            "roles": [role.name for role in user.roles],
        }

        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse | None:
        """Renueva tokens usando un refresh token valido."""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None

        user_id = payload.get("sub")
        stmt = select(User).where(User.id == uuid.UUID(user_id)).options(selectinload(User.roles))
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            return None

        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "tenant_id": user.tenant_id,
            "roles": [role.name for role in user.roles],
        }

        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )


class UserService:
    """Servicio de gestion de usuarios."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, data: UserCreate, tenant_id: str | None = None) -> User:
        """Crea un nuevo usuario."""
        # Verificar que el email no exista
        stmt = select(User).where(User.email == data.email)
        result = await self.db.execute(stmt)
        if result.scalar_one_or_none():
            raise ValueError("El correo electronico ya esta registrado")

        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            license_number=data.license_number,
            specialty=data.specialty,
            department=data.department,
            language=data.language,
            timezone=data.timezone,
            tenant_id=tenant_id,
        )
        self.db.add(user)
        await self.db.flush()

        # Asignar roles
        for role_id in data.role_ids:
            user_role = UserRole(user_id=user.id, role_id=role_id)
            self.db.add(user_role)

        await self.db.flush()
        return user

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        """Obtiene un usuario por ID."""
        stmt = select(User).where(User.id == user_id).options(selectinload(User.roles))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate) -> User | None:
        """Actualiza un usuario."""
        user = await self.get_user(user_id)
        if not user:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        await self.db.flush()
        return user

    async def list_users(
        self, tenant_id: str | None = None, offset: int = 0, limit: int = 20
    ) -> tuple[list[User], int]:
        """Lista usuarios con paginacion."""
        stmt = select(User).options(selectinload(User.roles))
        count_stmt = select(User)

        if tenant_id:
            stmt = stmt.where(User.tenant_id == tenant_id)
            count_stmt = count_stmt.where(User.tenant_id == tenant_id)

        stmt = stmt.offset(offset).limit(limit).order_by(User.created_at.desc())

        result = await self.db.execute(stmt)
        users = list(result.scalars().all())

        from sqlalchemy import func
        count_result = await self.db.execute(select(func.count()).select_from(count_stmt.subquery()))
        total = count_result.scalar() or 0

        return users, total


class RoleService:
    """Servicio de gestion de roles."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_default_roles(self) -> list[Role]:
        """Crea los roles por defecto del sistema."""
        default_roles = [
            {
                "name": "admin",
                "display_name": "Administrador",
                "description": "Acceso completo al sistema",
                "permissions": ["*"],
                "is_system_role": True,
            },
            {
                "name": "medico",
                "display_name": "Medico",
                "description": "Acceso a historia clinica, prescripciones y ordenes",
                "permissions": [
                    "patients:read", "patients:write",
                    "encounters:read", "encounters:write",
                    "prescriptions:read", "prescriptions:write",
                    "orders:read", "orders:write",
                    "appointments:read",
                ],
                "is_system_role": True,
            },
            {
                "name": "enfermera",
                "display_name": "Enfermera",
                "description": "Acceso a signos vitales, administracion de medicamentos",
                "permissions": [
                    "patients:read",
                    "encounters:read",
                    "vitals:read", "vitals:write",
                    "medications:administer",
                    "appointments:read",
                ],
                "is_system_role": True,
            },
            {
                "name": "recepcion",
                "display_name": "Recepcion",
                "description": "Gestion de pacientes y citas",
                "permissions": [
                    "patients:read", "patients:write",
                    "appointments:read", "appointments:write",
                    "billing:read",
                ],
                "is_system_role": True,
            },
            {
                "name": "farmaceutico",
                "display_name": "Farmaceutico",
                "description": "Dispensacion de medicamentos y gestion de inventario",
                "permissions": [
                    "prescriptions:read",
                    "pharmacy:read", "pharmacy:write",
                    "inventory:read", "inventory:write",
                    "patients:read",
                ],
                "is_system_role": True,
            },
            {
                "name": "facturacion",
                "display_name": "Facturacion",
                "description": "Gestion de facturas, cobros y reclamaciones",
                "permissions": [
                    "billing:read", "billing:write",
                    "claims:read", "claims:write",
                    "patients:read",
                ],
                "is_system_role": True,
            },
        ]

        roles = []
        for role_data in default_roles:
            # Verificar si ya existe
            stmt = select(Role).where(Role.name == role_data["name"])
            result = await self.db.execute(stmt)
            existing = result.scalar_one_or_none()

            if not existing:
                role = Role(**role_data)
                self.db.add(role)
                roles.append(role)

        await self.db.flush()
        return roles
