"""
Modulo de Facturacion y Seguros.
"""

from .routes import router

# Optional: Stripe payment routes (requires stripe package)
try:
    from .payment_routes import router as payment_router
    __all__ = ["router", "payment_router"]
except ImportError:
    payment_router = None
    __all__ = ["router"]
