"""
Tests unitarios para schemas Pydantic (validacion de datos de entrada).
"""

import uuid

import pytest
from pydantic import ValidationError

from app.modules.auth.schemas import (
    LoginRequest,
    UserCreate,
    UserUpdate,
    ChangePasswordRequest,
    RoleCreate,
)
from app.shared.schemas import PaginationParams, PaginatedResponse


class TestLoginRequest:
    """Tests para el schema de login."""

    def test_valid_login(self):
        login = LoginRequest(email="admin@hmis.app", password="Admin2026!")
        assert login.email == "admin@hmis.app"
        assert login.password == "Admin2026!"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password="Admin2026!")

    def test_password_too_short(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="admin@hmis.app", password="short")

    def test_password_too_long(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="admin@hmis.app", password="x" * 129)


class TestUserCreate:
    """Tests para el schema de creacion de usuario."""

    def test_valid_user(self):
        user = UserCreate(
            email="nuevo@hmis.app",
            password="NuevoUser2026!",
            first_name="Juan",
            last_name="Perez",
        )
        assert user.email == "nuevo@hmis.app"
        assert user.language == "es"
        assert user.timezone == "America/Santo_Domingo"
        assert user.role_ids == []

    def test_with_roles(self):
        role_id = uuid.uuid4()
        user = UserCreate(
            email="nuevo@hmis.app",
            password="NuevoUser2026!",
            first_name="Juan",
            last_name="Perez",
            role_ids=[role_id],
        )
        assert len(user.role_ids) == 1

    def test_missing_required_fields(self):
        with pytest.raises(ValidationError):
            UserCreate(email="nuevo@hmis.app", password="NuevoUser2026!")


class TestUserUpdate:
    """Tests para el schema de actualizacion de usuario."""

    def test_partial_update(self):
        update = UserUpdate(first_name="Juan Carlos")
        data = update.model_dump(exclude_unset=True)
        assert data == {"first_name": "Juan Carlos"}

    def test_empty_update(self):
        update = UserUpdate()
        data = update.model_dump(exclude_unset=True)
        assert data == {}


class TestChangePasswordRequest:
    """Tests para el schema de cambio de contrasena."""

    def test_valid_change(self):
        req = ChangePasswordRequest(
            current_password="OldPass2026!",
            new_password="NewPass2026!",
        )
        assert req.new_password == "NewPass2026!"

    def test_new_password_too_short(self):
        with pytest.raises(ValidationError):
            ChangePasswordRequest(
                current_password="OldPass2026!",
                new_password="short",
            )


class TestPaginationParams:
    """Tests para parametros de paginacion."""

    def test_defaults(self):
        params = PaginationParams()
        assert params.page == 1
        assert params.page_size == 20
        assert params.offset == 0

    def test_offset_calculation(self):
        params = PaginationParams(page=3, page_size=10)
        assert params.offset == 20

    def test_page_must_be_positive(self):
        with pytest.raises(ValidationError):
            PaginationParams(page=0)

    def test_page_size_max_100(self):
        with pytest.raises(ValidationError):
            PaginationParams(page_size=101)


class TestPaginatedResponse:
    """Tests para la respuesta paginada generica."""

    def test_create(self):
        resp = PaginatedResponse.create(
            items=["a", "b", "c"],
            total=25,
            page=2,
            page_size=10,
        )
        assert resp.items == ["a", "b", "c"]
        assert resp.total == 25
        assert resp.page == 2
        assert resp.total_pages == 3

    def test_total_pages_rounding(self):
        resp = PaginatedResponse.create(
            items=[],
            total=21,
            page=1,
            page_size=10,
        )
        assert resp.total_pages == 3

    def test_empty_results(self):
        resp = PaginatedResponse.create(
            items=[],
            total=0,
            page=1,
            page_size=20,
        )
        assert resp.total_pages == 0
