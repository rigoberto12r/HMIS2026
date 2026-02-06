"""
Tests unitarios para el servicio de autenticacion (AuthService).
Valida la logica de negocio de login, tokens y seguridad de cuentas.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.auth.models import Role, User
from app.modules.auth.schemas import LoginRequest, TokenResponse
from app.modules.auth.service import AuthService


# =============================================
# Helpers para crear objetos mock
# =============================================

def _crear_usuario_mock(
    email: str = "doctor@hmis.app",
    password: str = "Segura123!",
    is_active: bool = True,
    failed_attempts: int = 0,
    locked_until: datetime | None = None,
    roles: list[str] | None = None,
) -> User:
    """Crea un objeto User simulado con los atributos necesarios."""
    user = MagicMock(spec=User)
    user.id = uuid.uuid4()
    user.email = email
    user.hashed_password = hash_password(password)
    user.is_active = is_active
    user.failed_login_attempts = failed_attempts
    user.locked_until = locked_until
    user.last_login = None
    user.tenant_id = "tenant_demo"

    # Crear roles mock
    mock_roles = []
    for role_name in (roles or ["medico"]):
        role = MagicMock(spec=Role)
        role.name = role_name
        role.permissions = ["patients:read", "patients:write"]
        mock_roles.append(role)
    user.roles = mock_roles

    return user


def _crear_resultado_mock(user: User | None):
    """Crea un mock del resultado de una query SQLAlchemy."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    return result


# =============================================
# Tests de autenticacion exitosa
# =============================================

class TestAuthServiceAutenticacion:
    """Grupo de tests para el flujo de autenticacion."""

    @pytest.mark.asyncio
    async def test_autenticacion_exitosa_retorna_tokens(self):
        """Verifica que un login correcto retorna access y refresh tokens."""
        # Preparar
        password = "MiPassword123!"
        user = _crear_usuario_mock(
            email="medico@hospital.do",
            password=password,
            roles=["medico"],
        )

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))
        db.flush = AsyncMock()

        service = AuthService(db)
        login = LoginRequest(email="medico@hospital.do", password=password)

        # Ejecutar
        result = await service.authenticate(login)

        # Verificar
        assert result is not None, "La autenticacion exitosa debe retornar tokens"
        assert isinstance(result, TokenResponse), "El resultado debe ser TokenResponse"
        assert result.access_token, "Debe contener un access token"
        assert result.refresh_token, "Debe contener un refresh token"
        assert result.token_type == "bearer", "El tipo de token debe ser 'bearer'"
        assert result.expires_in > 0, "El tiempo de expiracion debe ser positivo"

        # Verificar que se resetearon los intentos fallidos
        assert user.failed_login_attempts == 0, (
            "Los intentos fallidos deben resetearse tras login exitoso"
        )
        assert user.last_login is not None, (
            "Debe registrarse la fecha del ultimo login"
        )

    @pytest.mark.asyncio
    async def test_autenticacion_exitosa_token_contiene_datos_correctos(self):
        """Verifica que el token generado contiene los claims esperados."""
        password = "ClaveSegura456!"
        user = _crear_usuario_mock(
            email="admin@hmis.app",
            password=password,
            roles=["admin"],
        )

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))
        db.flush = AsyncMock()

        service = AuthService(db)
        login = LoginRequest(email="admin@hmis.app", password=password)

        result = await service.authenticate(login)

        # Decodificar y verificar claims
        payload = decode_token(result.access_token)
        assert payload is not None, "El token debe ser decodificable"
        assert payload["sub"] == str(user.id), "El subject debe ser el ID del usuario"
        assert payload["email"] == "admin@hmis.app", "El email debe estar en el token"
        assert payload["tenant_id"] == "tenant_demo", "El tenant debe estar en el token"
        assert "admin" in payload["roles"], "Los roles deben estar en el token"


# =============================================
# Tests de autenticacion fallida
# =============================================

class TestAuthServiceFallosAutenticacion:
    """Grupo de tests para escenarios de autenticacion fallida."""

    @pytest.mark.asyncio
    async def test_contrasena_incorrecta_retorna_none(self):
        """Verifica que una contrasena incorrecta retorna None."""
        user = _crear_usuario_mock(
            email="usuario@hmis.app",
            password="PasswordCorrecta1!",
        )

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))
        db.flush = AsyncMock()

        service = AuthService(db)
        login = LoginRequest(
            email="usuario@hmis.app",
            password="PasswordIncorrecta9!",
        )

        result = await service.authenticate(login)

        assert result is None, (
            "Una contrasena incorrecta debe retornar None"
        )
        assert user.failed_login_attempts == 1, (
            "Debe incrementar el contador de intentos fallidos"
        )

    @pytest.mark.asyncio
    async def test_usuario_inexistente_retorna_none(self):
        """Verifica que un email no registrado retorna None."""
        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(None))

        service = AuthService(db)
        login = LoginRequest(
            email="noexiste@hmis.app",
            password="CualquierClave1!",
        )

        result = await service.authenticate(login)

        assert result is None, (
            "Un usuario inexistente debe retornar None"
        )

    @pytest.mark.asyncio
    async def test_usuario_inactivo_retorna_none(self):
        """Verifica que un usuario desactivado no puede autenticarse."""
        user = _crear_usuario_mock(
            email="inactivo@hmis.app",
            password="MiClave123!",
            is_active=False,
        )

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))

        service = AuthService(db)
        login = LoginRequest(
            email="inactivo@hmis.app",
            password="MiClave123!",
        )

        result = await service.authenticate(login)

        assert result is None, (
            "Un usuario inactivo no debe poder autenticarse"
        )

    @pytest.mark.asyncio
    async def test_cuenta_bloqueada_por_intentos_fallidos_retorna_none(self):
        """
        Verifica que despues de 5 intentos fallidos la cuenta se bloquea
        y no permite autenticacion.
        """
        user = _crear_usuario_mock(
            email="bloqueado@hmis.app",
            password="MiClave123!",
            failed_attempts=5,
            locked_until=datetime.now(timezone.utc) + timedelta(minutes=30),
        )

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))

        service = AuthService(db)
        login = LoginRequest(
            email="bloqueado@hmis.app",
            password="MiClave123!",
        )

        result = await service.authenticate(login)

        assert result is None, (
            "Una cuenta bloqueada por intentos fallidos no debe permitir login"
        )

    @pytest.mark.asyncio
    async def test_cinco_intentos_fallidos_bloquea_cuenta(self):
        """
        Verifica que al llegar a 5 intentos fallidos se establece locked_until.
        """
        user = _crear_usuario_mock(
            email="prebloqueo@hmis.app",
            password="ClaveReal123!",
            failed_attempts=4,  # Ya tiene 4, el siguiente lo bloquea
        )

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))
        db.flush = AsyncMock()

        service = AuthService(db)
        login = LoginRequest(
            email="prebloqueo@hmis.app",
            password="ClaveIncorrecta!",
        )

        result = await service.authenticate(login)

        assert result is None, "No debe autenticar con contrasena incorrecta"
        assert user.failed_login_attempts == 5, (
            "El contador debe llegar a 5 tras el intento fallido"
        )
        assert user.locked_until is not None, (
            "La cuenta debe bloquearse al llegar a 5 intentos fallidos"
        )


# =============================================
# Tests de renovacion de tokens
# =============================================

class TestAuthServiceRefreshTokens:
    """Grupo de tests para la renovacion de tokens JWT."""

    @pytest.mark.asyncio
    async def test_renovacion_exitosa_con_refresh_token_valido(self):
        """Verifica que un refresh token valido genera nuevos tokens."""
        user_id = uuid.uuid4()
        user = _crear_usuario_mock(
            email="refresh@hmis.app",
            password="NoImporta123!",
            roles=["enfermera"],
        )
        user.id = user_id

        # Crear refresh token valido
        refresh_token = create_refresh_token({
            "sub": str(user_id),
            "email": "refresh@hmis.app",
            "tenant_id": "tenant_demo",
            "roles": ["enfermera"],
        })

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))

        service = AuthService(db)

        result = await service.refresh_tokens(refresh_token)

        assert result is not None, (
            "Un refresh token valido debe generar nuevos tokens"
        )
        assert result.access_token != refresh_token, (
            "El nuevo access token debe ser diferente al refresh token"
        )
        assert result.refresh_token, "Debe generar un nuevo refresh token"

    @pytest.mark.asyncio
    async def test_renovacion_falla_con_token_invalido(self):
        """Verifica que un token invalido no permite renovacion."""
        db = AsyncMock(spec=AsyncSession)

        service = AuthService(db)

        result = await service.refresh_tokens("token.completamente.invalido")

        assert result is None, (
            "Un token invalido no debe permitir renovacion"
        )

    @pytest.mark.asyncio
    async def test_renovacion_falla_con_access_token(self):
        """Verifica que un access token no sirve como refresh token."""
        access_token = create_access_token({
            "sub": str(uuid.uuid4()),
            "email": "test@hmis.app",
            "tenant_id": "tenant_demo",
            "roles": ["admin"],
        })

        db = AsyncMock(spec=AsyncSession)
        service = AuthService(db)

        result = await service.refresh_tokens(access_token)

        assert result is None, (
            "Un access token no debe funcionar como refresh token"
        )

    @pytest.mark.asyncio
    async def test_renovacion_falla_si_usuario_inactivo(self):
        """Verifica que no se renuevan tokens si el usuario esta inactivo."""
        user_id = uuid.uuid4()
        user = _crear_usuario_mock(
            email="inactivo@hmis.app",
            password="NoImporta123!",
            is_active=False,
        )
        user.id = user_id

        refresh_token = create_refresh_token({
            "sub": str(user_id),
            "email": "inactivo@hmis.app",
            "tenant_id": "tenant_demo",
            "roles": ["medico"],
        })

        db = AsyncMock(spec=AsyncSession)
        db.execute = AsyncMock(return_value=_crear_resultado_mock(user))

        service = AuthService(db)

        result = await service.refresh_tokens(refresh_token)

        assert result is None, (
            "No se deben renovar tokens de un usuario inactivo"
        )
