"""
C-CDA Header Generator.

Generates the ClinicalDocument header section including:
- Document metadata (id, code, title, effectiveTime)
- recordTarget (patient demographics)
- author (document creator)
- custodian (document custodian organization)
- documentationOf (service event/encounter)
"""

from datetime import datetime
from uuid import UUID, uuid4

import pytz
from lxml import etree
from lxml.etree import Element, SubElement

from app.modules.ccda.templates import (
    CONFIDENTIALITY_NORMAL,
    DOCUMENT_TYPE_CODE,
    DOCUMENT_TYPE_CODE_SYSTEM,
    DOCUMENT_TYPE_CODE_SYSTEM_NAME,
    DOCUMENT_TYPE_DISPLAY,
    NAMESPACES,
    OID_ADMINISTRATIVE_GENDER,
    TEMPLATE_CCD_R21,
    TEMPLATE_US_REALM_HEADER_R21,
)
from app.modules.patients.models import Patient


def generate_ccd_header(
    patient: Patient,
    author_info: dict,
    custodian_info: dict,
    encounter_info: dict | None = None,
    document_id: str | None = None,
    effective_time: datetime | None = None,
) -> list[Element]:
    """
    Generate C-CDA CCD header elements (not root).

    Returns list of header elements to be added to ClinicalDocument root.

    Args:
        patient: Patient model instance
        author_info: Dict with author details (id, name, organization)
        custodian_info: Dict with custodian organization details
        encounter_info: Optional encounter details for documentationOf
        document_id: Optional document UUID (generated if not provided)
        effective_time: Optional document creation time (now if not provided)

    Returns:
        List of lxml Elements for CCD header

    Example author_info:
        {
            "id": "provider_npi_123456",
            "id_root": "2.16.840.1.113883.4.6",  # NPI OID
            "given_name": "Carlos",
            "family_name": "Martinez",
            "specialty": "Medicina General",
            "organization_name": "Clinica Santa Cruz",
            "organization_addr": {...},
            "organization_telecom": {...},
        }

    Example custodian_info:
        {
            "id": "clinic_id_123",
            "id_root": "2.16.840.1.113883.3.HMIS",  # HMIS organization OID
            "name": "Clinica Santa Cruz",
            "addr": {...},
            "telecom": {...},
        }
    """
    elements = []

    # Document ID and effective time
    doc_id = document_id or str(uuid4())
    eff_time = effective_time or datetime.now(pytz.UTC)

    # 1. realmCode
    realm_code = Element("realmCode")
    realm_code.set("code", "US")
    elements.append(realm_code)

    # 2. typeId
    type_id = Element("typeId")
    type_id.set("root", "2.16.840.1.113883.1.3")
    type_id.set("extension", "POCD_HD000040")
    elements.append(type_id)

    # 3. templateId (US Realm Header)
    template_id_header = Element("templateId")
    template_id_header.set("root", TEMPLATE_US_REALM_HEADER_R21.split(":")[0])
    template_id_header.set("extension", TEMPLATE_US_REALM_HEADER_R21.split(":")[1])
    elements.append(template_id_header)

    # 4. templateId (CCD)
    template_id_ccd = Element("templateId")
    template_id_ccd.set("root", TEMPLATE_CCD_R21.split(":")[0])
    template_id_ccd.set("extension", TEMPLATE_CCD_R21.split(":")[1])
    elements.append(template_id_ccd)

    # 5. id (document unique identifier)
    id_elem = Element("id")
    id_elem.set("root", doc_id)
    elements.append(id_elem)

    # 6. code (document type)
    code = Element("code")
    code.set("code", DOCUMENT_TYPE_CODE)
    code.set("codeSystem", DOCUMENT_TYPE_CODE_SYSTEM)
    code.set("codeSystemName", DOCUMENT_TYPE_CODE_SYSTEM_NAME)
    code.set("displayName", DOCUMENT_TYPE_DISPLAY)
    elements.append(code)

    # 7. title
    title = Element("title")
    title.text = "Continuity of Care Document"
    elements.append(title)

    # 8. effectiveTime
    effective_time_elem = Element("effectiveTime")
    effective_time_elem.set("value", _format_datetime(eff_time))
    elements.append(effective_time_elem)

    # 9. confidentialityCode
    confidentiality = Element("confidentialityCode")
    confidentiality.set("code", CONFIDENTIALITY_NORMAL)
    confidentiality.set("codeSystem", "2.16.840.1.113883.5.25")
    confidentiality.set("displayName", "Normal")
    elements.append(confidentiality)

    # 10. languageCode
    language_code = Element("languageCode")
    language_code.set("code", "en-US")
    elements.append(language_code)

    # 11. setId (document set identifier - optional)
    set_id = Element("setId")
    set_id.set("root", doc_id)
    elements.append(set_id)

    # 12. versionNumber
    version_number = Element("versionNumber")
    version_number.set("value", "1")
    elements.append(version_number)

    # 13. recordTarget (patient demographics)
    record_target = _create_record_target(patient)
    elements.append(record_target)

    # 14. author (document creator)
    author = _create_author(author_info, eff_time)
    elements.append(author)

    # 15. custodian (document custodian)
    custodian = _create_custodian(custodian_info)
    elements.append(custodian)

    # 16. documentationOf (service event - optional)
    if encounter_info:
        documentation_of = _create_documentation_of(encounter_info)
        elements.append(documentation_of)

    return elements


def _create_record_target(patient: Patient) -> Element:
    """
    Create recordTarget element with patient demographics.

    Args:
        patient: Patient model instance

    Returns:
        lxml Element for recordTarget
    """
    record_target = Element("recordTarget")

    # patientRole
    patient_role = SubElement(record_target, "patientRole")

    # id - MRN
    id_mrn = SubElement(patient_role, "id")
    id_mrn.set("root", "2.16.840.1.113883.3.HMIS.MRN")  # HMIS MRN OID
    id_mrn.set("extension", patient.mrn)

    # id - Document number (cedula, passport, etc.)
    if patient.document_number:
        id_doc = SubElement(patient_role, "id")
        doc_type_oid_map = {
            "cedula": "2.16.840.1.113883.3.HMIS.CEDULA",
            "passport": "2.16.840.1.113883.4.330",  # Passport OID
            "driver_license": "2.16.840.1.113883.4.3.13",  # Driver's license
        }
        id_doc.set("root", doc_type_oid_map.get(patient.document_type, "2.16.840.1.113883.3.HMIS.ID"))
        id_doc.set("extension", patient.document_number)

    # addr - Address
    if patient.address_line1:
        addr = _format_address({
            "streetAddressLine": patient.address_line1,
            "streetAddressLine2": patient.address_line2,
            "city": patient.city,
            "state": patient.state_province,
            "postalCode": patient.postal_code,
            "country": patient.country or "DO",
        })
        patient_role.append(addr)

    # telecom - Phone
    if patient.mobile_phone or patient.phone:
        telecom_phone = _format_telecom({
            "value": f"tel:{patient.mobile_phone or patient.phone}",
            "use": "HP",  # Home phone / primary
        })
        patient_role.append(telecom_phone)

    # telecom - Email
    if patient.email:
        telecom_email = _format_telecom({
            "value": f"mailto:{patient.email}",
            "use": "WP",  # Work place
        })
        patient_role.append(telecom_email)

    # patient
    patient_elem = SubElement(patient_role, "patient")

    # name
    name = _format_name(
        given=patient.first_name,
        family=patient.last_name,
        family2=patient.second_last_name,
    )
    patient_elem.append(name)

    # administrativeGenderCode
    gender_code = SubElement(patient_elem, "administrativeGenderCode")
    gender_map = {"M": "M", "F": "F", "otro": "UN"}  # UN = Undifferentiated
    gender_code.set("code", gender_map.get(patient.gender, "UN"))
    gender_code.set("codeSystem", OID_ADMINISTRATIVE_GENDER)
    gender_code.set("displayName", {"M": "Male", "F": "Female"}.get(patient.gender, "Undifferentiated"))

    # birthTime
    birth_time = SubElement(patient_elem, "birthTime")
    birth_time.set("value", _format_date(patient.birth_date))

    # maritalStatusCode (optional)
    # Not in current schema, skip

    # raceCode (optional)
    # Not in current schema, skip

    # ethnicGroupCode (optional)
    # Not in current schema, skip

    # birthplace (optional)
    # Could add if needed

    return record_target


def _create_author(author_info: dict, time: datetime) -> Element:
    """
    Create author element with provider information.

    Args:
        author_info: Author details dictionary
        time: Author time (document creation)

    Returns:
        lxml Element for author
    """
    author = Element("author")

    # time
    time_elem = SubElement(author, "time")
    time_elem.set("value", _format_datetime(time))

    # assignedAuthor
    assigned_author = SubElement(author, "assignedAuthor")

    # id
    id_elem = SubElement(assigned_author, "id")
    id_elem.set("root", author_info.get("id_root", "2.16.840.1.113883.3.HMIS.PROVIDER"))
    id_elem.set("extension", author_info.get("id", "unknown"))

    # addr
    if "organization_addr" in author_info:
        addr = _format_address(author_info["organization_addr"])
        assigned_author.append(addr)

    # telecom
    if "organization_telecom" in author_info:
        telecom = _format_telecom(author_info["organization_telecom"])
        assigned_author.append(telecom)

    # assignedPerson
    assigned_person = SubElement(assigned_author, "assignedPerson")
    person_name = _format_name(
        given=author_info.get("given_name", "Provider"),
        family=author_info.get("family_name", "HMIS"),
        prefix=author_info.get("prefix"),
    )
    assigned_person.append(person_name)

    # representedOrganization
    if "organization_name" in author_info:
        org = SubElement(assigned_author, "representedOrganization")

        # id
        org_id = SubElement(org, "id")
        org_id.set("root", "2.16.840.1.113883.3.HMIS.ORG")
        org_id.set("extension", author_info.get("organization_id", "org001"))

        # name
        org_name = SubElement(org, "name")
        org_name.text = author_info.get("organization_name")

        # telecom
        if "organization_telecom" in author_info:
            org_telecom = _format_telecom(author_info["organization_telecom"])
            org.append(org_telecom)

        # addr
        if "organization_addr" in author_info:
            org_addr = _format_address(author_info["organization_addr"])
            org.append(org_addr)

    return author


def _create_custodian(custodian_info: dict) -> Element:
    """
    Create custodian element with organization information.

    Args:
        custodian_info: Custodian organization details

    Returns:
        lxml Element for custodian
    """
    custodian = Element("custodian")

    # assignedCustodian
    assigned_custodian = SubElement(custodian, "assignedCustodian")

    # representedCustodianOrganization
    org = SubElement(assigned_custodian, "representedCustodianOrganization")

    # id
    id_elem = SubElement(org, "id")
    id_elem.set("root", custodian_info.get("id_root", "2.16.840.1.113883.3.HMIS.ORG"))
    id_elem.set("extension", custodian_info.get("id", "org001"))

    # name
    name = SubElement(org, "name")
    name.text = custodian_info.get("name", "HMIS Healthcare Organization")

    # telecom
    if "telecom" in custodian_info:
        telecom = _format_telecom(custodian_info["telecom"])
        org.append(telecom)

    # addr
    if "addr" in custodian_info:
        addr = _format_address(custodian_info["addr"])
        org.append(addr)

    return custodian


def _create_documentation_of(encounter_info: dict) -> Element:
    """
    Create documentationOf element with service event (encounter).

    Args:
        encounter_info: Encounter details

    Returns:
        lxml Element for documentationOf
    """
    documentation_of = Element("documentationOf")

    # serviceEvent
    service_event = SubElement(documentation_of, "serviceEvent")
    service_event.set("classCode", "PCPR")  # Care provision

    # effectiveTime
    effective_time = SubElement(service_event, "effectiveTime")

    # low (start time)
    low = SubElement(effective_time, "low")
    if "start_time" in encounter_info and encounter_info["start_time"]:
        low.set("value", _format_datetime(encounter_info["start_time"]))
    else:
        low.set("nullFlavor", "UNK")

    # high (end time)
    if "end_time" in encounter_info and encounter_info["end_time"]:
        high = SubElement(effective_time, "high")
        high.set("value", _format_datetime(encounter_info["end_time"]))

    # performer (attending physician - optional)
    # Could add if provider info available in encounter

    return documentation_of


def _format_address(addr_dict: dict) -> Element:
    """
    Format address dictionary into CDA addr element.

    Args:
        addr_dict: Address details (streetAddressLine, city, state, postalCode, country)

    Returns:
        lxml Element for addr
    """
    addr = Element("addr")
    addr.set("use", "HP")  # Home address / primary

    # streetAddressLine
    if "streetAddressLine" in addr_dict and addr_dict["streetAddressLine"]:
        street = SubElement(addr, "streetAddressLine")
        street.text = addr_dict["streetAddressLine"]

    # streetAddressLine2 (optional)
    if "streetAddressLine2" in addr_dict and addr_dict["streetAddressLine2"]:
        street2 = SubElement(addr, "streetAddressLine")
        street2.text = addr_dict["streetAddressLine2"]

    # city
    if "city" in addr_dict and addr_dict["city"]:
        city = SubElement(addr, "city")
        city.text = addr_dict["city"]

    # state
    if "state" in addr_dict and addr_dict["state"]:
        state = SubElement(addr, "state")
        state.text = addr_dict["state"]

    # postalCode
    if "postalCode" in addr_dict and addr_dict["postalCode"]:
        postal_code = SubElement(addr, "postalCode")
        postal_code.text = addr_dict["postalCode"]

    # country
    if "country" in addr_dict and addr_dict["country"]:
        country = SubElement(addr, "country")
        country.text = addr_dict["country"]

    return addr


def _format_telecom(telecom_dict: dict) -> Element:
    """
    Format telecom dictionary into CDA telecom element.

    Args:
        telecom_dict: Telecom details (value, use)

    Returns:
        lxml Element for telecom
    """
    telecom = Element("telecom")

    # value (e.g., "tel:+1-809-555-0100", "mailto:email@example.com")
    if "value" in telecom_dict:
        telecom.set("value", telecom_dict["value"])

    # use (HP=home, WP=work, MC=mobile)
    if "use" in telecom_dict:
        telecom.set("use", telecom_dict["use"])

    return telecom


def _format_name(
    given: str,
    family: str,
    family2: str | None = None,
    prefix: str | None = None,
) -> Element:
    """
    Format name into CDA name element.

    Args:
        given: Given name (first name)
        family: Family name (last name)
        family2: Optional second family name (Latin American naming)
        prefix: Optional prefix (Dr., etc.)

    Returns:
        lxml Element for name
    """
    name = Element("name")
    name.set("use", "L")  # Legal name

    # prefix (optional)
    if prefix:
        prefix_elem = SubElement(name, "prefix")
        prefix_elem.text = prefix

    # given
    given_elem = SubElement(name, "given")
    given_elem.text = given

    # family (first last name)
    family_elem = SubElement(name, "family")
    family_elem.text = family

    # family (second last name - Latin American naming)
    if family2:
        family2_elem = SubElement(name, "family")
        family2_elem.text = family2

    return name


def _format_datetime(dt: datetime) -> str:
    """
    Format datetime for CDA effectiveTime/time elements.

    Args:
        dt: Python datetime object

    Returns:
        String in CDA datetime format (YYYYMMDDHHmmss+0000)
    """
    # Ensure UTC timezone
    if dt.tzinfo is None:
        dt = pytz.UTC.localize(dt)
    else:
        dt = dt.astimezone(pytz.UTC)

    # Format: YYYYMMDDHHmmss+0000
    return dt.strftime("%Y%m%d%H%M%S+0000")


def _format_date(date_obj) -> str:
    """
    Format date for CDA birthTime elements.

    Args:
        date_obj: Python date object

    Returns:
        String in CDA date format (YYYYMMDD)
    """
    return date_obj.strftime("%Y%m%d")
