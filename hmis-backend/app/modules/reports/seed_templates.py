"""
Seed script to create predefined report templates in the database.
Run with: python -m app.modules.reports.seed_templates
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.modules.reports.models import ReportDefinition


async def seed_templates():
    """Create predefined report templates."""

    # Create async engine and session
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Template 1: Patient Demographics
        template1 = ReportDefinition(
            tenant_id="default",  # Update with actual tenant
            name="Patient Demographics Report",
            description="Comprehensive patient statistics by age, gender, and insurance coverage",
            report_type="clinical",
            category="patient_demographics",
            query_config={
                "data_source": "patients",
                "fields": [
                    "mrn",
                    "first_name",
                    "last_name",
                    "birth_date",
                    "gender",
                    "blood_type",
                ],
                "filters": [{"field": "is_active", "operator": "equals", "value": True}],
                "group_by": [],
                "sort": [{"field": "created_at", "direction": "desc"}],
                "limit": 1000,
            },
            is_public=True,
            is_template=True,
            tags=["clinical", "demographics", "patients"],
        )

        # Template 2: Diagnosis Trends
        template2 = ReportDefinition(
            tenant_id="default",
            name="Diagnosis Trends Report",
            description="Top diagnoses over time with frequency analysis",
            report_type="clinical",
            category="diagnosis_trends",
            query_config={
                "data_source": "emr",
                "fields": ["encounter_type", "chief_complaint", "status", "start_datetime"],
                "filters": [{"field": "is_active", "operator": "equals", "value": True}],
                "group_by": [],
                "sort": [{"field": "start_datetime", "direction": "desc"}],
                "limit": 500,
            },
            is_public=True,
            is_template=True,
            tags=["clinical", "diagnosis", "trends"],
        )

        # Template 3: Provider Productivity
        template3 = ReportDefinition(
            tenant_id="default",
            name="Provider Productivity Report",
            description="Provider statistics including appointments, encounters, and completion rates",
            report_type="clinical",
            category="provider_productivity",
            query_config={
                "data_source": "appointments",
                "fields": ["provider_id", "status", "appointment_type", "scheduled_start"],
                "filters": [{"field": "is_active", "operator": "equals", "value": True}],
                "group_by": ["provider_id", "status"],
                "sort": [{"field": "scheduled_start", "direction": "desc"}],
                "limit": 1000,
            },
            is_public=True,
            is_template=True,
            tags=["clinical", "providers", "productivity"],
        )

        # Template 4: Revenue Analysis
        template4 = ReportDefinition(
            tenant_id="default",
            name="Revenue Analysis Report",
            description="Revenue breakdown by service category, payment method, and time period",
            report_type="financial",
            category="revenue_analysis",
            query_config={
                "data_source": "billing",
                "fields": [
                    "invoice_number",
                    "grand_total",
                    "status",
                    "currency",
                    "created_at",
                ],
                "filters": [{"field": "is_active", "operator": "equals", "value": True}],
                "group_by": [],
                "sort": [{"field": "created_at", "direction": "desc"}],
                "limit": 1000,
            },
            is_public=True,
            is_template=True,
            tags=["financial", "revenue", "billing"],
        )

        # Template 5: Insurance Claims
        template5 = ReportDefinition(
            tenant_id="default",
            name="Insurance Claims Report",
            description="Insurance claims by status, insurer, and approval rates",
            report_type="financial",
            category="insurance_claims",
            query_config={
                "data_source": "billing",
                "fields": ["invoice_number", "status", "grand_total", "paid_date"],
                "filters": [
                    {"field": "is_active", "operator": "equals", "value": True},
                    {"field": "status", "operator": "in", "value": ["paid", "partial", "pending"]},
                ],
                "group_by": ["status"],
                "sort": [{"field": "created_at", "direction": "desc"}],
                "limit": 500,
            },
            is_public=True,
            is_template=True,
            tags=["financial", "insurance", "claims"],
        )

        # Template 6: Appointment Statistics
        template6 = ReportDefinition(
            tenant_id="default",
            name="Appointment Statistics Report",
            description="Appointment breakdown by status, type, and specialty",
            report_type="operational",
            category="appointment_statistics",
            query_config={
                "data_source": "appointments",
                "fields": [
                    "appointment_type",
                    "status",
                    "scheduled_start",
                    "scheduled_end",
                    "reason",
                ],
                "filters": [{"field": "is_active", "operator": "equals", "value": True}],
                "group_by": ["status", "appointment_type"],
                "sort": [{"field": "scheduled_start", "direction": "desc"}],
                "limit": 1000,
            },
            is_public=True,
            is_template=True,
            tags=["operational", "appointments", "statistics"],
        )

        # Add all templates
        session.add_all(
            [template1, template2, template3, template4, template5, template6]
        )

        try:
            await session.commit()
            print("✅ Successfully created 6 report templates!")
            print("\nTemplates created:")
            print("1. Patient Demographics Report (Clinical)")
            print("2. Diagnosis Trends Report (Clinical)")
            print("3. Provider Productivity Report (Clinical)")
            print("4. Revenue Analysis Report (Financial)")
            print("5. Insurance Claims Report (Financial)")
            print("6. Appointment Statistics Report (Operational)")
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating templates: {e}")
            raise

    await engine.dispose()


if __name__ == "__main__":
    print("🌱 Seeding report templates...")
    print("=" * 60)
    asyncio.run(seed_templates())
    print("=" * 60)
    print("✅ Done!")
