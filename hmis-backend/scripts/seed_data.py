"""
Script de seeding: carga datos iniciales para desarrollo y demos.
Incluye roles, usuario admin, catalogo de servicios y productos base.

Uso: python -m scripts.seed_data
"""

import asyncio
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.modules.auth.models import Role, User, UserRole
from app.modules.billing.models import ServiceCatalog
from app.modules.pharmacy.models import Product, Warehouse


async def seed_roles(db: AsyncSession) -> dict[str, Role]:
    """Crea roles por defecto."""
    roles_data = [
        {"name": "admin", "display_name": "Administrador", "permissions": ["*"], "is_system_role": True},
        {"name": "medico", "display_name": "Medico", "permissions": [
            "patients:read", "patients:write", "encounters:read", "encounters:write",
            "prescriptions:read", "prescriptions:write", "orders:read", "orders:write",
            "appointments:read", "vitals:read", "vitals:write",
        ], "is_system_role": True},
        {"name": "enfermera", "display_name": "Enfermera", "permissions": [
            "patients:read", "encounters:read", "vitals:read", "vitals:write",
            "medications:administer", "appointments:read",
        ], "is_system_role": True},
        {"name": "recepcion", "display_name": "Recepcion", "permissions": [
            "patients:read", "patients:write", "appointments:read", "appointments:write",
            "providers:read", "schedules:read", "billing:read",
        ], "is_system_role": True},
        {"name": "farmaceutico", "display_name": "Farmaceutico", "permissions": [
            "prescriptions:read", "pharmacy:read", "pharmacy:write",
            "inventory:read", "inventory:write", "patients:read",
        ], "is_system_role": True},
        {"name": "facturacion", "display_name": "Facturacion", "permissions": [
            "billing:read", "billing:write", "claims:read", "claims:write", "patients:read",
        ], "is_system_role": True},
    ]

    roles = {}
    for data in roles_data:
        role = Role(**data)
        db.add(role)
        roles[data["name"]] = role

    await db.flush()
    print(f"  ✓ {len(roles)} roles creados")
    return roles


async def seed_admin_user(db: AsyncSession, admin_role: Role) -> User:
    """Crea usuario administrador por defecto."""
    admin = User(
        email="admin@hmis.app",
        hashed_password=hash_password("Admin2026!"),
        first_name="Administrador",
        last_name="HMIS",
        is_verified=True,
        is_superuser=True,
        tenant_id="tenant_demo",
        language="es",
        timezone="America/Santo_Domingo",
    )
    db.add(admin)
    await db.flush()

    user_role = UserRole(user_id=admin.id, role_id=admin_role.id)
    db.add(user_role)
    await db.flush()

    print(f"  ✓ Usuario admin creado: admin@hmis.app / Admin2026!")
    return admin


async def seed_demo_users(db: AsyncSession, roles: dict[str, Role]) -> None:
    """Crea usuarios de demo para cada rol."""
    demo_users = [
        {"email": "dr.martinez@hmis.app", "first_name": "Carlos", "last_name": "Martinez",
         "role": "medico", "specialty": "Medicina General", "license": "MED-001"},
        {"email": "enf.rodriguez@hmis.app", "first_name": "Ana", "last_name": "Rodriguez",
         "role": "enfermera"},
        {"email": "recepcion@hmis.app", "first_name": "Laura", "last_name": "Gomez",
         "role": "recepcion"},
        {"email": "farmacia@hmis.app", "first_name": "Pedro", "last_name": "Sanchez",
         "role": "farmaceutico"},
        {"email": "facturacion@hmis.app", "first_name": "Maria", "last_name": "Lopez",
         "role": "facturacion"},
    ]

    for data in demo_users:
        role_name = data.pop("role")
        specialty = data.pop("specialty", None)
        license_num = data.pop("license", None)

        user = User(
            **data,
            hashed_password=hash_password("Demo2026!"),
            is_verified=True,
            tenant_id="tenant_demo",
            specialty=specialty,
            license_number=license_num,
            language="es",
            timezone="America/Santo_Domingo",
        )
        db.add(user)
        await db.flush()

        user_role = UserRole(user_id=user.id, role_id=roles[role_name].id)
        db.add(user_role)

    await db.flush()
    print(f"  ✓ {len(demo_users)} usuarios de demo creados")


async def seed_service_catalog(db: AsyncSession) -> None:
    """Crea catalogo basico de servicios medicos."""
    services = [
        {"code": "CON-001", "name": "Consulta general", "category": "consulta", "base_price": 1500.00, "tax_rate": 0.0},
        {"code": "CON-002", "name": "Consulta especializada", "category": "consulta", "base_price": 2500.00, "tax_rate": 0.0},
        {"code": "CON-003", "name": "Consulta de emergencia", "category": "consulta", "base_price": 3500.00, "tax_rate": 0.0},
        {"code": "LAB-001", "name": "Hemograma completo (CBC)", "category": "laboratorio", "base_price": 800.00, "tax_rate": 0.0},
        {"code": "LAB-002", "name": "Quimica sanguinea", "category": "laboratorio", "base_price": 1200.00, "tax_rate": 0.0},
        {"code": "LAB-003", "name": "Perfil lipidico", "category": "laboratorio", "base_price": 1000.00, "tax_rate": 0.0},
        {"code": "LAB-004", "name": "Glicemia en ayunas", "category": "laboratorio", "base_price": 400.00, "tax_rate": 0.0},
        {"code": "LAB-005", "name": "Urinalisis", "category": "laboratorio", "base_price": 500.00, "tax_rate": 0.0},
        {"code": "IMG-001", "name": "Radiografia de torax", "category": "imagen", "base_price": 1500.00, "tax_rate": 0.18},
        {"code": "IMG-002", "name": "Ultrasonido abdominal", "category": "imagen", "base_price": 2500.00, "tax_rate": 0.18},
        {"code": "IMG-003", "name": "Tomografia (CT) simple", "category": "imagen", "base_price": 8000.00, "tax_rate": 0.18},
        {"code": "PRO-001", "name": "Curacion de herida", "category": "procedimiento", "base_price": 800.00, "tax_rate": 0.0},
        {"code": "PRO-002", "name": "Sutura", "category": "procedimiento", "base_price": 2000.00, "tax_rate": 0.0},
        {"code": "PRO-003", "name": "Nebulizacion", "category": "procedimiento", "base_price": 600.00, "tax_rate": 0.0},
    ]

    for s in services:
        db.add(ServiceCatalog(**s, currency="DOP"))
    await db.flush()
    print(f"  ✓ {len(services)} servicios en catalogo")


async def seed_pharmacy_products(db: AsyncSession) -> None:
    """Crea catalogo basico de productos farmaceuticos."""
    products = [
        {"name": "Acetaminofen 500mg", "generic_name": "Paracetamol", "active_ingredient": "Paracetamol",
         "presentation": "Tableta", "concentration": "500mg", "product_type": "medication",
         "atc_code": "N02BE01", "controlled_substance_level": 0},
        {"name": "Ibuprofeno 400mg", "generic_name": "Ibuprofeno", "active_ingredient": "Ibuprofeno",
         "presentation": "Tableta", "concentration": "400mg", "product_type": "medication",
         "atc_code": "M01AE01", "controlled_substance_level": 0},
        {"name": "Amoxicilina 500mg", "generic_name": "Amoxicilina", "active_ingredient": "Amoxicilina",
         "presentation": "Capsula", "concentration": "500mg", "product_type": "medication",
         "atc_code": "J01CA04", "controlled_substance_level": 0},
        {"name": "Omeprazol 20mg", "generic_name": "Omeprazol", "active_ingredient": "Omeprazol",
         "presentation": "Capsula", "concentration": "20mg", "product_type": "medication",
         "atc_code": "A02BC01", "controlled_substance_level": 0},
        {"name": "Metformina 850mg", "generic_name": "Metformina", "active_ingredient": "Metformina HCl",
         "presentation": "Tableta", "concentration": "850mg", "product_type": "medication",
         "atc_code": "A10BA02", "controlled_substance_level": 0},
        {"name": "Losartan 50mg", "generic_name": "Losartan", "active_ingredient": "Losartan Potasico",
         "presentation": "Tableta", "concentration": "50mg", "product_type": "medication",
         "atc_code": "C09CA01", "controlled_substance_level": 0},
        {"name": "Tramadol 50mg", "generic_name": "Tramadol", "active_ingredient": "Tramadol HCl",
         "presentation": "Capsula", "concentration": "50mg", "product_type": "medication",
         "atc_code": "N02AX02", "controlled_substance_level": 2},
        {"name": "Solucion Salina 0.9% 500ml", "generic_name": "Cloruro de Sodio",
         "presentation": "Solucion IV", "concentration": "0.9%", "product_type": "supply",
         "controlled_substance_level": 0, "requires_prescription": False},
        {"name": "Jeringa 5ml", "presentation": "Unidad", "product_type": "supply",
         "controlled_substance_level": 0, "requires_prescription": False},
        {"name": "Guantes de latex (caja x100)", "presentation": "Caja", "product_type": "supply",
         "controlled_substance_level": 0, "requires_prescription": False},
    ]

    for p in products:
        db.add(Product(**p, unit_of_measure="unidad"))
    await db.flush()
    print(f"  ✓ {len(products)} productos farmaceuticos")


async def seed_warehouses(db: AsyncSession) -> None:
    """Crea almacenes de ejemplo."""
    warehouses = [
        {"name": "Farmacia Central", "warehouse_type": "central", "location_description": "Planta baja, area de farmacia"},
        {"name": "Farmacia Emergencias", "warehouse_type": "satellite", "location_description": "Area de emergencias"},
        {"name": "Stock de Piso 2do", "warehouse_type": "floor_stock", "location_description": "Segundo piso, estacion de enfermeria"},
    ]

    for w in warehouses:
        db.add(Warehouse(**w))
    await db.flush()
    print(f"  ✓ {len(warehouses)} almacenes creados")


async def main():
    """Ejecuta el seeding completo."""
    print("\n🏥 HMIS SaaS - Seeding de datos iniciales\n")
    print("=" * 50)

    # Crear tablas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("  ✓ Tablas creadas")

    # Seed datos
    async with AsyncSessionLocal() as db:
        try:
            print("\n📋 Creando roles...")
            roles = await seed_roles(db)

            print("\n👤 Creando usuarios...")
            await seed_admin_user(db, roles["admin"])
            await seed_demo_users(db, roles)

            print("\n💰 Creando catalogo de servicios...")
            await seed_service_catalog(db)

            print("\n💊 Creando productos farmaceuticos...")
            await seed_pharmacy_products(db)

            print("\n🏪 Creando almacenes...")
            await seed_warehouses(db)

            await db.commit()
            print("\n" + "=" * 50)
            print("✅ Seeding completado exitosamente!\n")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error durante seeding: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
