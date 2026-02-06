"""
Schemas Pydantic para autenticacion y autorizacion.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# =============================================
# Autenticacion
# =============================================

class LoginRequest(BaseModel):
    """Solicitud de inicio de sesion."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    mfa_code: str | None = None


class TokenResponse(BaseModel):
    """Respuesta con tokens JWT."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class RefreshTokenRequest(BaseModel):
    """Solicitud de renovacion de token."""
    refresh_token: str


# =============================================
# Usuarios
# =============================================

class UserCreate(BaseModel):
    """Creacion de nuevo usuario."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    license_number: str | None = None
    specialty: str | None = None
    department: str | None = None
    role_ids: list[uuid.UUID] = []
    language: str = "es"
    timezone: str = "America/Santo_Domingo"


class UserUpdate(BaseModel):
    """Actualizacion de usuario."""
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    specialty: str | None = None
    department: str | None = None
    language: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    """Respuesta de usuario."""
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None = None
    license_number: str | None = None
    specialty: str | None = None
    department: str | None = None
    is_active: bool
    is_verified: bool
    mfa_enabled: bool
    language: str
    timezone: str
    roles: list["RoleResponse"] = []
    last_login: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    """Solicitud de cambio de contrasena."""
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# =============================================
# Roles y Permisos
# =============================================

class RoleCreate(BaseModel):
    """Creacion de rol."""
    name: str = Field(max_length=100)
    display_name: str = Field(max_length=200)
    description: str | None = None
    permissions: list[str] = []


class RoleResponse(BaseModel):
    """Respuesta de rol."""
    id: uuid.UUID
    name: str
    display_name: str
    description: str | None = None
    permissions: list
    is_system_role: bool

    model_config = {"from_attributes": True}
