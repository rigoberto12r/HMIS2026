"""
FHIR-specific Pydantic schemas for search parameters and responses.

These schemas handle FHIR search parameters, bundles, and operation outcomes.
"""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class FHIRSearchParams(BaseModel):
    """Common FHIR search parameters."""

    id: Optional[str] = Field(None, alias="_id", description="Logical ID of the resource")
    lastUpdated: Optional[str] = Field(None, alias="_lastUpdated", description="Last update date (format: ge2024-01-01)")
    count: int = Field(20, ge=1, le=100, alias="_count", description="Number of results per page")
    offset: int = Field(0, ge=0, alias="_offset", description="Number of results to skip")

    model_config = {"populate_by_name": True}


class PatientSearchParams(FHIRSearchParams):
    """FHIR Patient search parameters."""

    identifier: Optional[str] = Field(None, description="Patient identifier (MRN or document)")
    family: Optional[str] = Field(None, description="Patient family name")
    given: Optional[str] = Field(None, description="Patient given name")
    birthdate: Optional[str] = Field(None, description="Birth date (format: YYYY-MM-DD)")
    gender: Optional[Literal["male", "female", "other", "unknown"]] = Field(
        None, description="Patient gender"
    )

    @field_validator("birthdate")
    @classmethod
    def validate_birthdate(cls, v: Optional[str]) -> Optional[str]:
        """Validate birthdate format."""
        if v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError("birthdate must be in format YYYY-MM-DD")
        return v


class FHIRBundleEntry(BaseModel):
    """FHIR Bundle entry."""

    fullUrl: str
    resource: dict[str, Any]


class FHIRBundle(BaseModel):
    """FHIR Bundle for search results."""

    resourceType: Literal["Bundle"] = "Bundle"
    type: Literal["searchset"] = "searchset"
    total: int
    entry: list[FHIRBundleEntry] = Field(default_factory=list)


class FHIROperationOutcomeIssue(BaseModel):
    """FHIR OperationOutcome issue."""

    severity: Literal["fatal", "error", "warning", "information"]
    code: str
    diagnostics: Optional[str] = None


class FHIROperationOutcome(BaseModel):
    """FHIR OperationOutcome for error responses."""

    resourceType: Literal["OperationOutcome"] = "OperationOutcome"
    issue: list[FHIROperationOutcomeIssue]

    @classmethod
    def error(cls, message: str, code: str = "processing") -> "FHIROperationOutcome":
        """Create an error OperationOutcome."""
        return cls(
            issue=[
                FHIROperationOutcomeIssue(
                    severity="error",
                    code=code,
                    diagnostics=message,
                )
            ]
        )

    @classmethod
    def success(cls, message: str) -> "FHIROperationOutcome":
        """Create a success OperationOutcome."""
        return cls(
            issue=[
                FHIROperationOutcomeIssue(
                    severity="information",
                    code="informational",
                    diagnostics=message,
                )
            ]
        )
