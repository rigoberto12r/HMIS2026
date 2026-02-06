"""
Modulo de seguridad: generacion/validacion de JWT, hashing de contrasenas,
y utilidades de encriptacion para datos sensibles.
"""

from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import settings

# Hasher de contrasenas con Argon2 (resistente a ataques GPU)
ph = PasswordHasher()


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Genera un token JWT de acceso."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Genera un token JWT de refresco con mayor duracion."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decodifica y valida un token JWT. Retorna None si es invalido."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None


def hash_password(password: str) -> str:
    """Genera hash Argon2 de una contrasena."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contrasena contra su hash Argon2."""
    try:
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
