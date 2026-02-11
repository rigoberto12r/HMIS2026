"""
FHIR CapabilityStatement generator.

Describes the FHIR server capabilities, resources, and operations supported.
"""

from fhir.resources.capabilitystatement import (
    CapabilityStatement,
    CapabilityStatementImplementation,
    CapabilityStatementRest,
    CapabilityStatementRestResource,
    CapabilityStatementRestResourceInteraction,
    CapabilityStatementRestResourceOperation,
    CapabilityStatementRestResourceSearchParam,
    CapabilityStatementRestSecurity,
    CapabilityStatementSoftware,
)
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.coding import Coding
from fhir.resources.extension import Extension


def generate_capability_statement(base_url: str = "http://localhost:8000/api/v1/fhir") -> CapabilityStatement:
    """
    Generate FHIR CapabilityStatement describing server capabilities.

    Args:
        base_url: Base URL of the FHIR server

    Returns:
        CapabilityStatement resource
    """
    # Define Patient resource capabilities
    patient_resource = CapabilityStatementRestResource(
        type="Patient",
        profile="http://hl7.org/fhir/StructureDefinition/Patient",
        interaction=[
            CapabilityStatementRestResourceInteraction(code="read"),
            CapabilityStatementRestResourceInteraction(code="create"),
            CapabilityStatementRestResourceInteraction(code="update"),
            CapabilityStatementRestResourceInteraction(code="delete"),
            CapabilityStatementRestResourceInteraction(code="search-type"),
        ],
        versioning="no-version",
        readHistory=False,
        updateCreate=False,
        conditionalCreate=False,
        conditionalUpdate=False,
        conditionalDelete="not-supported",
        searchParam=[
            CapabilityStatementRestResourceSearchParam(
                name="_id",
                type="token",
                documentation="Logical ID of the resource",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="identifier",
                type="token",
                documentation="A patient identifier (MRN or document number)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="family",
                type="string",
                documentation="A portion of the family name of the patient",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="given",
                type="string",
                documentation="A portion of the given name of the patient",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="birthdate",
                type="date",
                documentation="The patient's date of birth",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="gender",
                type="token",
                documentation="Gender of the patient",
            ),
        ],
        operation=[
            CapabilityStatementRestResourceOperation(
                name="everything",
                definition="http://hl7.org/fhir/OperationDefinition/Patient-everything",
                documentation="Fetch the complete patient record (Patient + all related resources: Encounters, Observations, Conditions, MedicationRequests, AllergyIntolerances)",
            ),
        ],
    )

    # Define Encounter resource capabilities
    encounter_resource = CapabilityStatementRestResource(
        type="Encounter",
        profile="http://hl7.org/fhir/StructureDefinition/Encounter",
        interaction=[
            CapabilityStatementRestResourceInteraction(code="read"),
            CapabilityStatementRestResourceInteraction(code="create"),
            CapabilityStatementRestResourceInteraction(code="update"),
            CapabilityStatementRestResourceInteraction(code="search-type"),
        ],
        versioning="no-version",
        readHistory=False,
        updateCreate=False,
        conditionalCreate=False,
        conditionalUpdate=False,
        conditionalDelete="not-supported",
        searchParam=[
            CapabilityStatementRestResourceSearchParam(
                name="patient",
                type="reference",
                documentation="The patient present at the encounter",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="date",
                type="date",
                documentation="A date within the period the Encounter lasted",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="type",
                type="token",
                documentation="Specific type of encounter (ambulatory, emergency, inpatient)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="status",
                type="token",
                documentation="Status of the encounter (in-progress, finished, cancelled)",
            ),
        ],
    )

    # Define Observation resource capabilities
    observation_resource = CapabilityStatementRestResource(
        type="Observation",
        profile="http://hl7.org/fhir/StructureDefinition/vitalsigns",
        interaction=[
            CapabilityStatementRestResourceInteraction(code="read"),
            CapabilityStatementRestResourceInteraction(code="search-type"),
        ],
        versioning="no-version",
        readHistory=False,
        updateCreate=False,
        conditionalCreate=False,
        conditionalUpdate=False,
        conditionalDelete="not-supported",
        searchParam=[
            CapabilityStatementRestResourceSearchParam(
                name="patient",
                type="reference",
                documentation="The patient the observation is about",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="encounter",
                type="reference",
                documentation="The encounter the observation was made during",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="category",
                type="token",
                documentation="The classification of the observation (vital-signs, laboratory)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="code",
                type="token",
                documentation="The code of the observation type (LOINC)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="date",
                type="date",
                documentation="Obtained date/time",
            ),
        ],
    )

    # Define Condition resource capabilities
    condition_resource = CapabilityStatementRestResource(
        type="Condition",
        profile="http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
        interaction=[
            CapabilityStatementRestResourceInteraction(code="read"),
            CapabilityStatementRestResourceInteraction(code="search-type"),
        ],
        versioning="no-version",
        readHistory=False,
        updateCreate=False,
        conditionalCreate=False,
        conditionalUpdate=False,
        conditionalDelete="not-supported",
        searchParam=[
            CapabilityStatementRestResourceSearchParam(
                name="patient",
                type="reference",
                documentation="The patient who has the condition",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="encounter",
                type="reference",
                documentation="The encounter when the condition was asserted",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="category",
                type="token",
                documentation="The category of the condition (encounter-diagnosis, problem-list-item)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="clinical-status",
                type="token",
                documentation="The clinical status of the condition (active, resolved, inactive)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="code",
                type="token",
                documentation="Code for the condition (ICD-10)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="onset-date",
                type="date",
                documentation="Date when condition started",
            ),
        ],
    )

    # Define MedicationRequest resource capabilities
    medication_request_resource = CapabilityStatementRestResource(
        type="MedicationRequest",
        profile="http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
        interaction=[
            CapabilityStatementRestResourceInteraction(code="read"),
            CapabilityStatementRestResourceInteraction(code="search-type"),
        ],
        versioning="no-version",
        readHistory=False,
        updateCreate=False,
        conditionalCreate=False,
        conditionalUpdate=False,
        conditionalDelete="not-supported",
        searchParam=[
            CapabilityStatementRestResourceSearchParam(
                name="patient",
                type="reference",
                documentation="The patient who has the medication request",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="encounter",
                type="reference",
                documentation="The encounter during which the medication was prescribed",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="status",
                type="token",
                documentation="Status of the prescription (active, completed, cancelled, stopped)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="intent",
                type="token",
                documentation="The kind of medication order (always 'order' for prescriptions)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="authoredon",
                type="date",
                documentation="Date when prescription was written",
            ),
        ],
    )

    # Define AllergyIntolerance resource capabilities
    allergy_intolerance_resource = CapabilityStatementRestResource(
        type="AllergyIntolerance",
        profile="http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
        interaction=[
            CapabilityStatementRestResourceInteraction(code="read"),
            CapabilityStatementRestResourceInteraction(code="search-type"),
        ],
        versioning="no-version",
        readHistory=False,
        updateCreate=False,
        conditionalCreate=False,
        conditionalUpdate=False,
        conditionalDelete="not-supported",
        searchParam=[
            CapabilityStatementRestResourceSearchParam(
                name="patient",
                type="reference",
                documentation="The patient who has the allergy or intolerance",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="clinical-status",
                type="token",
                documentation="Clinical status of the allergy (active, inactive)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="category",
                type="token",
                documentation="Category of allergy (medication, food, environment, biologic)",
            ),
            CapabilityStatementRestResourceSearchParam(
                name="type",
                type="token",
                documentation="Type: allergy or intolerance",
            ),
        ],
    )

    # SMART on FHIR security section with OAuth2 URIs
    smart_security = CapabilityStatementRestSecurity(
        service=[
            CodeableConcept(
                coding=[
                    Coding(
                        system="http://terminology.hl7.org/CodeSystem/restful-security-service",
                        code="SMART-on-FHIR",
                        display="SMART on FHIR",
                    )
                ],
                text="OAuth2 using SMART-on-FHIR profile (see http://docs.smarthealthit.org)",
            )
        ],
        description=(
            "SMART on FHIR OAuth2 authorization. Supports EHR Launch and "
            "Standalone Launch workflows with PKCE. Internal JWT (HS256) and "
            "SMART JWT (RS256) tokens are both accepted."
        ),
        extension=[
            Extension(
                url="http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
                extension=[
                    Extension(url="authorize", valueUri=f"{base_url.replace('/api/v1/fhir', '')}/api/v1/smart/authorize"),
                    Extension(url="token", valueUri=f"{base_url.replace('/api/v1/fhir', '')}/api/v1/smart/token"),
                    Extension(url="introspect", valueUri=f"{base_url.replace('/api/v1/fhir', '')}/api/v1/smart/introspect"),
                    Extension(url="revoke", valueUri=f"{base_url.replace('/api/v1/fhir', '')}/api/v1/smart/revoke"),
                ],
            ),
        ],
    )

    # Define REST capabilities
    rest = CapabilityStatementRest(
        mode="server",
        documentation=(
            "HMIS FHIR R4 Server - Outpatient Excellence focused implementation. "
            "Supports batch and transaction Bundle operations for efficient multi-resource processing."
        ),
        security=smart_security,
        resource=[patient_resource, encounter_resource, observation_resource, condition_resource, medication_request_resource, allergy_intolerance_resource],
        interaction=[
            {
                "code": "batch",
                "documentation": "Process multiple independent requests in a single Bundle. Continues on error.",
            },
            {
                "code": "transaction",
                "documentation": "Process multiple requests atomically. Rolls back all changes on any error.",
            },
        ],
    )

    # Build CapabilityStatement
    capability = CapabilityStatement(
        status="active",
        date="2026-02-10",
        kind="instance",
        fhirVersion="4.0.1",
        format=["json"],
        patchFormat=["application/json-patch+json"],
        implementation=CapabilityStatementImplementation(
            description="HMIS 2026 FHIR R4 Server",
            url=base_url,
        ),
        software=CapabilityStatementSoftware(
            name="HMIS 2026",
            version="1.0.0",
        ),
        rest=[rest],
    )

    return capability
