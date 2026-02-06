"""
Cliente Redis para cache, sesiones y pub/sub de eventos.
"""

import redis.asyncio as redis

from app.core.config import settings

redis_client = redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)


async def get_cache(key: str) -> str | None:
    """Obtiene un valor del cache."""
    return await redis_client.get(key)


async def set_cache(key: str, value: str, expire_seconds: int = 300) -> None:
    """Establece un valor en el cache con expiracion."""
    await redis_client.set(key, value, ex=expire_seconds)


async def delete_cache(key: str) -> None:
    """Elimina un valor del cache."""
    await redis_client.delete(key)


async def invalidate_pattern(pattern: str) -> None:
    """Invalida todas las claves que coincidan con un patron."""
    async for key in redis_client.scan_iter(match=pattern):
        await redis_client.delete(key)
