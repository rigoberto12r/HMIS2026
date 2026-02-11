"""
Basic tests for the Custom Reporting System.
Run with: pytest app/modules/reports/test_reports.py -v
"""

import pytest
from datetime import date, datetime
from uuid import uuid4

from app.modules.reports.schemas import (
    QueryConfig,
    QueryFilter,
    QuerySort,
    ReportDefinitionCreate,
    PredefinedReportRequest,
)


def test_query_config_schema():
    """Test QueryConfig schema validation."""
    config = QueryConfig(
        data_source="patients",
        fields=["first_name", "last_name", "email"],
        filters=[
            QueryFilter(field="status", operator="equals", value="active"),
            QueryFilter(field="age", operator="gt", value=18),
        ],
        group_by=["gender"],
        sort=[QuerySort(field="last_name", direction="asc")],
        limit=100,
    )

    assert config.data_source == "patients"
    assert len(config.fields) == 3
    assert len(config.filters) == 2
    assert config.filters[0].operator == "equals"
    assert config.limit == 100


def test_report_definition_create_schema():
    """Test ReportDefinitionCreate schema."""
    report = ReportDefinitionCreate(
        name="Test Report",
        description="A test report",
        report_type="clinical",
        category="patient_demographics",
        query_config=QueryConfig(
            data_source="patients",
            fields=["mrn", "first_name", "last_name"],
            filters=[],
            group_by=[],
            sort=[],
            limit=None,
        ),
        is_public=False,
        is_template=False,
        tags=["test", "demo"],
    )

    assert report.name == "Test Report"
    assert report.report_type == "clinical"
    assert len(report.tags) == 2


def test_predefined_report_request():
    """Test PredefinedReportRequest schema."""
    request = PredefinedReportRequest(
        template_name="patient_demographics",
        parameters={
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
        },
        export_format="excel",
    )

    assert request.template_name == "patient_demographics"
    assert request.export_format == "excel"
    assert "start_date" in request.parameters


def test_query_filter_operators():
    """Test all query filter operators."""
    operators = [
        "equals",
        "not_equals",
        "contains",
        "gt",
        "gte",
        "lt",
        "lte",
        "in",
        "between",
    ]

    for op in operators:
        filter = QueryFilter(field="test_field", operator=op, value="test")
        assert filter.operator == op


def test_report_type_validation():
    """Test report type must be one of the allowed values."""
    valid_types = ["clinical", "financial", "operational"]

    for report_type in valid_types:
        config = QueryConfig(
            data_source="patients",
            fields=[],
            filters=[],
            group_by=[],
            sort=[],
            limit=None,
        )
        report = ReportDefinitionCreate(
            name="Test",
            report_type=report_type,
            query_config=config,
        )
        assert report.report_type == report_type


def test_export_format_validation():
    """Test export format validation."""
    valid_formats = ["json", "csv", "excel", "pdf"]

    for fmt in valid_formats:
        request = PredefinedReportRequest(
            template_name="patient_demographics",
            parameters={},
            export_format=fmt,
        )
        assert request.export_format == fmt


@pytest.mark.asyncio
async def test_report_service_export_functions():
    """Test that export functions exist and are callable."""
    from app.modules.reports.service import ReportService

    # These would need actual async session and data
    # This is just a structural test
    assert hasattr(ReportService, "export_to_csv")
    assert hasattr(ReportService, "export_to_excel")
    assert hasattr(ReportService, "export_to_pdf")
    assert hasattr(ReportService, "execute_custom_report")
    assert hasattr(ReportService, "generate_patient_demographics_report")
    assert hasattr(ReportService, "generate_diagnosis_trends_report")
    assert hasattr(ReportService, "generate_provider_productivity_report")
    assert hasattr(ReportService, "generate_revenue_analysis_report")
    assert hasattr(ReportService, "generate_insurance_claims_report")
    assert hasattr(ReportService, "generate_appointment_statistics_report")


def test_models_exist():
    """Test that all report models are defined."""
    from app.modules.reports.models import (
        ReportDefinition,
        ScheduledReport,
        ReportExecution,
    )

    assert ReportDefinition is not None
    assert ScheduledReport is not None
    assert ReportExecution is not None


def test_routes_exist():
    """Test that router is defined."""
    from app.modules.reports.routes import router

    assert router is not None
    assert len(router.routes) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
