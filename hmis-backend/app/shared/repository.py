"""
Generic Repository pattern for data access abstraction.

Provides reusable query methods that eliminate SQLAlchemy boilerplate
and make services more testable by isolating database logic.
"""

from typing import Generic, TypeVar, Type, Any, Sequence
from uuid import UUID

from sqlalchemy import select, func, Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.shared.base_models import BaseEntity

T = TypeVar("T", bound=BaseEntity)


class BaseRepository(Generic[T]):
    """Base repository with common CRUD operations for any entity."""

    def __init__(self, model: Type[T], db: AsyncSession):
        self.model = model
        self.db = db

    async def get(self, id: UUID, *, include_deleted: bool = False) -> T | None:
        """
        Get entity by ID.

        Args:
            id: The entity UUID
            include_deleted: Whether to include soft-deleted entities (default: False)

        Returns:
            Entity or None if not found
        """
        stmt = select(self.model).where(self.model.id == id)
        if not include_deleted:
            stmt = stmt.where(self.model.is_active == True)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by(
        self,
        *,
        include_deleted: bool = False,
        limit: int | None = None,
        offset: int = 0,
        order_by: Any = None,
        **filters,
    ) -> Sequence[T]:
        """
        Find entities matching filters.

        Args:
            include_deleted: Whether to include soft-deleted entities
            limit: Maximum number of results
            offset: Number of results to skip
            order_by: SQLAlchemy order_by expression
            **filters: Column filters (e.g., status="active", patient_id=uuid)

        Returns:
            List of matching entities
        """
        stmt = self._build_query(include_deleted=include_deleted, **filters)

        if order_by is not None:
            stmt = stmt.order_by(order_by)

        if offset:
            stmt = stmt.offset(offset)
        if limit:
            stmt = stmt.limit(limit)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_one_by(self, *, include_deleted: bool = False, **filters) -> T | None:
        """
        Find single entity matching filters.

        Args:
            include_deleted: Whether to include soft-deleted entities
            **filters: Column filters

        Returns:
            Entity or None if not found
        """
        results = await self.find_by(include_deleted=include_deleted, limit=1, **filters)
        return results[0] if results else None

    async def count(self, *, include_deleted: bool = False, **filters) -> int:
        """
        Count entities matching filters.

        Args:
            include_deleted: Whether to include soft-deleted entities
            **filters: Column filters

        Returns:
            Count of matching entities
        """
        stmt = self._build_query(include_deleted=include_deleted, **filters)
        stmt = select(func.count()).select_from(stmt.subquery())
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def create(self, entity: T) -> T:
        """
        Persist a new entity.

        Args:
            entity: The entity instance to create

        Returns:
            The created entity with populated ID
        """
        self.db.add(entity)
        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def update(self, entity: T) -> T:
        """
        Update an existing entity.

        Args:
            entity: The entity instance to update

        Returns:
            The updated entity
        """
        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def soft_delete(self, entity: T) -> T:
        """
        Soft delete an entity (set is_active=False, deleted_at=now).

        Args:
            entity: The entity to soft delete

        Returns:
            The soft-deleted entity
        """
        from datetime import datetime, timezone
        entity.is_active = False
        entity.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
        return entity

    async def hard_delete(self, entity: T) -> None:
        """
        Permanently delete an entity from database.

        Args:
            entity: The entity to delete

        WARNING: This permanently removes data. Use soft_delete in most cases.
        """
        await self.db.delete(entity)
        await self.db.flush()

    def _build_query(self, *, include_deleted: bool = False, **filters) -> Select:
        """
        Build base SELECT query with filters.

        Args:
            include_deleted: Whether to include soft-deleted entities
            **filters: Column filters

        Returns:
            SQLAlchemy Select statement
        """
        stmt = select(self.model)

        if not include_deleted:
            stmt = stmt.where(self.model.is_active == True)

        for key, value in filters.items():
            if value is not None:
                stmt = stmt.where(getattr(self.model, key) == value)

        return stmt
