"""
C-CDA R2.1 Templates, OIDs, and Constants.

Contains all Template IDs (OIDs), LOINC codes, namespaces, and code system URNs
required for generating C-CDA R2.1 compliant documents.
"""

# =============================================
# XML Namespaces
# =============================================

NAMESPACES = {
    # Default namespace (CDA)
    None: "urn:hl7-org:v3",
    # Standard namespaces
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "voc": "http://www.lantanagroup.com/voc",
    "sdtc": "urn:hl7-org:sdtc",
}

# Schema location for validation
SCHEMA_LOCATION = "urn:hl7-org:v3 ../../../CDA%20R2/cda-schemas-and-samples/infrastructure/cda/CDA_SDTC.xsd"

# =============================================
# C-CDA Document Template OIDs
# =============================================

# Continuity of Care Document (CCD)
TEMPLATE_CCD = "2.16.840.1.113883.10.20.22.1.2"
TEMPLATE_CCD_R21 = "2.16.840.1.113883.10.20.22.1.2:2015-08-01"  # C-CDA R2.1

# US Realm Header
TEMPLATE_US_REALM_HEADER = "2.16.840.1.113883.10.20.22.1.1"
TEMPLATE_US_REALM_HEADER_R21 = "2.16.840.1.113883.10.20.22.1.1:2015-08-01"

# =============================================
# Section Template OIDs (C-CDA R2.1)
# =============================================

# Allergies and Intolerances Section
TEMPLATE_ALLERGIES_SECTION = "2.16.840.1.113883.10.20.22.2.6.1"
TEMPLATE_ALLERGIES_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.6.1:2015-08-01"

# Medications Section
TEMPLATE_MEDICATIONS_SECTION = "2.16.840.1.113883.10.20.22.2.1.1"
TEMPLATE_MEDICATIONS_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.1.1:2014-06-09"

# Problem Section
TEMPLATE_PROBLEM_SECTION = "2.16.840.1.113883.10.20.22.2.5.1"
TEMPLATE_PROBLEM_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.5.1:2015-08-01"

# Vital Signs Section
TEMPLATE_VITAL_SIGNS_SECTION = "2.16.840.1.113883.10.20.22.2.4.1"
TEMPLATE_VITAL_SIGNS_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.4.1:2015-08-01"

# Results Section
TEMPLATE_RESULTS_SECTION = "2.16.840.1.113883.10.20.22.2.3.1"
TEMPLATE_RESULTS_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.3.1:2015-08-01"

# Procedures Section
TEMPLATE_PROCEDURES_SECTION = "2.16.840.1.113883.10.20.22.2.7.1"
TEMPLATE_PROCEDURES_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.7.1:2014-06-09"

# Immunizations Section (optional, for future)
TEMPLATE_IMMUNIZATIONS_SECTION = "2.16.840.1.113883.10.20.22.2.2.1"
TEMPLATE_IMMUNIZATIONS_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.2.1:2015-08-01"

# Social History Section (optional, for future)
TEMPLATE_SOCIAL_HISTORY_SECTION = "2.16.840.1.113883.10.20.22.2.17"
TEMPLATE_SOCIAL_HISTORY_SECTION_R21 = "2.16.840.1.113883.10.20.22.2.17:2015-08-01"

# =============================================
# Entry Template OIDs
# =============================================

# Allergy Concern Act
TEMPLATE_ALLERGY_CONCERN_ACT = "2.16.840.1.113883.10.20.22.4.30"
TEMPLATE_ALLERGY_CONCERN_ACT_R21 = "2.16.840.1.113883.10.20.22.4.30:2015-08-01"

# Allergy Intolerance Observation
TEMPLATE_ALLERGY_INTOLERANCE_OBS = "2.16.840.1.113883.10.20.22.4.7"
TEMPLATE_ALLERGY_INTOLERANCE_OBS_R21 = "2.16.840.1.113883.10.20.22.4.7:2014-06-09"

# Medication Activity
TEMPLATE_MEDICATION_ACTIVITY = "2.16.840.1.113883.10.20.22.4.16"
TEMPLATE_MEDICATION_ACTIVITY_R21 = "2.16.840.1.113883.10.20.22.4.16:2014-06-09"

# Problem Concern Act
TEMPLATE_PROBLEM_CONCERN_ACT = "2.16.840.1.113883.10.20.22.4.3"
TEMPLATE_PROBLEM_CONCERN_ACT_R21 = "2.16.840.1.113883.10.20.22.4.3:2015-08-01"

# Problem Observation
TEMPLATE_PROBLEM_OBSERVATION = "2.16.840.1.113883.10.20.22.4.4"
TEMPLATE_PROBLEM_OBSERVATION_R21 = "2.16.840.1.113883.10.20.22.4.4:2015-08-01"

# Vital Signs Organizer
TEMPLATE_VITAL_SIGNS_ORGANIZER = "2.16.840.1.113883.10.20.22.4.26"
TEMPLATE_VITAL_SIGNS_ORGANIZER_R21 = "2.16.840.1.113883.10.20.22.4.26:2015-08-01"

# Vital Sign Observation
TEMPLATE_VITAL_SIGN_OBSERVATION = "2.16.840.1.113883.10.20.22.4.27"
TEMPLATE_VITAL_SIGN_OBSERVATION_R21 = "2.16.840.1.113883.10.20.22.4.27:2014-06-09"

# Result Organizer
TEMPLATE_RESULT_ORGANIZER = "2.16.840.1.113883.10.20.22.4.1"
TEMPLATE_RESULT_ORGANIZER_R21 = "2.16.840.1.113883.10.20.22.4.1:2015-08-01"

# Result Observation
TEMPLATE_RESULT_OBSERVATION = "2.16.840.1.113883.10.20.22.4.2"
TEMPLATE_RESULT_OBSERVATION_R21 = "2.16.840.1.113883.10.20.22.4.2:2015-08-01"

# =============================================
# LOINC Codes for Sections
# =============================================

LOINC_CCD = "34133-9"  # Continuity of Care Document

LOINC_ALLERGIES = "48765-2"  # Allergies and Adverse Reactions
LOINC_MEDICATIONS = "10160-0"  # History of Medication Use
LOINC_PROBLEMS = "11450-4"  # Problem List
LOINC_VITAL_SIGNS = "8716-3"  # Vital Signs
LOINC_RESULTS = "30954-2"  # Relevant diagnostic tests/laboratory data
LOINC_PROCEDURES = "47519-4"  # History of Procedures
LOINC_IMMUNIZATIONS = "11369-6"  # History of Immunization
LOINC_SOCIAL_HISTORY = "29762-2"  # Social History

# =============================================
# Code System OIDs and URNs
# =============================================

# LOINC - Logical Observation Identifiers Names and Codes
OID_LOINC = "2.16.840.1.113883.6.1"
URN_LOINC = "http://loinc.org"

# SNOMED CT - Systematized Nomenclature of Medicine Clinical Terms
OID_SNOMED_CT = "2.16.840.1.113883.6.96"
URN_SNOMED_CT = "http://snomed.info/sct"

# ICD-10-CM - International Classification of Diseases, 10th Revision, Clinical Modification
OID_ICD10_CM = "2.16.840.1.113883.6.90"
URN_ICD10_CM = "http://hl7.org/fhir/sid/icd-10-cm"

# RxNorm - Normalized drug names
OID_RXNORM = "2.16.840.1.113883.6.88"
URN_RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm"

# UCUM - Unified Code for Units of Measure
URN_UCUM = "http://unitsofmeasure.org"

# CVX - Vaccines Administered (for immunizations)
OID_CVX = "2.16.840.1.113883.12.292"
URN_CVX = "http://hl7.org/fhir/sid/cvx"

# HL7 ActCode (for encounter types, etc.)
OID_HL7_ACT_CODE = "2.16.840.1.113883.5.4"

# HL7 AdministrativeGender
OID_ADMINISTRATIVE_GENDER = "2.16.840.1.113883.5.1"

# HL7 NullFlavor
OID_NULL_FLAVOR = "2.16.840.1.113883.5.1008"

# =============================================
# Value Set OIDs (for coded elements)
# =============================================

# Problem Type (encounter diagnosis vs problem list)
OID_PROBLEM_TYPE = "2.16.840.1.113883.3.88.12.3221.7.2"

# Allergy/Adverse Event Type
OID_ALLERGY_ADVERSE_EVENT_TYPE = "2.16.840.1.113883.3.88.12.3221.6.2"

# Allergy Severity
OID_ALLERGY_SEVERITY = "2.16.840.1.113883.3.88.12.3221.6.8"

# Medication Route (oral, IV, topical, etc.)
OID_MEDICATION_ROUTE = "2.16.840.1.113883.3.88.12.3221.8.7"

# =============================================
# Status Code Values
# =============================================

# Act Status
ACT_STATUS_ACTIVE = "active"
ACT_STATUS_COMPLETED = "completed"
ACT_STATUS_ABORTED = "aborted"
ACT_STATUS_SUSPENDED = "suspended"

# Observation Status
OBS_STATUS_COMPLETED = "completed"
OBS_STATUS_ACTIVE = "active"

# =============================================
# NullFlavor Codes
# =============================================

NULL_FLAVOR_NI = "NI"  # No Information
NULL_FLAVOR_NA = "NA"  # Not Applicable
NULL_FLAVOR_UNK = "UNK"  # Unknown
NULL_FLAVOR_ASKU = "ASKU"  # Asked but unknown
NULL_FLAVOR_NASK = "NASK"  # Not asked
NULL_FLAVOR_OTH = "OTH"  # Other

# =============================================
# Document Type Codes
# =============================================

# LOINC code for CCD document type
DOCUMENT_TYPE_CODE = LOINC_CCD
DOCUMENT_TYPE_DISPLAY = "Continuity of Care Document"
DOCUMENT_TYPE_CODE_SYSTEM = OID_LOINC
DOCUMENT_TYPE_CODE_SYSTEM_NAME = "LOINC"

# =============================================
# Confidentiality Codes
# =============================================

CONFIDENTIALITY_NORMAL = "N"  # Normal
CONFIDENTIALITY_RESTRICTED = "R"  # Restricted
CONFIDENTIALITY_VERY_RESTRICTED = "V"  # Very Restricted

# =============================================
# Helper Functions
# =============================================

def get_oid_from_urn(urn: str) -> str | None:
    """
    Convert URN to OID for code systems.

    Args:
        urn: Code system URN (e.g., "http://loinc.org")

    Returns:
        OID string or None if not found
    """
    urn_to_oid = {
        URN_LOINC: OID_LOINC,
        URN_SNOMED_CT: OID_SNOMED_CT,
        URN_ICD10_CM: OID_ICD10_CM,
        URN_RXNORM: OID_RXNORM,
    }
    return urn_to_oid.get(urn)


def get_code_system_name(oid: str) -> str:
    """
    Get code system name from OID.

    Args:
        oid: Code system OID

    Returns:
        Code system name
    """
    oid_to_name = {
        OID_LOINC: "LOINC",
        OID_SNOMED_CT: "SNOMED CT",
        OID_ICD10_CM: "ICD-10-CM",
        OID_RXNORM: "RxNorm",
        OID_HL7_ACT_CODE: "HL7 ActCode",
        OID_ADMINISTRATIVE_GENDER: "HL7 AdministrativeGender",
    }
    return oid_to_name.get(oid, "Unknown")
