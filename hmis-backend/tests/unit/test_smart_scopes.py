"""
Unit tests for SMART on FHIR scope parsing and validation.
"""

import pytest

from app.modules.smart.scopes import (
    ALL_SUPPORTED_SCOPES,
    SMARTScope,
    has_patient_context,
    parse_scopes,
    scope_allows,
    validate_scopes,
)


# ============================================================ #
# SMARTScope.parse
# ============================================================ #


class TestSMARTScopeParse:
    def test_parse_patient_read(self):
        s = SMARTScope.parse("patient/Patient.read")
        assert s is not None
        assert s.context == "patient"
        assert s.resource_type == "Patient"
        assert s.action == "read"
        assert s.raw == "patient/Patient.read"

    def test_parse_user_write(self):
        s = SMARTScope.parse("user/Observation.write")
        assert s is not None
        assert s.context == "user"
        assert s.resource_type == "Observation"
        assert s.action == "write"

    def test_parse_wildcard_resource(self):
        s = SMARTScope.parse("patient/*.read")
        assert s is not None
        assert s.resource_type == "*"
        assert s.action == "read"

    def test_parse_wildcard_action(self):
        s = SMARTScope.parse("user/Patient.*")
        assert s is not None
        assert s.resource_type == "Patient"
        assert s.action == "*"

    def test_parse_system_context(self):
        s = SMARTScope.parse("system/Encounter.read")
        assert s is not None
        assert s.context == "system"

    def test_parse_all_supported_resources(self):
        for resource in [
            "Patient",
            "Encounter",
            "Observation",
            "Condition",
            "MedicationRequest",
            "AllergyIntolerance",
        ]:
            s = SMARTScope.parse(f"patient/{resource}.read")
            assert s is not None, f"Failed to parse patient/{resource}.read"
            assert s.resource_type == resource

    def test_parse_special_scope_returns_none(self):
        assert SMARTScope.parse("openid") is None
        assert SMARTScope.parse("fhirUser") is None
        assert SMARTScope.parse("profile") is None
        assert SMARTScope.parse("launch") is None
        assert SMARTScope.parse("launch/patient") is None
        assert SMARTScope.parse("offline_access") is None

    def test_parse_invalid_context(self):
        assert SMARTScope.parse("admin/Patient.read") is None

    def test_parse_invalid_resource(self):
        assert SMARTScope.parse("patient/FakeResource.read") is None

    def test_parse_invalid_action(self):
        assert SMARTScope.parse("patient/Patient.delete") is None

    def test_parse_invalid_format(self):
        assert SMARTScope.parse("patient/Patient") is None
        assert SMARTScope.parse("Patient.read") is None
        assert SMARTScope.parse("patient") is None
        assert SMARTScope.parse("") is None
        assert SMARTScope.parse("a/b/c.read") is None


# ============================================================ #
# parse_scopes
# ============================================================ #


class TestParseScopes:
    def test_empty_string(self):
        assert parse_scopes("") == []

    def test_single_scope(self):
        assert parse_scopes("openid") == ["openid"]

    def test_multiple_scopes(self):
        result = parse_scopes("openid fhirUser patient/Patient.read")
        assert result == ["openid", "fhirUser", "patient/Patient.read"]

    def test_extra_whitespace(self):
        result = parse_scopes("  openid   fhirUser  ")
        assert result == ["openid", "fhirUser"]


# ============================================================ #
# validate_scopes
# ============================================================ #


class TestValidateScopes:
    def test_all_valid(self):
        scopes = ["openid", "fhirUser", "patient/Patient.read"]
        valid, invalid = validate_scopes(scopes)
        assert valid is True
        assert invalid == []

    def test_invalid_scope(self):
        scopes = ["openid", "invalid_scope", "patient/Patient.read"]
        valid, invalid = validate_scopes(scopes)
        assert valid is False
        assert "invalid_scope" in invalid

    def test_special_scopes_valid(self):
        scopes = ["openid", "fhirUser", "profile", "launch/patient", "offline_access"]
        valid, invalid = validate_scopes(scopes)
        assert valid is True

    def test_empty_list(self):
        valid, invalid = validate_scopes([])
        assert valid is True


# ============================================================ #
# scope_allows
# ============================================================ #


class TestScopeAllows:
    def test_exact_match(self):
        scopes = ["patient/Patient.read"]
        assert scope_allows(scopes, "Patient", "read") is True
        assert scope_allows(scopes, "Patient", "write") is False
        assert scope_allows(scopes, "Encounter", "read") is False

    def test_write_implies_read(self):
        scopes = ["patient/Patient.write"]
        assert scope_allows(scopes, "Patient", "read") is True
        assert scope_allows(scopes, "Patient", "write") is True

    def test_wildcard_resource(self):
        scopes = ["patient/*.read"]
        assert scope_allows(scopes, "Patient", "read") is True
        assert scope_allows(scopes, "Encounter", "read") is True
        assert scope_allows(scopes, "Observation", "read") is True
        assert scope_allows(scopes, "Patient", "write") is False

    def test_wildcard_action(self):
        scopes = ["user/Patient.*"]
        assert scope_allows(scopes, "Patient", "read") is True
        assert scope_allows(scopes, "Patient", "write") is True
        assert scope_allows(scopes, "Encounter", "read") is False

    def test_multiple_scopes(self):
        scopes = ["patient/Patient.read", "patient/Encounter.write"]
        assert scope_allows(scopes, "Patient", "read") is True
        assert scope_allows(scopes, "Encounter", "write") is True
        assert scope_allows(scopes, "Encounter", "read") is True  # write implies read
        assert scope_allows(scopes, "Observation", "read") is False

    def test_special_scopes_ignored(self):
        scopes = ["openid", "fhirUser"]
        assert scope_allows(scopes, "Patient", "read") is False

    def test_empty_scopes(self):
        assert scope_allows([], "Patient", "read") is False

    def test_full_wildcard(self):
        scopes = ["user/*.*"]
        assert scope_allows(scopes, "Patient", "read") is True
        assert scope_allows(scopes, "Encounter", "write") is True
        assert scope_allows(scopes, "Observation", "read") is True


# ============================================================ #
# has_patient_context
# ============================================================ #


class TestHasPatientContext:
    def test_patient_context_present(self):
        scopes = ["patient/Patient.read", "openid"]
        assert has_patient_context(scopes) is True

    def test_no_patient_context(self):
        scopes = ["user/Patient.read", "openid"]
        assert has_patient_context(scopes) is False

    def test_mixed_contexts(self):
        scopes = ["user/Encounter.read", "patient/Patient.read"]
        assert has_patient_context(scopes) is True

    def test_empty_scopes(self):
        assert has_patient_context([]) is False

    def test_only_special_scopes(self):
        assert has_patient_context(["openid", "fhirUser"]) is False


# ============================================================ #
# ALL_SUPPORTED_SCOPES
# ============================================================ #


class TestAllSupportedScopes:
    def test_includes_special_scopes(self):
        assert "openid" in ALL_SUPPORTED_SCOPES
        assert "fhirUser" in ALL_SUPPORTED_SCOPES
        assert "launch/patient" in ALL_SUPPORTED_SCOPES

    def test_includes_patient_scopes(self):
        assert "patient/Patient.read" in ALL_SUPPORTED_SCOPES
        assert "patient/Patient.write" in ALL_SUPPORTED_SCOPES
        assert "patient/Encounter.read" in ALL_SUPPORTED_SCOPES

    def test_includes_user_scopes(self):
        assert "user/Patient.read" in ALL_SUPPORTED_SCOPES
        assert "user/Observation.write" in ALL_SUPPORTED_SCOPES

    def test_includes_wildcards(self):
        assert "patient/*.read" in ALL_SUPPORTED_SCOPES
        assert "user/*.write" in ALL_SUPPORTED_SCOPES
