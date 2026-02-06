"""Initial schema - all MVP tables.

Revision ID: 001_initial
Revises:
Create Date: 2026-02-06

Crea todas las tablas del MVP:
- Auth: roles, users, user_roles, audit_logs
- Patients: patients, patient_insurances
- Appointments: providers, locations, schedule_templates, schedule_blocks, appointments, waiting_list
- EMR: encounters, clinical_notes, diagnoses, vital_signs, allergies, medical_orders,
       clinical_templates, patient_problem_list
- Billing: service_catalog, charge_items, invoices, invoice_lines, payments,
           insurance_claims, fiscal_configs, insurer_contracts
- Pharmacy: products, product_lots, warehouses, stock_levels, prescriptions,
            dispensations, purchase_orders, stock_movements, controlled_substance_logs
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Sistema (tabla maestra de tenants) ─────────────────

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("schema_name", sa.String(63), unique=True, nullable=False),
        sa.Column("hospital_name", sa.String(200), nullable=False),
        sa.Column("country", sa.String(2), server_default="DO"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "icd10_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(10), unique=True, nullable=False, index=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Auth ──────────────────────────────────────────────

    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("permissions", postgresql.JSONB, server_default="[]"),
        sa.Column("is_system_role", sa.Boolean, server_default="false"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # Credentials
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("hashed_password", sa.String(500), nullable=False),
        # Personal
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        # Professional
        sa.Column("license_number", sa.String(50), nullable=True),
        sa.Column("specialty", sa.String(100), nullable=True),
        sa.Column("department", sa.String(100), nullable=True),
        # Security
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("is_superuser", sa.Boolean, server_default="false"),
        sa.Column("mfa_enabled", sa.Boolean, server_default="false"),
        sa.Column("mfa_secret", sa.String(200), nullable=True),
        # Tenant
        sa.Column("tenant_id", sa.String(100), nullable=True, index=True),
        # Login tracking
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_login_attempts", sa.Integer, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        # Preferences
        sa.Column("language", sa.String(5), server_default="'es'"),
        sa.Column("timezone", sa.String(50), server_default="'America/Santo_Domingo'"),
        # BaseEntity mixins
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tenant_id", sa.String(100), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
    )

    # ── Patients ──────────────────────────────────────────

    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_type", sa.String(20), nullable=False),
        sa.Column("document_number", sa.String(30), nullable=False, index=True),
        sa.Column("mrn", sa.String(20), unique=True, nullable=False, index=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("second_last_name", sa.String(100), nullable=True),
        sa.Column("birth_date", sa.Date, nullable=False),
        sa.Column("gender", sa.String(20), nullable=False),
        sa.Column("blood_type", sa.String(5), nullable=True),
        sa.Column("marital_status", sa.String(20), nullable=True),
        sa.Column("nationality", sa.String(50), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("mobile_phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address_line1", sa.String(255), nullable=True),
        sa.Column("address_line2", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state_province", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column("country", sa.String(2), server_default="'DO'"),
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(20), nullable=True),
        sa.Column("emergency_contact_relationship", sa.String(50), nullable=True),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), server_default="'active'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_patients_document", "patients", ["document_type", "document_number"])
    op.create_index("ix_patients_name", "patients", ["first_name", "last_name"])

    op.create_table(
        "patient_insurances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("insurer_name", sa.String(200), nullable=False),
        sa.Column("insurer_code", sa.String(50), nullable=True),
        sa.Column("policy_number", sa.String(50), nullable=False),
        sa.Column("plan_type", sa.String(100), nullable=True),
        sa.Column("group_number", sa.String(50), nullable=True),
        sa.Column("coverage_start", sa.Date, nullable=False),
        sa.Column("coverage_end", sa.Date, nullable=True),
        sa.Column("copay_percentage", sa.Float, server_default="0.0"),
        sa.Column("is_primary", sa.Boolean, server_default="true"),
        sa.Column("status", sa.String(20), server_default="'active'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Appointments ──────────────────────────────────────

    op.create_table(
        "providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("specialty_code", sa.String(20), nullable=True),
        sa.Column("specialty_name", sa.String(100), nullable=True),
        sa.Column("license_number", sa.String(50), nullable=False),
        sa.Column("consultation_duration_min", sa.Integer, server_default="30"),
        sa.Column("max_daily_appointments", sa.Integer, server_default="20"),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), server_default="'active'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("location_type", sa.String(50), server_default="'consultorio'"),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("floor", sa.String(10), nullable=True),
        sa.Column("room", sa.String(20), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), server_default="'active'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "schedule_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("day_of_week", sa.SmallInteger, nullable=False),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("slot_duration_min", sa.Integer, server_default="30"),
        sa.Column("max_overbooking", sa.Integer, server_default="0"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "schedule_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("start_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("recurrence_rule", sa.String(200), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("providers.id"), nullable=False, index=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("appointment_type", sa.String(50), server_default="'consulta'"),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), server_default="'scheduled'", index=True),
        sa.Column("cancellation_reason", sa.String(500), nullable=True),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("source", sa.String(20), server_default="'web'"),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_appointments_date_provider", "appointments", ["scheduled_start", "provider_id"])
    op.create_index("ix_appointments_patient_date", "appointments", ["patient_id", "scheduled_start"])

    op.create_table(
        "waiting_list",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("providers.id"), nullable=True),
        sa.Column("specialty_code", sa.String(20), nullable=True),
        sa.Column("preferred_dates", postgresql.JSONB, nullable=True),
        sa.Column("priority", sa.SmallInteger, server_default="5"),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), server_default="'waiting'"),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── EMR ───────────────────────────────────────────────

    op.create_table(
        "encounters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("encounter_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), server_default="'in_progress'"),
        sa.Column("start_datetime", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("end_datetime", sa.DateTime(timezone=True), nullable=True),
        sa.Column("chief_complaint", sa.Text, nullable=True),
        sa.Column("disposition", sa.String(50), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_encounters_patient_date", "encounters", ["patient_id", "start_datetime"])

    op.create_table(
        "clinical_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("note_type", sa.String(30), nullable=False),
        sa.Column("content_json", postgresql.JSONB, server_default="'{}'", nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_signed", sa.Boolean, server_default="false"),
        sa.Column("amendment_of", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amendment_reason", sa.Text, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "diagnoses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("icd10_code", sa.String(10), nullable=False, index=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("diagnosis_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="'active'"),
        sa.Column("onset_date", sa.Date, nullable=True),
        sa.Column("resolved_date", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "vital_signs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("measured_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("measured_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("temperature", sa.Float, nullable=True),
        sa.Column("heart_rate", sa.Integer, nullable=True),
        sa.Column("blood_pressure_sys", sa.Integer, nullable=True),
        sa.Column("blood_pressure_dia", sa.Integer, nullable=True),
        sa.Column("respiratory_rate", sa.Integer, nullable=True),
        sa.Column("oxygen_saturation", sa.Float, nullable=True),
        sa.Column("weight", sa.Float, nullable=True),
        sa.Column("height", sa.Float, nullable=True),
        sa.Column("bmi", sa.Float, nullable=True),
        sa.Column("pain_scale", sa.SmallInteger, nullable=True),
        sa.Column("glucose", sa.Float, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "allergies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("allergen", sa.String(200), nullable=False),
        sa.Column("allergen_type", sa.String(30), nullable=False),
        sa.Column("reaction", sa.String(500), nullable=True),
        sa.Column("severity", sa.String(20), server_default="'moderate'"),
        sa.Column("status", sa.String(20), server_default="'active'"),
        sa.Column("reported_date", sa.Date, nullable=True),
        sa.Column("verified_by", postgresql.UUID(as_uuid=True), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "medical_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("ordered_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_type", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(20), server_default="'routine'"),
        sa.Column("details_json", postgresql.JSONB, server_default="'{}'", nullable=False),
        sa.Column("clinical_indication", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="'pending'"),
        sa.Column("result_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("result_summary", sa.Text, nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "clinical_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("specialty_code", sa.String(20), nullable=True),
        sa.Column("template_type", sa.String(30), nullable=False),
        sa.Column("version", sa.Integer, server_default="1"),
        sa.Column("schema_json", postgresql.JSONB, server_default="'{}'", nullable=False),
        sa.Column("ui_layout_json", postgresql.JSONB, nullable=True),
        sa.Column("is_default", sa.Boolean, server_default="false"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "patient_problem_list",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("diagnosis_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("icd10_code", sa.String(10), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), server_default="'active'"),
        sa.Column("onset_date", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Billing ───────────────────────────────────────────

    op.create_table(
        "service_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("base_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax_rate", sa.Numeric(5, 4), server_default="0.0"),
        sa.Column("currency", sa.String(3), server_default="'DOP'"),
        sa.Column("cpt_code", sa.String(10), nullable=True),
        sa.Column("cups_code", sa.String(10), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "charge_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_catalog.id"), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("quantity", sa.Integer, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount", sa.Numeric(12, 2), server_default="0.0"),
        sa.Column("tax", sa.Numeric(12, 2), server_default="0.0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("covered_by_insurance", sa.Numeric(12, 2), server_default="0.0"),
        sa.Column("patient_responsibility", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), server_default="'pending'"),
        sa.Column("charged_by", postgresql.UUID(as_uuid=True), nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invoice_number", sa.String(50), unique=True, nullable=False),
        sa.Column("fiscal_number", sa.String(50), nullable=True, index=True),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
        sa.Column("tax_total", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("discount_total", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("grand_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="'DOP'"),
        sa.Column("status", sa.String(20), server_default="'draft'"),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("paid_date", sa.Date, nullable=True),
        sa.Column("fiscal_type", sa.String(30), nullable=True),
        sa.Column("country_code", sa.String(2), server_default="'DO'"),
        sa.Column("tax_id", sa.String(30), nullable=True),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("customer_tax_id", sa.String(30), nullable=True),
        sa.Column("customer_address", sa.String(500), nullable=True),
        sa.Column("fiscal_response", postgresql.JSONB, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "invoice_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("charge_item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("quantity", sa.Integer, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount", sa.Numeric(12, 2), server_default="0.0"),
        sa.Column("tax", sa.Numeric(12, 2), server_default="0.0"),
        sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_method", sa.String(30), nullable=False),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reconciled", sa.Boolean, server_default="false"),
        sa.Column("notes", sa.Text, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "insurance_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("insurer_name", sa.String(200), nullable=False),
        sa.Column("insurer_code", sa.String(50), nullable=True),
        sa.Column("policy_number", sa.String(50), nullable=False),
        sa.Column("claim_number", sa.String(50), unique=True, nullable=False),
        sa.Column("total_claimed", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_approved", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("total_denied", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("status", sa.String(20), server_default="'draft'"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("adjudicated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claim_details", postgresql.JSONB, nullable=True),
        sa.Column("denial_reason", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "fiscal_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", sa.String(100), nullable=False, index=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("tax_id", sa.String(30), nullable=False),
        sa.Column("fiscal_regime", sa.String(50), nullable=True),
        sa.Column("business_name", sa.String(200), nullable=False),
        sa.Column("business_address", sa.String(500), nullable=True),
        sa.Column("sequence_prefix", sa.String(20), nullable=True),
        sa.Column("current_sequence", sa.Integer, server_default="0"),
        sa.Column("api_credentials", postgresql.JSONB, nullable=True),
        sa.Column("default_tax_rate", sa.Numeric(5, 4), server_default="0.18"),
        sa.Column("tax_name", sa.String(20), server_default="'ITBIS'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_fiscal_config_tenant_country", "fiscal_configs", ["tenant_id", "country_code"], unique=True)

    op.create_table(
        "insurer_contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("insurer_name", sa.String(200), nullable=False),
        sa.Column("insurer_code", sa.String(50), nullable=False),
        sa.Column("contract_number", sa.String(50), nullable=False),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("expiration_date", sa.Date, nullable=True),
        sa.Column("terms_json", postgresql.JSONB, nullable=True),
        sa.Column("adjudication_rules_json", postgresql.JSONB, nullable=True),
        sa.Column("status", sa.String(20), server_default="'active'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Pharmacy ──────────────────────────────────────────

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(300), nullable=False, index=True),
        sa.Column("generic_name", sa.String(300), nullable=True),
        sa.Column("active_ingredient", sa.String(200), nullable=True),
        sa.Column("presentation", sa.String(100), nullable=True),
        sa.Column("concentration", sa.String(50), nullable=True),
        sa.Column("unit_of_measure", sa.String(20), server_default="'unidad'"),
        sa.Column("product_type", sa.String(30), nullable=False),
        sa.Column("atc_code", sa.String(10), nullable=True, index=True),
        sa.Column("therapeutic_group", sa.String(100), nullable=True),
        sa.Column("controlled_substance_level", sa.SmallInteger, server_default="0"),
        sa.Column("requires_cold_chain", sa.Boolean, server_default="false"),
        sa.Column("requires_prescription", sa.Boolean, server_default="true"),
        sa.Column("barcode", sa.String(50), nullable=True, index=True),
        sa.Column("manufacturer", sa.String(200), nullable=True),
        sa.Column("registration_number", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), server_default="'active'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "product_lots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("lot_number", sa.String(50), nullable=False),
        sa.Column("expiration_date", sa.Date, nullable=False, index=True),
        sa.Column("quantity_received", sa.Integer, nullable=False),
        sa.Column("quantity_available", sa.Integer, nullable=False),
        sa.Column("cost_per_unit", sa.Numeric(12, 2), server_default="0.0"),
        sa.Column("supplier_name", sa.String(200), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", sa.String(20), server_default="'available'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_product_lots_expiration", "product_lots", ["product_id", "expiration_date"])

    op.create_table(
        "warehouses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("warehouse_type", sa.String(30), server_default="'central'"),
        sa.Column("location_description", sa.String(500), nullable=True),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), server_default="'active'"),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "stock_levels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("quantity_on_hand", sa.Integer, server_default="0"),
        sa.Column("quantity_reserved", sa.Integer, server_default="0"),
        sa.Column("reorder_point", sa.Integer, server_default="10"),
        sa.Column("max_level", sa.Integer, server_default="100"),
        sa.Column("last_counted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_stock_product_warehouse", "stock_levels", ["product_id", "warehouse_id"], unique=True)

    op.create_table(
        "prescriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("prescribed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("medication_name", sa.String(300), nullable=False),
        sa.Column("dosage", sa.String(100), nullable=False),
        sa.Column("frequency", sa.String(100), nullable=False),
        sa.Column("route", sa.String(50), nullable=False),
        sa.Column("duration_days", sa.Integer, nullable=True),
        sa.Column("quantity_prescribed", sa.Integer, nullable=False),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("substitution_allowed", sa.Boolean, server_default="true"),
        sa.Column("status", sa.String(20), server_default="'active'"),
        sa.Column("alerts_json", postgresql.JSONB, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "dispensations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("prescription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prescriptions.id"), nullable=False),
        sa.Column("product_lot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_lots.id"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity_dispensed", sa.Integer, nullable=False),
        sa.Column("dispensed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dispensed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("patient_verified", sa.Boolean, server_default="false"),
        sa.Column("notes", sa.Text, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("supplier_name", sa.String(200), nullable=False),
        sa.Column("supplier_code", sa.String(50), nullable=True),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="'draft'"),
        sa.Column("order_date", sa.Date, nullable=True),
        sa.Column("expected_delivery", sa.Date, nullable=True),
        sa.Column("total_amount", sa.Numeric(14, 2), server_default="0.0"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("items_json", postgresql.JSONB, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        # BaseEntity
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "stock_movements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("lot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_lots.id"), nullable=True),
        sa.Column("from_warehouse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("to_warehouse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("movement_type", sa.String(30), nullable=False),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("performed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("performed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "controlled_substance_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("lot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("balance_after", sa.Integer, nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("performed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("witnessed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("performed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    # Drop in reverse order (respect foreign key dependencies)
    op.drop_table("controlled_substance_logs")
    op.drop_table("stock_movements")
    op.drop_table("purchase_orders")
    op.drop_table("dispensations")
    op.drop_table("prescriptions")
    op.drop_index("ix_stock_product_warehouse", "stock_levels")
    op.drop_table("stock_levels")
    op.drop_table("warehouses")
    op.drop_index("ix_product_lots_expiration", "product_lots")
    op.drop_table("product_lots")
    op.drop_table("products")
    op.drop_table("insurer_contracts")
    op.drop_index("ix_fiscal_config_tenant_country", "fiscal_configs")
    op.drop_table("fiscal_configs")
    op.drop_table("insurance_claims")
    op.drop_table("payments")
    op.drop_table("invoice_lines")
    op.drop_table("invoices")
    op.drop_table("charge_items")
    op.drop_table("service_catalog")
    op.drop_table("patient_problem_list")
    op.drop_table("clinical_templates")
    op.drop_table("medical_orders")
    op.drop_table("allergies")
    op.drop_table("vital_signs")
    op.drop_table("diagnoses")
    op.drop_table("clinical_notes")
    op.drop_index("ix_encounters_patient_date", "encounters")
    op.drop_table("encounters")
    op.drop_table("waiting_list")
    op.drop_index("ix_appointments_patient_date", "appointments")
    op.drop_index("ix_appointments_date_provider", "appointments")
    op.drop_table("appointments")
    op.drop_table("schedule_blocks")
    op.drop_table("schedule_templates")
    op.drop_table("locations")
    op.drop_table("providers")
    op.drop_table("patient_insurances")
    op.drop_index("ix_patients_name", "patients")
    op.drop_index("ix_patients_document", "patients")
    op.drop_table("patients")
    op.drop_table("audit_logs")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("roles")
    op.drop_table("icd10_catalog")
    op.drop_table("tenants")
