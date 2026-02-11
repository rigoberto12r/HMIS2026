"""
SMART on FHIR scope parsing and validation.

SMART scopes follow the pattern: context/ResourceType.action
  - context: "patient" (restricted to single patient), "user" (all patients user can access), "system"
  - ResourceType: FHIR resource name or "*"
  - action: "read", "write", or "*"

Examples:
  patient/Patient.read      - Read the in-context patient
  user/Observation.write    - Write observations for any accessible patient
  patient/*.read            - Read all resource types for in-context patient
  launch/patient            - Request patient launch context
  openid fhirUser           - OpenID Connect identity
"""

from dataclasses import dataclass

# FHIR resource types supported by this server
SUPPORTED_RESOURCES = frozenset({
    "Patient",
    "Encounter",
    "Observation",
    "Condition",
    "MedicationRequest",
    "AllergyIntolerance",
})

# Special (non-resource) scopes
SPECIAL_SCOPES = frozenset({
    "openid",
    "fhirUser",
    "profile",
    "launch",
    "launch/patient",
    "launch/encounter",
    "offline_access",
})

# SMART scope → internal permission mapping
SCOPE_TO_PERMISSION: dict[str, str] = {
    "Patient.read": "patients:read",
    "Patient.write": "patients:write",
    "Encounter.read": "encounters:read",
    "Encounter.write": "encounters:write",
    "Observation.read": "encounters:read",
    "Observation.write": "encounters:write",
    "Condition.read": "encounters:read",
    "Condition.write": "encounters:write",
    "MedicationRequest.read": "prescriptions:read",
    "MedicationRequest.write": "prescriptions:write",
    "AllergyIntolerance.read": "patients:read",
    "AllergyIntolerance.write": "patients:write",
}

ALL_SUPPORTED_SCOPES = (
    list(SPECIAL_SCOPES)
    + [f"patient/{r}.read" for r in SUPPORTED_RESOURCES]
    + [f"patient/{r}.write" for r in SUPPORTED_RESOURCES]
    + [f"user/{r}.read" for r in SUPPORTED_RESOURCES]
    + [f"user/{r}.write" for r in SUPPORTED_RESOURCES]
    + ["patient/*.read", "patient/*.write", "user/*.read", "user/*.write"]
)


@dataclass(frozen=True)
class SMARTScope:
    """Parsed SMART on FHIR scope."""

    context: str        # "patient", "user", or "system"
    resource_type: str  # "Patient", "Encounter", ... or "*"
    action: str         # "read", "write", or "*"
    raw: str            # Original scope string

    @classmethod
    def parse(cls, scope_str: str) -> "SMARTScope | None":
        """Parse a scope string like 'patient/Patient.read'. Returns None for special scopes."""
        if scope_str in SPECIAL_SCOPES:
            return None

        parts = scope_str.split("/")
        if len(parts) != 2:
            return None

        context = parts[0]
        if context not in ("patient", "user", "system"):
            return None

        resource_action = parts[1].split(".")
        if len(resource_action) != 2:
            return None

        resource_type, action = resource_action

        if resource_type != "*" and resource_type not in SUPPORTED_RESOURCES:
            return None

        if action not in ("read", "write", "*"):
            return None

        return cls(context=context, resource_type=resource_type, action=action, raw=scope_str)


def parse_scopes(scope_string: str) -> list[str]:
    """Split space-separated scope string into list."""
    if not scope_string:
        return []
    return [s.strip() for s in scope_string.split() if s.strip()]


def validate_scopes(scopes: list[str]) -> tuple[bool, list[str]]:
    """Validate scope list. Returns (all_valid, list_of_invalid_scopes)."""
    invalid = []
    for scope in scopes:
        if scope in SPECIAL_SCOPES:
            continue
        parsed = SMARTScope.parse(scope)
        if parsed is None:
            invalid.append(scope)
    return len(invalid) == 0, invalid


def scope_allows(scopes: list[str], resource_type: str, action: str) -> bool:
    """Check if the given scopes grant access to resource_type + action."""
    for scope_str in scopes:
        parsed = SMARTScope.parse(scope_str)
        if parsed is None:
            continue

        # Resource type: must match exactly or be wildcard
        if parsed.resource_type != "*" and parsed.resource_type != resource_type:
            continue

        # Action: exact match, wildcard, or "write" implies "read"
        if parsed.action == "*":
            return True
        if parsed.action == action:
            return True
        if parsed.action == "write" and action == "read":
            return True

    return False


def has_patient_context(scopes: list[str]) -> bool:
    """Check if any scope uses 'patient/' context (restricts to single patient)."""
    for scope_str in scopes:
        parsed = SMARTScope.parse(scope_str)
        if parsed and parsed.context == "patient":
            return True
    return False
