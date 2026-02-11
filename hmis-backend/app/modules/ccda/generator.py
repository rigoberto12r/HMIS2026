"""
C-CDA Document Generator.

Main CCD document assembler that combines header and clinical sections
into a complete C-CDA R2.1 compliant XML document.
"""

from datetime import datetime

from lxml import etree
from lxml.etree import Element, SubElement

from app.modules.ccda.header import generate_ccd_header
from app.modules.ccda.sections import (
    generate_allergies_section,
    generate_medications_section,
    generate_problems_section,
    generate_procedures_section,
    generate_results_section,
    generate_vitals_section,
)
from app.modules.ccda.templates import NAMESPACES, SCHEMA_LOCATION
from app.modules.emr.models import Diagnosis, PatientProblemList, VitalSigns, Allergy
from app.modules.patients.models import Patient
from app.modules.pharmacy.models import Prescription


def generate_ccd_document(
    patient: Patient,
    vital_signs: list[VitalSigns],
    diagnoses: list[Diagnosis],
    problems: list[PatientProblemList],
    prescriptions: list[Prescription],
    allergies: list[Allergy],
    author_info: dict,
    custodian_info: dict,
    encounter_info: dict | None = None,
    document_id: str | None = None,
    effective_time: datetime | None = None,
) -> str:
    """
    Generate complete C-CDA R2.1 CCD XML document.

    Assembles header and all clinical sections into a valid C-CDA document.

    Args:
        patient: Patient model instance
        vital_signs: List of VitalSigns models
        diagnoses: List of Diagnosis models (encounter diagnoses)
        problems: List of PatientProblemList models (chronic problems)
        prescriptions: List of Prescription models
        allergies: List of Allergy models
        author_info: Author (provider) details dictionary
        custodian_info: Custodian organization details dictionary
        encounter_info: Optional encounter details for documentationOf
        document_id: Optional document UUID
        effective_time: Optional document creation time

    Returns:
        Pretty-printed XML string

    Example:
        >>> ccd_xml = generate_ccd_document(
        ...     patient=patient,
        ...     vital_signs=[...],
        ...     diagnoses=[...],
        ...     problems=[...],
        ...     prescriptions=[...],
        ...     allergies=[...],
        ...     author_info={...},
        ...     custodian_info={...},
        ... )
        >>> print(ccd_xml)
        <?xml version="1.0" encoding="UTF-8"?>
        <ClinicalDocument xmlns="urn:hl7-org:v3" ...>
        ...
        </ClinicalDocument>
    """
    # Step 1: Create root ClinicalDocument element with namespaces
    root = Element(
        "ClinicalDocument",
        nsmap=NAMESPACES,
    )
    _add_namespaces(root)

    # Step 2: Generate header elements
    header_elements = generate_ccd_header(
        patient=patient,
        author_info=author_info,
        custodian_info=custodian_info,
        encounter_info=encounter_info,
        document_id=document_id,
        effective_time=effective_time,
    )

    # Add all header elements to root
    for elem in header_elements:
        root.append(elem)

    # Step 3: Create component/structuredBody wrapper
    component = SubElement(root, "component")
    structured_body = SubElement(component, "structuredBody")

    # Step 4: Generate all clinical sections

    # Allergies Section
    allergies_component = SubElement(structured_body, "component")
    allergies_section = generate_allergies_section(allergies)
    allergies_component.append(allergies_section)

    # Medications Section
    medications_component = SubElement(structured_body, "component")
    medications_section = generate_medications_section(prescriptions)
    medications_component.append(medications_section)

    # Problem List Section
    problems_component = SubElement(structured_body, "component")
    problems_section = generate_problems_section(diagnoses, problems)
    problems_component.append(problems_section)

    # Vital Signs Section
    vitals_component = SubElement(structured_body, "component")
    vitals_section = generate_vitals_section(vital_signs)
    vitals_component.append(vitals_section)

    # Results Section
    results_component = SubElement(structured_body, "component")
    results_section = generate_results_section(vital_signs)
    results_component.append(results_section)

    # Procedures Section
    procedures_component = SubElement(structured_body, "component")
    procedures_section = generate_procedures_section()
    procedures_component.append(procedures_section)

    # Step 5: Pretty-print XML
    xml_string = pretty_print_xml(root)

    return xml_string


def _add_namespaces(root: Element) -> None:
    """
    Add required XML namespaces and schema location to root element.

    Args:
        root: Root ClinicalDocument element
    """
    # Schema location
    root.set(
        "{http://www.w3.org/2001/XMLSchema-instance}schemaLocation",
        SCHEMA_LOCATION,
    )


def _validate_ccd(doc: Element) -> bool:
    """
    Basic structure validation for CCD document.

    Checks for required elements but not full schema validation.

    Args:
        doc: Root ClinicalDocument element

    Returns:
        True if basic structure is valid
    """
    # Placeholder - basic validation
    # Full XML schema validation can be added later
    if doc.tag != "ClinicalDocument":
        return False

    # Check for structuredBody
    component = doc.find(".//component/structuredBody")
    if component is None:
        return False

    return True


def pretty_print_xml(element: Element) -> str:
    """
    Format XML with proper indentation and declaration.

    Args:
        element: lxml Element to format

    Returns:
        Pretty-printed XML string with declaration
    """
    # Convert to bytes with pretty printing
    xml_bytes = etree.tostring(
        element,
        pretty_print=True,
        xml_declaration=True,
        encoding="UTF-8",
    )

    # Decode to string
    xml_string = xml_bytes.decode("utf-8")

    return xml_string
