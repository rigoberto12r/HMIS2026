"""
C-CDA Clinical Sections Generator.

Generates all required and optional CCD clinical sections:
- Allergies and Intolerances
- Medications
- Problem List
- Vital Signs
- Results (Labs)
- Procedures
"""

from datetime import datetime
from uuid import uuid4

import pytz
from lxml.etree import Element, SubElement, CDATA

from app.modules.ccda.templates import (
    ACT_STATUS_ACTIVE,
    ACT_STATUS_COMPLETED,
    LOINC_ALLERGIES,
    LOINC_MEDICATIONS,
    LOINC_PROBLEMS,
    LOINC_PROCEDURES,
    LOINC_RESULTS,
    LOINC_VITAL_SIGNS,
    NULL_FLAVOR_NI,
    OID_ICD10_CM,
    OID_LOINC,
    OID_RXNORM,
    OID_SNOMED_CT,
    TEMPLATE_ALLERGIES_SECTION_R21,
    TEMPLATE_ALLERGY_CONCERN_ACT_R21,
    TEMPLATE_ALLERGY_INTOLERANCE_OBS_R21,
    TEMPLATE_MEDICATION_ACTIVITY_R21,
    TEMPLATE_MEDICATIONS_SECTION_R21,
    TEMPLATE_PROBLEM_CONCERN_ACT_R21,
    TEMPLATE_PROBLEM_OBSERVATION_R21,
    TEMPLATE_PROBLEM_SECTION_R21,
    TEMPLATE_PROCEDURES_SECTION_R21,
    TEMPLATE_RESULT_OBSERVATION_R21,
    TEMPLATE_RESULT_ORGANIZER_R21,
    TEMPLATE_RESULTS_SECTION_R21,
    TEMPLATE_VITAL_SIGN_OBSERVATION_R21,
    TEMPLATE_VITAL_SIGNS_ORGANIZER_R21,
    TEMPLATE_VITAL_SIGNS_SECTION_R21,
    URN_UCUM,
)
from app.modules.emr.models import Allergy, Diagnosis, PatientProblemList, VitalSigns
from app.modules.pharmacy.models import Prescription


def generate_allergies_section(allergies: list[Allergy]) -> Element:
    """
    Generate Allergies and Intolerances Section.

    Template: 2.16.840.1.113883.10.20.22.2.6.1:2015-08-01
    LOINC: 48765-2

    Args:
        allergies: List of Allergy models

    Returns:
        lxml Element for allergies section
    """
    section = Element("section")

    # templateId
    template_id = SubElement(section, "templateId")
    template_id.set("root", TEMPLATE_ALLERGIES_SECTION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_ALLERGIES_SECTION_R21.split(":")[1])

    # code
    code = SubElement(section, "code")
    code.set("code", LOINC_ALLERGIES)
    code.set("codeSystem", OID_LOINC)
    code.set("codeSystemName", "LOINC")
    code.set("displayName", "Allergies and Adverse Reactions")

    # title
    title = SubElement(section, "title")
    title.text = "Allergies and Adverse Reactions"

    # text - narrative block
    text = SubElement(section, "text")
    if allergies:
        table = _create_allergy_table(allergies)
        text.append(table)
    else:
        para = SubElement(text, "paragraph")
        para.text = "No known allergies"

    # entries - structured data
    if allergies:
        for allergy in allergies:
            entry = _create_allergy_entry(allergy)
            section.append(entry)
    else:
        # No known allergies entry
        entry = SubElement(section, "entry")
        entry.set("typeCode", "DRIV")
        act = SubElement(entry, "act")
        act.set("classCode", "ACT")
        act.set("moodCode", "EVN")
        act.set("negationInd", "true")

        # templateId
        template_id_act = SubElement(act, "templateId")
        template_id_act.set("root", TEMPLATE_ALLERGY_CONCERN_ACT_R21.split(":")[0])

        # code
        code_act = SubElement(act, "code")
        code_act.set("code", "CONC")
        code_act.set("codeSystem", "2.16.840.1.113883.5.6")

        # statusCode
        status_code = SubElement(act, "statusCode")
        status_code.set("code", "completed")

        # No known allergies observation
        entry_rel = SubElement(act, "entryRelationship")
        entry_rel.set("typeCode", "SUBJ")
        obs = SubElement(entry_rel, "observation")
        obs.set("classCode", "OBS")
        obs.set("moodCode", "EVN")
        obs.set("negationInd", "true")

        # templateId
        template_id_obs = SubElement(obs, "templateId")
        template_id_obs.set("root", TEMPLATE_ALLERGY_INTOLERANCE_OBS_R21.split(":")[0])

        # code
        code_obs = SubElement(obs, "code")
        code_obs.set("code", "ASSERTION")
        code_obs.set("codeSystem", "2.16.840.1.113883.5.4")

        # statusCode
        status_code_obs = SubElement(obs, "statusCode")
        status_code_obs.set("code", "completed")

        # value - no known allergies
        value = SubElement(obs, "value")
        value.set("{http://www.w3.org/2001/XMLSchema-instance}type", "CD")
        value.set("code", "419199007")
        value.set("codeSystem", OID_SNOMED_CT)
        value.set("displayName", "Allergy to substance")
        value.set("nullFlavor", "NA")

    return section


def _create_allergy_table(allergies: list[Allergy]) -> Element:
    """Create HTML table for allergy narrative."""
    table = Element("table")
    table.set("border", "1")
    table.set("width", "100%")

    # Header
    thead = SubElement(table, "thead")
    tr = SubElement(thead, "tr")
    for header in ["Substance", "Reaction", "Severity", "Status"]:
        th = SubElement(tr, "th")
        th.text = header

    # Body
    tbody = SubElement(table, "tbody")
    for allergy in allergies:
        tr = SubElement(tbody, "tr")

        # Substance
        td_substance = SubElement(tr, "td")
        td_substance.text = allergy.allergen_name

        # Reaction
        td_reaction = SubElement(tr, "td")
        td_reaction.text = allergy.reaction or "Not specified"

        # Severity
        td_severity = SubElement(tr, "td")
        td_severity.text = allergy.severity or "Unknown"

        # Status
        td_status = SubElement(tr, "td")
        td_status.text = allergy.status.capitalize() if allergy.status else "Active"

    return table


def _create_allergy_entry(allergy: Allergy) -> Element:
    """Create structured allergy entry."""
    entry = Element("entry")
    entry.set("typeCode", "DRIV")

    # Allergy Concern Act
    act = SubElement(entry, "act")
    act.set("classCode", "ACT")
    act.set("moodCode", "EVN")

    # templateId
    template_id = SubElement(act, "templateId")
    template_id.set("root", TEMPLATE_ALLERGY_CONCERN_ACT_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_ALLERGY_CONCERN_ACT_R21.split(":")[1])

    # id
    id_elem = SubElement(act, "id")
    id_elem.set("root", str(allergy.id))

    # code
    code = SubElement(act, "code")
    code.set("code", "CONC")
    code.set("codeSystem", "2.16.840.1.113883.5.6")
    code.set("displayName", "Concern")

    # statusCode
    status_code = SubElement(act, "statusCode")
    status_code.set("code", ACT_STATUS_ACTIVE if allergy.status == "active" else ACT_STATUS_COMPLETED)

    # effectiveTime
    effective_time = SubElement(act, "effectiveTime")
    low = SubElement(effective_time, "low")
    if allergy.onset_date:
        low.set("value", _format_date(allergy.onset_date))
    else:
        low.set("nullFlavor", "UNK")

    # Allergy Intolerance Observation
    entry_rel = SubElement(act, "entryRelationship")
    entry_rel.set("typeCode", "SUBJ")

    obs = SubElement(entry_rel, "observation")
    obs.set("classCode", "OBS")
    obs.set("moodCode", "EVN")

    # templateId
    template_id_obs = SubElement(obs, "templateId")
    template_id_obs.set("root", TEMPLATE_ALLERGY_INTOLERANCE_OBS_R21.split(":")[0])
    template_id_obs.set("extension", TEMPLATE_ALLERGY_INTOLERANCE_OBS_R21.split(":")[1])

    # id
    id_obs = SubElement(obs, "id")
    id_obs.set("root", str(uuid4()))

    # code
    code_obs = SubElement(obs, "code")
    code_obs.set("code", "ASSERTION")
    code_obs.set("codeSystem", "2.16.840.1.113883.5.4")

    # statusCode
    status_code_obs = SubElement(obs, "statusCode")
    status_code_obs.set("code", "completed")

    # effectiveTime
    effective_time_obs = SubElement(obs, "effectiveTime")
    if allergy.onset_date:
        effective_time_obs.set("value", _format_date(allergy.onset_date))
    else:
        effective_time_obs.set("nullFlavor", "UNK")

    # value - allergy type
    value = SubElement(obs, "value")
    value.set("{http://www.w3.org/2001/XMLSchema-instance}type", "CD")
    value.set("code", "419199007")  # Allergy to substance
    value.set("codeSystem", OID_SNOMED_CT)
    value.set("displayName", "Allergy to substance")

    # participant - allergen
    participant = SubElement(obs, "participant")
    participant.set("typeCode", "CSM")
    participant_role = SubElement(participant, "participantRole")
    participant_role.set("classCode", "MANU")

    playing_entity = SubElement(participant_role, "playingEntity")
    playing_entity.set("classCode", "MMAT")

    code_allergen = SubElement(playing_entity, "code")
    code_allergen.set("code", "SNOMED_CODE")  # Would need actual SNOMED code mapping
    code_allergen.set("codeSystem", OID_SNOMED_CT)
    code_allergen.set("displayName", allergy.allergen_name)

    name = SubElement(playing_entity, "name")
    name.text = allergy.allergen_name

    return entry


def generate_medications_section(prescriptions: list[Prescription]) -> Element:
    """
    Generate Medications Section.

    Template: 2.16.840.1.113883.10.20.22.2.1.1:2014-06-09
    LOINC: 10160-0

    Args:
        prescriptions: List of Prescription models

    Returns:
        lxml Element for medications section
    """
    section = Element("section")

    # templateId
    template_id = SubElement(section, "templateId")
    template_id.set("root", TEMPLATE_MEDICATIONS_SECTION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_MEDICATIONS_SECTION_R21.split(":")[1])

    # code
    code = SubElement(section, "code")
    code.set("code", LOINC_MEDICATIONS)
    code.set("codeSystem", OID_LOINC)
    code.set("codeSystemName", "LOINC")
    code.set("displayName", "History of Medication Use")

    # title
    title = SubElement(section, "title")
    title.text = "Medications"

    # text
    text = SubElement(section, "text")
    if prescriptions:
        table = _create_medication_table(prescriptions)
        text.append(table)
    else:
        para = SubElement(text, "paragraph")
        para.text = "No medications"

    # entries
    if prescriptions:
        for prescription in prescriptions:
            entry = _create_medication_entry(prescription)
            section.append(entry)

    return section


def _create_medication_table(prescriptions: list[Prescription]) -> Element:
    """Create HTML table for medication narrative."""
    table = Element("table")
    table.set("border", "1")
    table.set("width", "100%")

    # Header
    thead = SubElement(table, "thead")
    tr = SubElement(thead, "tr")
    for header in ["Medication", "Dosage", "Route", "Frequency", "Status"]:
        th = SubElement(tr, "th")
        th.text = header

    # Body
    tbody = SubElement(table, "tbody")
    for rx in prescriptions:
        tr = SubElement(tbody, "tr")

        # Medication
        td_med = SubElement(tr, "td")
        td_med.text = rx.medication_name

        # Dosage
        td_dose = SubElement(tr, "td")
        dose_text = f"{rx.dosage_amount} {rx.dosage_unit}" if rx.dosage_amount and rx.dosage_unit else "Not specified"
        td_dose.text = dose_text

        # Route
        td_route = SubElement(tr, "td")
        td_route.text = rx.route or "Not specified"

        # Frequency
        td_freq = SubElement(tr, "td")
        td_freq.text = rx.frequency or "Not specified"

        # Status
        td_status = SubElement(tr, "td")
        td_status.text = rx.status.capitalize() if rx.status else "Active"

    return table


def _create_medication_entry(prescription: Prescription) -> Element:
    """Create structured medication entry."""
    entry = Element("entry")
    entry.set("typeCode", "DRIV")

    # Medication Activity (substanceAdministration)
    subst_admin = SubElement(entry, "substanceAdministration")
    subst_admin.set("classCode", "SBADM")
    subst_admin.set("moodCode", "EVN")

    # templateId
    template_id = SubElement(subst_admin, "templateId")
    template_id.set("root", TEMPLATE_MEDICATION_ACTIVITY_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_MEDICATION_ACTIVITY_R21.split(":")[1])

    # id
    id_elem = SubElement(subst_admin, "id")
    id_elem.set("root", str(prescription.id))

    # statusCode
    status_code = SubElement(subst_admin, "statusCode")
    status_map = {
        "active": "active",
        "completed": "completed",
        "discontinued": "aborted",
        "cancelled": "cancelled",
    }
    status_code.set("code", status_map.get(prescription.status, "active"))

    # effectiveTime (frequency)
    if prescription.frequency:
        effective_time = SubElement(subst_admin, "effectiveTime")
        effective_time.set("{http://www.w3.org/2001/XMLSchema-instance}type", "IVL_TS")
        low = SubElement(effective_time, "low")
        if prescription.created_at:
            low.set("value", _format_datetime(prescription.created_at))

    # routeCode
    if prescription.route:
        route_code = SubElement(subst_admin, "routeCode")
        route_map = {
            "oral": "26643006",
            "sublingual": "37839007",
            "topical": "6064005",
            "intravenous": "47625008",
            "intramuscular": "78421000",
            "subcutaneous": "34206005",
        }
        route_code.set("code", route_map.get(prescription.route.lower(), "26643006"))
        route_code.set("codeSystem", OID_SNOMED_CT)
        route_code.set("displayName", prescription.route)

    # doseQuantity
    if prescription.dosage_amount and prescription.dosage_unit:
        dose_quantity = SubElement(subst_admin, "doseQuantity")
        dose_quantity.set("value", str(prescription.dosage_amount))
        dose_quantity.set("unit", prescription.dosage_unit)

    # consumable
    consumable = SubElement(subst_admin, "consumable")
    manufactured_product = SubElement(consumable, "manufacturedProduct")
    manufactured_product.set("classCode", "MANU")

    # templateId
    template_id_prod = SubElement(manufactured_product, "templateId")
    template_id_prod.set("root", "2.16.840.1.113883.10.20.22.4.23")

    # manufacturedMaterial
    manufactured_material = SubElement(manufactured_product, "manufacturedMaterial")

    # code (RxNorm)
    code = SubElement(manufactured_material, "code")
    code.set("code", "RXNORM_CODE")  # Would need actual RxNorm mapping
    code.set("codeSystem", OID_RXNORM)
    code.set("displayName", prescription.medication_name)

    name = SubElement(manufactured_material, "name")
    name.text = prescription.medication_name

    return entry


def generate_problems_section(
    diagnoses: list[Diagnosis],
    problems: list[PatientProblemList],
) -> Element:
    """
    Generate Problem List Section.

    Combines encounter diagnoses and chronic problem list items.

    Template: 2.16.840.1.113883.10.20.22.2.5.1:2015-08-01
    LOINC: 11450-4

    Args:
        diagnoses: List of Diagnosis models (encounter diagnoses)
        problems: List of PatientProblemList models (chronic problems)

    Returns:
        lxml Element for problems section
    """
    section = Element("section")

    # templateId
    template_id = SubElement(section, "templateId")
    template_id.set("root", TEMPLATE_PROBLEM_SECTION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_PROBLEM_SECTION_R21.split(":")[1])

    # code
    code = SubElement(section, "code")
    code.set("code", LOINC_PROBLEMS)
    code.set("codeSystem", OID_LOINC)
    code.set("codeSystemName", "LOINC")
    code.set("displayName", "Problem List")

    # title
    title = SubElement(section, "title")
    title.text = "Problem List"

    # text
    text = SubElement(section, "text")
    all_problems = list(diagnoses) + list(problems)
    if all_problems:
        table = _create_problem_table(diagnoses, problems)
        text.append(table)
    else:
        para = SubElement(text, "paragraph")
        para.text = "No active problems"

    # entries - diagnoses
    for diagnosis in diagnoses:
        entry = _create_problem_entry(diagnosis, is_chronic=False)
        section.append(entry)

    # entries - chronic problems
    for problem in problems:
        entry = _create_problem_entry(problem, is_chronic=True)
        section.append(entry)

    return section


def _create_problem_table(diagnoses: list[Diagnosis], problems: list[PatientProblemList]) -> Element:
    """Create HTML table for problem narrative."""
    table = Element("table")
    table.set("border", "1")
    table.set("width", "100%")

    # Header
    thead = SubElement(table, "thead")
    tr = SubElement(thead, "tr")
    for header in ["Condition", "ICD-10 Code", "Status", "Onset Date", "Type"]:
        th = SubElement(tr, "th")
        th.text = header

    # Body
    tbody = SubElement(table, "tbody")

    # Diagnoses
    for diagnosis in diagnoses:
        tr = SubElement(tbody, "tr")

        td_cond = SubElement(tr, "td")
        td_cond.text = diagnosis.description

        td_code = SubElement(tr, "td")
        td_code.text = diagnosis.icd10_code

        td_status = SubElement(tr, "td")
        td_status.text = diagnosis.status.capitalize() if diagnosis.status else "Active"

        td_onset = SubElement(tr, "td")
        if diagnosis.diagnosis_date:
            td_onset.text = diagnosis.diagnosis_date.strftime("%Y-%m-%d")
        else:
            td_onset.text = "Unknown"

        td_type = SubElement(tr, "td")
        td_type.text = "Encounter Diagnosis"

    # Chronic problems
    for problem in problems:
        tr = SubElement(tbody, "tr")

        td_cond = SubElement(tr, "td")
        td_cond.text = problem.problem_description

        td_code = SubElement(tr, "td")
        td_code.text = problem.icd10_code

        td_status = SubElement(tr, "td")
        td_status.text = problem.status.capitalize() if problem.status else "Active"

        td_onset = SubElement(tr, "td")
        if problem.onset_date:
            td_onset.text = problem.onset_date.strftime("%Y-%m-%d")
        else:
            td_onset.text = "Unknown"

        td_type = SubElement(tr, "td")
        td_type.text = "Chronic Problem"

    return table


def _create_problem_entry(item, is_chronic: bool) -> Element:
    """Create structured problem entry."""
    entry = Element("entry")
    entry.set("typeCode", "DRIV")

    # Problem Concern Act
    act = SubElement(entry, "act")
    act.set("classCode", "ACT")
    act.set("moodCode", "EVN")

    # templateId
    template_id = SubElement(act, "templateId")
    template_id.set("root", TEMPLATE_PROBLEM_CONCERN_ACT_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_PROBLEM_CONCERN_ACT_R21.split(":")[1])

    # id
    id_elem = SubElement(act, "id")
    id_elem.set("root", str(item.id))

    # code
    code = SubElement(act, "code")
    code.set("code", "CONC")
    code.set("codeSystem", "2.16.840.1.113883.5.6")

    # statusCode
    status_code = SubElement(act, "statusCode")
    item_status = item.status if hasattr(item, "status") else "active"
    status_code.set("code", ACT_STATUS_ACTIVE if item_status == "active" else ACT_STATUS_COMPLETED)

    # effectiveTime
    effective_time = SubElement(act, "effectiveTime")
    low = SubElement(effective_time, "low")
    onset_date = item.onset_date if hasattr(item, "onset_date") else item.diagnosis_date if hasattr(item, "diagnosis_date") else None
    if onset_date:
        low.set("value", _format_date(onset_date))
    else:
        low.set("nullFlavor", "UNK")

    # Problem Observation
    entry_rel = SubElement(act, "entryRelationship")
    entry_rel.set("typeCode", "SUBJ")

    obs = SubElement(entry_rel, "observation")
    obs.set("classCode", "OBS")
    obs.set("moodCode", "EVN")

    # templateId
    template_id_obs = SubElement(obs, "templateId")
    template_id_obs.set("root", TEMPLATE_PROBLEM_OBSERVATION_R21.split(":")[0])
    template_id_obs.set("extension", TEMPLATE_PROBLEM_OBSERVATION_R21.split(":")[1])

    # id
    id_obs = SubElement(obs, "id")
    id_obs.set("root", str(uuid4()))

    # code
    code_obs = SubElement(obs, "code")
    if is_chronic:
        code_obs.set("code", "75326-9")  # Problem
        code_obs.set("displayName", "Problem")
    else:
        code_obs.set("code", "282291009")  # Diagnosis
        code_obs.set("displayName", "Diagnosis")
    code_obs.set("codeSystem", OID_LOINC)

    # statusCode
    status_code_obs = SubElement(obs, "statusCode")
    status_code_obs.set("code", "completed")

    # effectiveTime
    effective_time_obs = SubElement(obs, "effectiveTime")
    if onset_date:
        effective_time_obs.set("value", _format_date(onset_date))

    # value (ICD-10 code)
    value = SubElement(obs, "value")
    value.set("{http://www.w3.org/2001/XMLSchema-instance}type", "CD")
    icd10_code = item.icd10_code if hasattr(item, "icd10_code") else "UNKNOWN"
    description = item.problem_description if hasattr(item, "problem_description") else item.description
    value.set("code", icd10_code)
    value.set("codeSystem", OID_ICD10_CM)
    value.set("displayName", description)

    return entry


def generate_vitals_section(vital_signs: list[VitalSigns]) -> Element:
    """
    Generate Vital Signs Section.

    Template: 2.16.840.1.113883.10.20.22.2.4.1:2015-08-01
    LOINC: 8716-3

    Args:
        vital_signs: List of VitalSigns models

    Returns:
        lxml Element for vital signs section
    """
    section = Element("section")

    # templateId
    template_id = SubElement(section, "templateId")
    template_id.set("root", TEMPLATE_VITAL_SIGNS_SECTION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_VITAL_SIGNS_SECTION_R21.split(":")[1])

    # code
    code = SubElement(section, "code")
    code.set("code", LOINC_VITAL_SIGNS)
    code.set("codeSystem", OID_LOINC)
    code.set("codeSystemName", "LOINC")
    code.set("displayName", "Vital Signs")

    # title
    title = SubElement(section, "title")
    title.text = "Vital Signs"

    # text
    text = SubElement(section, "text")
    if vital_signs:
        table = _create_vitals_table(vital_signs)
        text.append(table)
    else:
        para = SubElement(text, "paragraph")
        para.text = "No vital signs recorded"

    # entries
    for vs in vital_signs:
        entry = _create_vitals_organizer(vs)
        section.append(entry)

    return section


def _create_vitals_table(vital_signs: list[VitalSigns]) -> Element:
    """Create HTML table for vitals narrative."""
    table = Element("table")
    table.set("border", "1")
    table.set("width", "100%")

    # Header
    thead = SubElement(table, "thead")
    tr = SubElement(thead, "tr")
    headers = ["Date/Time", "Temp (°C)", "HR (bpm)", "BP (mmHg)", "RR (/min)", "SpO2 (%)", "Weight (kg)", "Height (cm)"]
    for header in headers:
        th = SubElement(tr, "th")
        th.text = header

    # Body
    tbody = SubElement(table, "tbody")
    for vs in vital_signs:
        tr = SubElement(tbody, "tr")

        # Date/Time
        td_time = SubElement(tr, "td")
        if vs.measured_at:
            td_time.text = vs.measured_at.strftime("%Y-%m-%d %H:%M")
        else:
            td_time.text = "Unknown"

        # Temperature
        td_temp = SubElement(tr, "td")
        td_temp.text = str(vs.temperature) if vs.temperature else "-"

        # Heart Rate
        td_hr = SubElement(tr, "td")
        td_hr.text = str(vs.heart_rate) if vs.heart_rate else "-"

        # Blood Pressure
        td_bp = SubElement(tr, "td")
        if vs.blood_pressure_sys and vs.blood_pressure_dia:
            td_bp.text = f"{vs.blood_pressure_sys}/{vs.blood_pressure_dia}"
        else:
            td_bp.text = "-"

        # Respiratory Rate
        td_rr = SubElement(tr, "td")
        td_rr.text = str(vs.respiratory_rate) if vs.respiratory_rate else "-"

        # SpO2
        td_spo2 = SubElement(tr, "td")
        td_spo2.text = str(vs.oxygen_saturation) if vs.oxygen_saturation else "-"

        # Weight
        td_weight = SubElement(tr, "td")
        td_weight.text = str(vs.weight) if vs.weight else "-"

        # Height
        td_height = SubElement(tr, "td")
        td_height.text = str(vs.height) if vs.height else "-"

    return table


def _create_vitals_organizer(vs: VitalSigns) -> Element:
    """Create vital signs organizer with observations."""
    entry = Element("entry")
    entry.set("typeCode", "DRIV")

    # Vital Signs Organizer
    organizer = SubElement(entry, "organizer")
    organizer.set("classCode", "CLUSTER")
    organizer.set("moodCode", "EVN")

    # templateId
    template_id = SubElement(organizer, "templateId")
    template_id.set("root", TEMPLATE_VITAL_SIGNS_ORGANIZER_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_VITAL_SIGNS_ORGANIZER_R21.split(":")[1])

    # id
    id_elem = SubElement(organizer, "id")
    id_elem.set("root", str(vs.id))

    # code
    code = SubElement(organizer, "code")
    code.set("code", "46680005")
    code.set("codeSystem", OID_SNOMED_CT)
    code.set("displayName", "Vital signs")

    # statusCode
    status_code = SubElement(organizer, "statusCode")
    status_code.set("code", "completed")

    # effectiveTime
    effective_time = SubElement(organizer, "effectiveTime")
    if vs.measured_at:
        effective_time.set("value", _format_datetime(vs.measured_at))

    # Add individual vital sign observations
    vital_map = [
        ("8310-5", "Body Temperature", vs.temperature, "Cel"),
        ("8867-4", "Heart Rate", vs.heart_rate, "/min"),
        ("9279-1", "Respiratory Rate", vs.respiratory_rate, "/min"),
        ("2708-6", "Oxygen Saturation", vs.oxygen_saturation, "%"),
        ("29463-7", "Body Weight", vs.weight, "kg"),
        ("8302-2", "Body Height", vs.height, "cm"),
        ("39156-5", "Body Mass Index", vs.bmi, "kg/m2"),
        ("38208-5", "Pain Scale", vs.pain_scale, "{score}"),
    ]

    for loinc_code, display_name, value, unit in vital_map:
        if value is not None:
            component = _create_vital_observation(loinc_code, display_name, value, unit, vs.measured_at)
            organizer.append(component)

    # Blood pressure (special handling - panel)
    if vs.blood_pressure_sys or vs.blood_pressure_dia:
        component_sys = _create_vital_observation("8480-6", "Systolic Blood Pressure", vs.blood_pressure_sys, "mm[Hg]", vs.measured_at)
        organizer.append(component_sys)

        component_dia = _create_vital_observation("8462-4", "Diastolic Blood Pressure", vs.blood_pressure_dia, "mm[Hg]", vs.measured_at)
        organizer.append(component_dia)

    return entry


def _create_vital_observation(loinc_code: str, display_name: str, value: float | int, unit: str, measured_at: datetime) -> Element:
    """Create individual vital sign observation component."""
    component = Element("component")

    obs = SubElement(component, "observation")
    obs.set("classCode", "OBS")
    obs.set("moodCode", "EVN")

    # templateId
    template_id = SubElement(obs, "templateId")
    template_id.set("root", TEMPLATE_VITAL_SIGN_OBSERVATION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_VITAL_SIGN_OBSERVATION_R21.split(":")[1])

    # id
    id_elem = SubElement(obs, "id")
    id_elem.set("root", str(uuid4()))

    # code
    code = SubElement(obs, "code")
    code.set("code", loinc_code)
    code.set("codeSystem", OID_LOINC)
    code.set("displayName", display_name)

    # statusCode
    status_code = SubElement(obs, "statusCode")
    status_code.set("code", "completed")

    # effectiveTime
    effective_time = SubElement(obs, "effectiveTime")
    if measured_at:
        effective_time.set("value", _format_datetime(measured_at))

    # value
    value_elem = SubElement(obs, "value")
    value_elem.set("{http://www.w3.org/2001/XMLSchema-instance}type", "PQ")
    value_elem.set("value", str(value))
    value_elem.set("unit", unit)

    return component


def generate_results_section(vital_signs: list[VitalSigns]) -> Element:
    """
    Generate Results Section (Laboratory Results).

    Currently includes glucose from vital signs as a lab result.
    Future: Full lab results from LIS module.

    Template: 2.16.840.1.113883.10.20.22.2.3.1:2015-08-01
    LOINC: 30954-2

    Args:
        vital_signs: List of VitalSigns models (for glucose)

    Returns:
        lxml Element for results section
    """
    section = Element("section")

    # templateId
    template_id = SubElement(section, "templateId")
    template_id.set("root", TEMPLATE_RESULTS_SECTION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_RESULTS_SECTION_R21.split(":")[1])

    # code
    code = SubElement(section, "code")
    code.set("code", LOINC_RESULTS)
    code.set("codeSystem", OID_LOINC)
    code.set("codeSystemName", "LOINC")
    code.set("displayName", "Relevant Diagnostic Tests and/or Laboratory Data")

    # title
    title = SubElement(section, "title")
    title.text = "Results"

    # text
    text = SubElement(section, "text")
    glucose_results = [vs for vs in vital_signs if vs.glucose is not None]
    if glucose_results:
        table = _create_results_table(glucose_results)
        text.append(table)
    else:
        para = SubElement(text, "paragraph")
        para.text = "No laboratory results"

    # entries
    for vs in glucose_results:
        entry = _create_result_organizer(vs)
        section.append(entry)

    return section


def _create_results_table(vital_signs: list[VitalSigns]) -> Element:
    """Create HTML table for results narrative."""
    table = Element("table")
    table.set("border", "1")
    table.set("width", "100%")

    # Header
    thead = SubElement(table, "thead")
    tr = SubElement(thead, "tr")
    for header in ["Date/Time", "Test", "Result", "Unit", "Reference Range"]:
        th = SubElement(tr, "th")
        th.text = header

    # Body
    tbody = SubElement(table, "tbody")
    for vs in vital_signs:
        if vs.glucose:
            tr = SubElement(tbody, "tr")

            # Date/Time
            td_time = SubElement(tr, "td")
            if vs.measured_at:
                td_time.text = vs.measured_at.strftime("%Y-%m-%d %H:%M")
            else:
                td_time.text = "Unknown"

            # Test
            td_test = SubElement(tr, "td")
            td_test.text = "Glucose"

            # Result
            td_result = SubElement(tr, "td")
            td_result.text = str(vs.glucose)

            # Unit
            td_unit = SubElement(tr, "td")
            td_unit.text = "mg/dL"

            # Reference Range
            td_range = SubElement(tr, "td")
            td_range.text = "70-100 mg/dL (fasting)"

    return table


def _create_result_organizer(vs: VitalSigns) -> Element:
    """Create result organizer for glucose."""
    entry = Element("entry")
    entry.set("typeCode", "DRIV")

    # Result Organizer
    organizer = SubElement(entry, "organizer")
    organizer.set("classCode", "BATTERY")
    organizer.set("moodCode", "EVN")

    # templateId
    template_id = SubElement(organizer, "templateId")
    template_id.set("root", TEMPLATE_RESULT_ORGANIZER_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_RESULT_ORGANIZER_R21.split(":")[1])

    # id
    id_elem = SubElement(organizer, "id")
    id_elem.set("root", str(vs.id))

    # code
    code = SubElement(organizer, "code")
    code.set("code", "2339-0")  # Glucose panel
    code.set("codeSystem", OID_LOINC)
    code.set("displayName", "Glucose")

    # statusCode
    status_code = SubElement(organizer, "statusCode")
    status_code.set("code", "completed")

    # effectiveTime
    effective_time = SubElement(organizer, "effectiveTime")
    if vs.measured_at:
        effective_time.set("value", _format_datetime(vs.measured_at))

    # component - glucose observation
    if vs.glucose:
        component = _create_result_observation("2339-0", "Glucose", vs.glucose, "mg/dL", vs.measured_at)
        organizer.append(component)

    return entry


def _create_result_observation(loinc_code: str, display_name: str, value: float, unit: str, measured_at: datetime) -> Element:
    """Create individual result observation component."""
    component = Element("component")

    obs = SubElement(component, "observation")
    obs.set("classCode", "OBS")
    obs.set("moodCode", "EVN")

    # templateId
    template_id = SubElement(obs, "templateId")
    template_id.set("root", TEMPLATE_RESULT_OBSERVATION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_RESULT_OBSERVATION_R21.split(":")[1])

    # id
    id_elem = SubElement(obs, "id")
    id_elem.set("root", str(uuid4()))

    # code
    code = SubElement(obs, "code")
    code.set("code", loinc_code)
    code.set("codeSystem", OID_LOINC)
    code.set("displayName", display_name)

    # statusCode
    status_code = SubElement(obs, "statusCode")
    status_code.set("code", "final")

    # effectiveTime
    effective_time = SubElement(obs, "effectiveTime")
    if measured_at:
        effective_time.set("value", _format_datetime(measured_at))

    # value
    value_elem = SubElement(obs, "value")
    value_elem.set("{http://www.w3.org/2001/XMLSchema-instance}type", "PQ")
    value_elem.set("value", str(value))
    value_elem.set("unit", unit)

    # referenceRange
    ref_range = SubElement(obs, "referenceRange")
    obs_range = SubElement(ref_range, "observationRange")

    # text
    text = SubElement(obs_range, "text")
    text.text = "70-100 mg/dL (fasting)"

    return component


def generate_procedures_section() -> Element:
    """
    Generate Procedures Section.

    Currently empty placeholder (no procedure data in schema).
    Future: Implement when procedures module is added.

    Template: 2.16.840.1.113883.10.20.22.2.7.1:2014-06-09
    LOINC: 47519-4

    Returns:
        lxml Element for procedures section with nullFlavor
    """
    section = Element("section")

    # templateId
    template_id = SubElement(section, "templateId")
    template_id.set("root", TEMPLATE_PROCEDURES_SECTION_R21.split(":")[0])
    template_id.set("extension", TEMPLATE_PROCEDURES_SECTION_R21.split(":")[1])

    # code
    code = SubElement(section, "code")
    code.set("code", LOINC_PROCEDURES)
    code.set("codeSystem", OID_LOINC)
    code.set("codeSystemName", "LOINC")
    code.set("displayName", "History of Procedures")

    # title
    title = SubElement(section, "title")
    title.text = "Procedures"

    # text with nullFlavor
    text = SubElement(section, "text")
    para = SubElement(text, "paragraph")
    para.text = "No procedure information available"

    # entry with nullFlavor
    entry = SubElement(section, "entry")
    entry.set("nullFlavor", NULL_FLAVOR_NI)

    return section


# Helper functions


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
    Format date for CDA date elements.

    Args:
        date_obj: Python date object

    Returns:
        String in CDA date format (YYYYMMDD)
    """
    if isinstance(date_obj, datetime):
        return date_obj.strftime("%Y%m%d")
    return date_obj.strftime("%Y%m%d")
