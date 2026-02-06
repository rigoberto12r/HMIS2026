"""
Tests unitarios para el modulo de seguridad.
"""

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password():
    """Verifica que el hashing y verificacion de contrasenas funciona."""
    password = "MiContrasenaSegura123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("otraContrasena", hashed) is False


def test_create_and_decode_access_token():
    """Verifica creacion y decodificacion de tokens de acceso."""
    data = {"sub": "user-123", "email": "test@hmis.app", "roles": ["admin"]}
    token = create_access_token(data)

    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["email"] == "test@hmis.app"
    assert payload["type"] == "access"


def test_create_and_decode_refresh_token():
    """Verifica creacion y decodificacion de tokens de refresco."""
    data = {"sub": "user-456"}
    token = create_refresh_token(data)

    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


def test_decode_invalid_token():
    """Verifica que un token invalido retorna None."""
    result = decode_token("token.invalido.aqui")
    assert result is None
