"""
RSA key management for SMART on FHIR RS256 JWT signing.

Provides key generation, loading, and JWKS endpoint data.
Internal HS256 auth is unchanged; SMART uses RS256 (asymmetric)
so third-party apps can validate tokens via the public JWKS endpoint.
"""

import base64
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings

_private_key = None
_public_key = None


def generate_rsa_keypair(key_size: int = 2048) -> tuple[bytes, bytes]:
    """Generate RSA key pair. Returns (private_pem, public_pem)."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


def load_private_key():
    """Load or auto-generate RSA private key for SMART JWT signing."""
    global _private_key
    if _private_key:
        return _private_key

    key_path = Path(settings.SMART_RSA_PRIVATE_KEY_PATH)
    if key_path.exists():
        pem_data = key_path.read_bytes()
    else:
        # Auto-generate for development/testing
        private_pem, public_pem = generate_rsa_keypair()
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key_path.write_bytes(private_pem)
        key_path.with_suffix(".pub").write_bytes(public_pem)
        pem_data = private_pem

    _private_key = serialization.load_pem_private_key(pem_data, password=None)
    return _private_key


def load_public_key():
    """Load RSA public key (derived from private key)."""
    global _public_key
    if _public_key:
        return _public_key

    _public_key = load_private_key().public_key()
    return _public_key


def get_private_pem() -> bytes:
    """Get private key as PEM bytes (for jose JWT signing)."""
    key = load_private_key()
    return key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


def get_public_pem() -> bytes:
    """Get public key as PEM bytes (for jose JWT verification)."""
    key = load_public_key()
    return key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


def _int_to_base64url(n: int) -> str:
    """Convert big integer to base64url string (for JWK)."""
    byte_length = (n.bit_length() + 7) // 8
    raw = n.to_bytes(byte_length, byteorder="big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def get_jwks() -> dict:
    """Return JWK Set dict with the RSA public key."""
    public_key = load_public_key()
    numbers = public_key.public_numbers()

    jwk = {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": "smart-key-1",
        "n": _int_to_base64url(numbers.n),
        "e": _int_to_base64url(numbers.e),
    }
    return {"keys": [jwk]}


def reset_keys():
    """Reset cached keys (for testing)."""
    global _private_key, _public_key
    _private_key = None
    _public_key = None
