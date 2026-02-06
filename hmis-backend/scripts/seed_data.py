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


async def seed_icd10_catalog(db: AsyncSession) -> None:
    """Crea catalogo de codigos ICD-10 mas comunes en Latinoamerica."""
    from app.modules.patients.models import Patient

    # Top 50 diagnosticos frecuentes en atencion primaria LatAm
    icd10_codes = [
        # Enfermedades infecciosas
        ("A09", "Diarrea y gastroenteritis de presunto origen infeccioso"),
        ("B34.9", "Infeccion viral, no especificada"),
        # Neoplasias
        ("C50.9", "Tumor maligno de la mama, no especificado"),
        ("D25.9", "Leiomioma del utero, no especificado"),
        # Enfermedades de la sangre
        ("D50.9", "Anemia por deficiencia de hierro, no especificada"),
        # Enfermedades endocrinas
        ("E11.9", "Diabetes mellitus tipo 2, sin complicaciones"),
        ("E03.9", "Hipotiroidismo, no especificado"),
        ("E78.5", "Hiperlipidemia, no especificada"),
        ("E66.9", "Obesidad, no especificada"),
        # Trastornos mentales
        ("F32.9", "Episodio depresivo, no especificado"),
        ("F41.1", "Trastorno de ansiedad generalizada"),
        # Sistema nervioso
        ("G43.9", "Migrana, no especificada"),
        # Ojo y anexos
        ("H10.9", "Conjuntivitis, no especificada"),
        # Oido
        ("H66.9", "Otitis media, no especificada"),
        # Sistema circulatorio
        ("I10", "Hipertension esencial (primaria)"),
        ("I25.9", "Cardiopatia isquemica cronica, no especificada"),
        ("I63.9", "Infarto cerebral, no especificado"),
        ("I83.9", "Varices de miembros inferiores sin ulcera ni inflamacion"),
        # Sistema respiratorio
        ("J00", "Rinofaringitis aguda (resfriado comun)"),
        ("J02.9", "Faringitis aguda, no especificada"),
        ("J06.9", "Infeccion aguda de vias respiratorias superiores, no especificada"),
        ("J18.9", "Neumonia, no especificada"),
        ("J20.9", "Bronquitis aguda, no especificada"),
        ("J30.1", "Rinitis alergica debida a polen"),
        ("J45.9", "Asma, no especificado"),
        # Sistema digestivo
        ("K21.0", "Enfermedad por reflujo gastroesofagico con esofagitis"),
        ("K29.7", "Gastritis, no especificada"),
        ("K30", "Dispepsia funcional"),
        ("K35.8", "Apendicitis aguda, otra y la no especificada"),
        ("K59.0", "Constipacion"),
        ("K76.0", "Higado graso, no clasificado en otra parte"),
        # Piel
        ("L30.9", "Dermatitis, no especificada"),
        ("L50.9", "Urticaria, no especificada"),
        # Sistema musculoesqueletico
        ("M54.5", "Lumbago no especificado"),
        ("M79.3", "Paniculitis, no especificada"),
        # Sistema genitourinario
        ("N39.0", "Infeccion de vias urinarias, sitio no especificado"),
        ("N76.0", "Vaginitis aguda"),
        # Embarazo
        ("O80", "Parto unico espontaneo"),
        ("O26.9", "Afeccion relacionada con el embarazo, no especificada"),
        # Periodo perinatal
        ("P07.3", "Otros recien nacidos pretermino"),
        # Malformaciones congenitas
        ("Q66.0", "Pie equinovaro"),
        # Sintomas y signos
        ("R10.4", "Otros dolores abdominales y los no especificados"),
        ("R50.9", "Fiebre, no especificada"),
        ("R51", "Cefalea"),
        # Traumatismos
        ("S62.6", "Fractura de otros dedos de la mano"),
        ("S93.4", "Esguince de tobillo"),
        ("T78.4", "Alergia no especificada"),
        # Factores de salud
        ("Z00.0", "Examen medico general"),
        ("Z12.3", "Pesquisa especial para tumor de mama"),
        ("Z23", "Necesidad de vacunacion contra enfermedades bacterianas unicas"),
        ("Z30.0", "Consejo y asesoramiento general sobre la anticoncepcion"),
    ]

    # Insertar via SQL directo para usar la tabla de diagnosticos como catalogo
    for code, description in icd10_codes:
        await db.execute(
            text(
                "INSERT INTO icd10_catalog (id, code, description) "
                "VALUES (:id, :code, :description) ON CONFLICT DO NOTHING"
            ),
            {"id": uuid.uuid4(), "code": code, "description": description},
        )
    await db.flush()
    print(f"  ✓ {len(icd10_codes)} codigos ICD-10 en catalogo")


async def seed_sample_patients(db: AsyncSession) -> None:
    """Crea pacientes de ejemplo para demos."""
    from app.modules.patients.models import Patient

    patients = [
        {
            "mrn": "HMIS-00000001", "document_type": "cedula", "document_number": "00112345678",
            "first_name": "Juan", "last_name": "Perez", "second_last_name": "Garcia",
            "birth_date": date(1985, 3, 15), "gender": "M", "blood_type": "O+",
            "phone": "809-555-0100", "email": "juan.perez@email.com",
            "address_line1": "Calle Principal #123", "city": "Santo Domingo",
            "state_province": "Distrito Nacional", "country": "DO", "status": "active",
        },
        {
            "mrn": "HMIS-00000002", "document_type": "cedula", "document_number": "00298765432",
            "first_name": "Maria", "last_name": "Rodriguez", "second_last_name": "Santos",
            "birth_date": date(1990, 7, 22), "gender": "F", "blood_type": "A+",
            "phone": "809-555-0200", "email": "maria.rodriguez@email.com",
            "address_line1": "Av. 27 de Febrero #456", "city": "Santiago",
            "state_province": "Santiago", "country": "DO", "status": "active",
        },
        {
            "mrn": "HMIS-00000003", "document_type": "cedula", "document_number": "00387654321",
            "first_name": "Carlos", "last_name": "Martinez", "second_last_name": "Diaz",
            "birth_date": date(1978, 11, 5), "gender": "M", "blood_type": "B+",
            "phone": "809-555-0300", "email": "carlos.martinez@email.com",
            "address_line1": "Calle El Conde #789", "city": "Santo Domingo",
            "state_province": "Distrito Nacional", "country": "DO", "status": "active",
        },
        {
            "mrn": "HMIS-00000004", "document_type": "pasaporte", "document_number": "PE12345678",
            "first_name": "Ana", "last_name": "Gutierrez", "second_last_name": "Lopez",
            "birth_date": date(1995, 2, 14), "gender": "F", "blood_type": "AB+",
            "phone": "829-555-0400", "email": "ana.gutierrez@email.com",
            "address_line1": "Residencial Los Pinos, Apt 5B", "city": "Punta Cana",
            "state_province": "La Altagracia", "country": "DO", "status": "active",
        },
        {
            "mrn": "HMIS-00000005", "document_type": "cedula", "document_number": "00456789012",
            "first_name": "Pedro", "last_name": "Hernandez", "second_last_name": "Reyes",
            "birth_date": date(1962, 9, 30), "gender": "M", "blood_type": "O-",
            "phone": "809-555-0500", "email": "pedro.hernandez@email.com",
            "address_line1": "Calle Duarte #321", "city": "La Vega",
            "state_province": "La Vega", "country": "DO", "status": "active",
        },
    ]

    for p in patients:
        db.add(Patient(**p))
    await db.flush()
    print(f"  ✓ {len(patients)} pacientes de ejemplo creados")


async def _create_icd10_table(db: AsyncSession) -> None:
    """Crea tabla de catalogo ICD-10 si no existe."""
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS icd10_catalog (
            id UUID PRIMARY KEY,
            code VARCHAR(10) NOT NULL UNIQUE,
            description VARCHAR(500) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.flush()


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

            print("\n🏥 Creando pacientes de ejemplo...")
            await seed_sample_patients(db)

            print("\n💰 Creando catalogo de servicios...")
            await seed_service_catalog(db)

            print("\n💊 Creando productos farmaceuticos...")
            await seed_pharmacy_products(db)

            print("\n🏪 Creando almacenes...")
            await seed_warehouses(db)

            print("\n📖 Creando catalogo ICD-10...")
            await _create_icd10_table(db)
            await seed_icd10_catalog(db)

            await db.commit()
            print("\n" + "=" * 50)
            print("✅ Seeding completado exitosamente!")
            print("\n  Credenciales de acceso:")
            print("  Admin:  admin@hmis.app / Admin2026!")
            print("  Demo:   dr.martinez@hmis.app / Demo2026!")
            print()

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error durante seeding: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
