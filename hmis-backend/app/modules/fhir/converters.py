"""
Bidirectional FHIR R4 converters using fhir.resources library.

Converts between internal HMIS models and validated FHIR resources.
"""

from datetime import date
from typing import Any
from uuid import UUID

from fhir.resources.address import Address
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.codeablereference import CodeableReference
from fhir.resources.coding import Coding
from fhir.resources.contactpoint import ContactPoint
from fhir.resources.encounter import Encounter as FHIREncounter, EncounterAdmission, EncounterDiagnosis, EncounterParticipant, EncounterReason
from fhir.resources.humanname import HumanName
from fhir.resources.identifier import Identifier
from fhir.resources.observation import Observation as FHIRObservation
from fhir.resources.patient import Patient as FHIRPatient
from fhir.resources.period import Period
from fhir.resources.quantity import Quantity
from fhir.resources.reference import Reference

from app.modules.patients.models import Patient
from app.shared.exceptions import ValidationError


def patient_to_fhir(patient: Patient, base_url: str = "http://localhost:8000/api/v1/fhir") -> FHIRPatient:
    """
    Convert internal Patient model to FHIR Patient resource.

    Args:
        patient: Internal Patient model
        base_url: Base URL for resource references

    Returns:
        Validated FHIR Patient resource
    """
    # Map gender codes (internal M/F/otro -> FHIR male/female/other/unknown)
    gender_map = {"M": "male", "F": "female", "otro": "other"}
    fhir_gender = gender_map.get(patient.gender, "unknown")

    # Build identifiers
    identifiers = [
        Identifier(
            system="urn:hmis:mrn",
            value=patient.mrn,
            use="official",
        ),
        Identifier(
            system=f"urn:hmis:document:{patient.document_type}",
            value=patient.document_number,
            use="secondary",
        ),
    ]

    # Build name
    names = [
        HumanName(
            use="official",
            family=patient.last_name,
            given=[patient.first_name],
        )
    ]

    # Build telecom (contact points)
    telecom = []
    if patient.phone:
        telecom.append(ContactPoint(system="phone", value=patient.phone, use="home"))
    if patient.mobile_phone:
        telecom.append(ContactPoint(system="phone", value=patient.mobile_phone, use="mobile"))
    if patient.email:
        telecom.append(ContactPoint(system="email", value=patient.email))

    # Build address
    addresses = []
    if patient.address_line1:
        address_lines = [patient.address_line1]
        if patient.address_line2:
            address_lines.append(patient.address_line2)

        addresses.append(
            Address(
                use="home",
                line=address_lines,
                city=patient.city,
                state=patient.state_province,
                postalCode=patient.postal_code,
                country=patient.country,
            )
        )

    # Map status (internal active/inactive/deceased -> FHIR active boolean and deceasedBoolean)
    active = patient.status == "active" and patient.is_active
    deceased_boolean = patient.status == "deceased"

    # Build FHIR Patient
    fhir_patient = FHIRPatient(
        id=str(patient.id),
        identifier=identifiers,
        active=active,
        name=names,
        telecom=telecom if telecom else None,
        gender=fhir_gender,
        birthDate=patient.birth_date,
        deceasedBoolean=deceased_boolean if deceased_boolean else None,
        address=addresses if addresses else None,
    )

    return fhir_patient


def fhir_to_patient_data(fhir_patient: FHIRPatient) -> dict[str, Any]:
    """
    Convert FHIR Patient resource to internal Patient data dict.

    Args:
        fhir_patient: FHIR Patient resource (validated)

    Returns:
        Dictionary suitable for creating/updating internal Patient model

    Raises:
        ValidationError: If required FHIR fields are missing
    """
    # Validate required fields
    if not fhir_patient.name or len(fhir_patient.name) == 0:
        raise ValidationError("FHIR Patient must have at least one name")

    if not fhir_patient.identifier or len(fhir_patient.identifier) == 0:
        raise ValidationError("FHIR Patient must have at least one identifier")

    if not fhir_patient.birthDate:
        raise ValidationError("FHIR Patient must have birthDate")

    # Extract name (use first official name, or first name if no official)
    official_names = [n for n in fhir_patient.name if n.use == "official"]
    name = official_names[0] if official_names else fhir_patient.name[0]

    first_name = name.given[0] if name.given and len(name.given) > 0 else "Unknown"
    last_name = name.family if name.family else "Unknown"

    # Map gender (FHIR male/female/other/unknown -> internal M/F/otro)
    gender_map = {"male": "M", "female": "F", "other": "otro", "unknown": "otro"}
    gender = gender_map.get(fhir_patient.gender or "unknown", "otro")

    # Extract identifiers
    # Look for MRN (urn:hmis:mrn) and document (urn:hmis:document:*)
    mrn = None
    document_type = None
    document_number = None

    for identifier in fhir_patient.identifier:
        if identifier.system == "urn:hmis:mrn":
            mrn = identifier.value
        elif identifier.system and identifier.system.startswith("urn:hmis:document:"):
            document_type = identifier.system.split(":")[-1]
            document_number = identifier.value

    # If no HMIS-specific identifiers, use first identifier as document
    if not document_type or not document_number:
        first_id = fhir_patient.identifier[0]
        document_type = "other"
        document_number = first_id.value

    # Extract contact info
    phone = None
    mobile_phone = None
    email = None

    if fhir_patient.telecom:
        for contact in fhir_patient.telecom:
            if contact.system == "phone":
                if contact.use == "mobile":
                    mobile_phone = contact.value
                else:
                    phone = contact.value
            elif contact.system == "email":
                email = contact.value

    # Extract address
    address_line1 = None
    address_line2 = None
    city = None
    state_province = None
    postal_code = None
    country = "DO"  # Default

    if fhir_patient.address and len(fhir_patient.address) > 0:
        address = fhir_patient.address[0]
        if address.line and len(address.line) > 0:
            address_line1 = address.line[0]
            if len(address.line) > 1:
                address_line2 = address.line[1]
        city = address.city
        state_province = address.state
        postal_code = address.postalCode
        country = address.country or "DO"

    # Determine status
    status = "active"
    if fhir_patient.deceasedBoolean:
        status = "deceased"
    elif not fhir_patient.active:
        status = "inactive"

    # Build internal patient data
    patient_data = {
        "first_name": first_name,
        "last_name": last_name,
        "birth_date": fhir_patient.birthDate,
        "gender": gender,
        "document_type": document_type,
        "document_number": document_number,
        "status": status,
        "phone": phone,
        "mobile_phone": mobile_phone,
        "email": email,
        "address_line1": address_line1,
        "address_line2": address_line2,
        "city": city,
        "state_province": state_province,
        "postal_code": postal_code,
        "country": country,
    }

    # Include MRN if provided (for updates)
    if mrn:
        patient_data["mrn"] = mrn

    return patient_data


def validate_fhir_patient(data: dict[str, Any]) -> FHIRPatient:
    """
    Validate and parse FHIR Patient JSON.

    Args:
        data: Raw FHIR Patient JSON dict

    Returns:
        Validated FHIR Patient resource

    Raises:
        ValidationError: If FHIR validation fails
    """
    try:
        return FHIRPatient(**data)
    except Exception as e:
        raise ValidationError(f"Invalid FHIR Patient resource: {str(e)}")


# ============================================================================
# ENCOUNTER CONVERTERS
# ============================================================================


def encounter_to_fhir(encounter: Any, base_url: str = "http://localhost:8000/api/v1/fhir") -> FHIREncounter:
    """
    Convert internal Encounter model to FHIR Encounter resource.

    Args:
        encounter: Internal Encounter model
        base_url: Base URL for resource references

    Returns:
        Validated FHIR Encounter resource
    """
    # Map status (internal -> FHIR)
    status_map = {
        "in_progress": "in-progress",
        "completed": "finished",
        "cancelled": "cancelled",
    }
    fhir_status = status_map.get(encounter.status, "unknown")

    # Map encounter type (internal -> FHIR ActCode)
    type_map = {
        "ambulatory": "AMB",
        "emergency": "EMER",
        "inpatient": "IMP",
    }
    type_code = type_map.get(encounter.encounter_type, "AMB")

    # Build encounter type CodeableConcept
    encounter_type = [
        CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    code=type_code,
                    display=encounter.encounter_type.title() if encounter.encounter_type else "Ambulatory",
                )
            ]
        )
    ]

    # Build period
    period = Period(
        start=encounter.start_datetime,
        end=encounter.end_datetime if encounter.end_datetime else None,
    )

    # Build subject (patient reference)
    subject = Reference(reference=f"Patient/{encounter.patient_id}")

    # Build participant (provider)
    participant = []
    if encounter.provider_id:
        participant.append(
            EncounterParticipant(
                actor=Reference(reference=f"Practitioner/{encounter.provider_id}")
            )
        )

    # Build reason (chief complaint)
    reason_list = None
    if encounter.chief_complaint:
        reason_list = [
            EncounterReason(
                value=[
                    CodeableReference(
                        concept=CodeableConcept(
                            text=encounter.chief_complaint
                        )
                    )
                ]
            )
        ]

    # Build diagnosis list (if diagnoses are loaded)
    diagnosis_list = None
    if hasattr(encounter, "diagnoses") and encounter.diagnoses:
        diagnosis_list = []
        for diag in encounter.diagnoses:
            # Map diagnosis type to use code
            use_map = {
                "principal": "AD",  # Admission diagnosis
                "secondary": "DD",  # Discharge diagnosis
                "complication": "CM",  # Complication
            }
            use_code = use_map.get(diag.diagnosis_type, "DD")

            diagnosis_list.append(
                EncounterDiagnosis(
                    condition=[
                        CodeableReference(
                            reference=Reference(reference=f"Condition/{diag.id}")
                        )
                    ],
                    use=[
                        CodeableConcept(
                            coding=[
                                Coding(
                                    system="http://terminology.hl7.org/CodeSystem/diagnosis-role",
                                    code=use_code,
                                )
                            ]
                        )
                    ],
                )
            )

    # Build admission (hospitalization) details (if applicable)
    admission = None
    if encounter.disposition:
        # Map disposition to FHIR discharge disposition
        disposition_map = {
            "alta": "home",
            "hospitalizacion": "hosp",
            "referencia": "other-hcf",
            "defuncion": "exp",
        }
        disposition_code = disposition_map.get(encounter.disposition, "oth")

        admission = EncounterAdmission(
            dischargeDisposition=CodeableConcept(
                coding=[
                    Coding(
                        system="http://terminology.hl7.org/CodeSystem/discharge-disposition",
                        code=disposition_code,
                        display=encounter.disposition.title(),
                    )
                ]
            )
        )

    # Build appointment reference (if linked)
    appointment = None
    if hasattr(encounter, "appointment_id") and encounter.appointment_id:
        appointment = [Reference(reference=f"Appointment/{encounter.appointment_id}")]

    # Build location reference (if available)
    location = None
    if hasattr(encounter, "location_id") and encounter.location_id:
        location = [
            {
                "location": Reference(reference=f"Location/{encounter.location_id}")
            }
        ]

    # Build FHIR Encounter
    fhir_encounter = FHIREncounter(
        id=str(encounter.id),
        status=fhir_status,
        class_fhir=[
            CodeableConcept(
                coding=[
                    Coding(
                        system="http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        code=type_code,
                    )
                ]
            )
        ],
        type=encounter_type,
        subject=subject,
        participant=participant if participant else None,
        actualPeriod=period,  # Use actualPeriod for the time period
        reason=reason_list,
        diagnosis=diagnosis_list,
        admission=admission,
        appointment=appointment,
        location=location,
    )

    return fhir_encounter


def fhir_to_encounter_data(fhir_encounter: FHIREncounter) -> dict[str, Any]:
    """
    Convert FHIR Encounter resource to internal Encounter data dict.

    Args:
        fhir_encounter: FHIR Encounter resource (validated)

    Returns:
        Dictionary suitable for creating/updating internal Encounter model

    Raises:
        ValidationError: If required FHIR fields are missing
    """
    # Validate required fields
    if not fhir_encounter.subject:
        raise ValidationError("FHIR Encounter must have a subject (patient reference)")

    # Check for period in either actualPeriod or plannedStartDate
    period = fhir_encounter.actualPeriod if hasattr(fhir_encounter, 'actualPeriod') and fhir_encounter.actualPeriod else None
    if not period or not period.start:
        if not fhir_encounter.plannedStartDate:
            raise ValidationError("FHIR Encounter must have actualPeriod.start or plannedStartDate")

    # Extract patient ID from reference
    patient_ref = fhir_encounter.subject.reference
    if not patient_ref or "/" not in patient_ref:
        raise ValidationError("Invalid patient reference format")

    try:
        patient_id = UUID(patient_ref.split("/")[-1])
    except ValueError:
        raise ValidationError(f"Invalid patient UUID in reference: {patient_ref}")

    # Map FHIR status to internal
    status_map = {
        "in-progress": "in_progress",
        "finished": "completed",
        "cancelled": "cancelled",
        "planned": "in_progress",  # Map planned to in_progress
        "arrived": "in_progress",  # Map arrived to in_progress
    }
    status = status_map.get(fhir_encounter.status, "in_progress")

    # Extract encounter type from class or type
    encounter_type = "ambulatory"  # Default
    if fhir_encounter.class_fhir and len(fhir_encounter.class_fhir) > 0:
        # class_fhir is list[CodeableConcept]
        class_concept = fhir_encounter.class_fhir[0]
        if class_concept.coding and len(class_concept.coding) > 0:
            type_map = {
                "AMB": "ambulatory",
                "EMER": "emergency",
                "IMP": "inpatient",
            }
            encounter_type = type_map.get(class_concept.coding[0].code, "ambulatory")

    # Extract provider ID from participant
    provider_id = None
    if fhir_encounter.participant:
        for participant in fhir_encounter.participant:
            if participant.actor and participant.actor.reference:
                ref = participant.actor.reference
                if "Practitioner/" in ref:
                    try:
                        provider_id = UUID(ref.split("/")[-1])
                        break
                    except ValueError:
                        pass

    # Extract chief complaint from reason
    chief_complaint = None
    if fhir_encounter.reason:
        # reason is list[EncounterReason]
        for reason_item in fhir_encounter.reason:
            if reason_item.value:
                # value is list[CodeableReference]
                for codeable_ref in reason_item.value:
                    if codeable_ref.concept:
                        # concept is CodeableConcept
                        if codeable_ref.concept.text:
                            chief_complaint = codeable_ref.concept.text
                            break
                        elif codeable_ref.concept.coding:
                            chief_complaint = codeable_ref.concept.coding[0].display
                            break
            if chief_complaint:
                break

    # Extract disposition from admission
    disposition = None
    if fhir_encounter.admission and fhir_encounter.admission.dischargeDisposition:
        discharge_disp = fhir_encounter.admission.dischargeDisposition
        if discharge_disp.coding:
            code = discharge_disp.coding[0].code
            disposition_map = {
                "home": "alta",
                "hosp": "hospitalizacion",
                "other-hcf": "referencia",
                "exp": "defuncion",
            }
            disposition = disposition_map.get(code, discharge_disp.coding[0].display)

    # Extract appointment ID
    appointment_id = None
    if fhir_encounter.appointment and len(fhir_encounter.appointment) > 0:
        ref = fhir_encounter.appointment[0].reference
        if ref and "Appointment/" in ref:
            try:
                appointment_id = UUID(ref.split("/")[-1])
            except ValueError:
                pass

    # Extract location ID
    location_id = None
    if fhir_encounter.location and len(fhir_encounter.location) > 0:
        if hasattr(fhir_encounter.location[0], "location"):
            ref = fhir_encounter.location[0].location.reference
            if ref and "Location/" in ref:
                try:
                    location_id = UUID(ref.split("/")[-1])
                except ValueError:
                    pass

    # Extract start/end datetime from actualPeriod or plannedStartDate
    start_datetime = None
    end_datetime = None
    if period:
        start_datetime = period.start
        end_datetime = period.end if period.end else None
    elif fhir_encounter.plannedStartDate:
        start_datetime = fhir_encounter.plannedStartDate

    # Build internal encounter data
    encounter_data = {
        "patient_id": patient_id,
        "provider_id": provider_id,
        "encounter_type": encounter_type,
        "status": status,
        "start_datetime": start_datetime,
        "end_datetime": end_datetime,
        "chief_complaint": chief_complaint,
        "disposition": disposition,
        "appointment_id": appointment_id,
        "location_id": location_id,
    }

    return encounter_data


def validate_fhir_encounter(data: dict[str, Any]) -> FHIREncounter:
    """
    Validate and parse FHIR Encounter JSON.

    Args:
        data: Raw FHIR Encounter JSON dict

    Returns:
        Validated FHIR Encounter resource

    Raises:
        ValidationError: If FHIR validation fails
    """
    try:
        return FHIREncounter(**data)
    except Exception as e:
        raise ValidationError(f"Invalid FHIR Encounter resource: {str(e)}")


# ============================================================================
# OBSERVATION CONVERTERS (Vital Signs)
# ============================================================================

# LOINC codes for vital signs (standard codes used in healthcare)
LOINC_CODES = {
    "temperature": "8310-5",  # Body temperature
    "heart_rate": "8867-4",  # Heart rate
    "blood_pressure": "85354-9",  # Blood pressure panel
    "blood_pressure_sys": "8480-6",  # Systolic BP
    "blood_pressure_dia": "8462-4",  # Diastolic BP
    "respiratory_rate": "9279-1",  # Respiratory rate
    "oxygen_saturation": "2708-6",  # Oxygen saturation
    "weight": "29463-7",  # Body weight
    "height": "8302-2",  # Body height
    "bmi": "39156-5",  # Body mass index
    "pain_scale": "72514-3",  # Pain severity
    "glucose": "2339-0",  # Glucose [Mass/volume] in Blood
}


def vital_signs_to_fhir_observations(
    vital_signs: Any, base_url: str = "http://localhost:8000/api/v1/fhir"
) -> list[FHIRObservation]:
    """
    Convert internal VitalSigns to list of FHIR Observation resources.

    In FHIR, each vital sign measurement becomes a separate Observation.
    Blood pressure is a special case with systolic/diastolic as components.

    Args:
        vital_signs: Internal VitalSigns model
        base_url: Base URL for resource references

    Returns:
        List of FHIR Observation resources (one per vital sign present)
    """
    observations = []

    # Common fields for all observations
    subject = Reference(reference=f"Patient/{vital_signs.patient_id}")
    encounter_ref = Reference(reference=f"Encounter/{vital_signs.encounter_id}")
    effective_datetime = vital_signs.measured_at

    # Temperature
    if vital_signs.temperature is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-temp",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                            display="Vital Signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["temperature"],
                        display="Body temperature",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.temperature,
                unit="Cel",
                system="http://unitsofmeasure.org",
                code="Cel",
            ),
        )
        observations.append(obs)

    # Heart Rate
    if vital_signs.heart_rate is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-hr",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["heart_rate"],
                        display="Heart rate",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.heart_rate,
                unit="/min",
                system="http://unitsofmeasure.org",
                code="/min",
            ),
        )
        observations.append(obs)

    # Blood Pressure (special case - panel with components)
    if vital_signs.blood_pressure_sys is not None or vital_signs.blood_pressure_dia is not None:
        components = []

        if vital_signs.blood_pressure_sys is not None:
            components.append({
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": LOINC_CODES["blood_pressure_sys"],
                        "display": "Systolic blood pressure",
                    }]
                },
                "valueQuantity": {
                    "value": vital_signs.blood_pressure_sys,
                    "unit": "mm[Hg]",
                    "system": "http://unitsofmeasure.org",
                    "code": "mm[Hg]",
                },
            })

        if vital_signs.blood_pressure_dia is not None:
            components.append({
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": LOINC_CODES["blood_pressure_dia"],
                        "display": "Diastolic blood pressure",
                    }]
                },
                "valueQuantity": {
                    "value": vital_signs.blood_pressure_dia,
                    "unit": "mm[Hg]",
                    "system": "http://unitsofmeasure.org",
                    "code": "mm[Hg]",
                },
            })

        obs = FHIRObservation(
            id=f"{vital_signs.id}-bp",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["blood_pressure"],
                        display="Blood pressure panel",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            component=components,
        )
        observations.append(obs)

    # Respiratory Rate
    if vital_signs.respiratory_rate is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-rr",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["respiratory_rate"],
                        display="Respiratory rate",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.respiratory_rate,
                unit="/min",
                system="http://unitsofmeasure.org",
                code="/min",
            ),
        )
        observations.append(obs)

    # Oxygen Saturation
    if vital_signs.oxygen_saturation is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-spo2",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["oxygen_saturation"],
                        display="Oxygen saturation",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.oxygen_saturation,
                unit="%",
                system="http://unitsofmeasure.org",
                code="%",
            ),
        )
        observations.append(obs)

    # Weight
    if vital_signs.weight is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-weight",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["weight"],
                        display="Body weight",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.weight,
                unit="kg",
                system="http://unitsofmeasure.org",
                code="kg",
            ),
        )
        observations.append(obs)

    # Height
    if vital_signs.height is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-height",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["height"],
                        display="Body height",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.height,
                unit="cm",
                system="http://unitsofmeasure.org",
                code="cm",
            ),
        )
        observations.append(obs)

    # BMI
    if vital_signs.bmi is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-bmi",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["bmi"],
                        display="Body mass index",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.bmi,
                unit="kg/m2",
                system="http://unitsofmeasure.org",
                code="kg/m2",
            ),
        )
        observations.append(obs)

    # Pain Scale
    if vital_signs.pain_scale is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-pain",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="vital-signs",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["pain_scale"],
                        display="Pain severity",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueInteger=vital_signs.pain_scale,
        )
        observations.append(obs)

    # Glucose
    if vital_signs.glucose is not None:
        obs = FHIRObservation(
            id=f"{vital_signs.id}-glucose",
            status="final",
            category=[
                CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="laboratory",
                            display="Laboratory",
                        )
                    ]
                )
            ],
            code=CodeableConcept(
                coding=[
                    Coding(
                        system="http://loinc.org",
                        code=LOINC_CODES["glucose"],
                        display="Glucose",
                    )
                ]
            ),
            subject=subject,
            encounter=encounter_ref,
            effectiveDateTime=effective_datetime,
            valueQuantity=Quantity(
                value=vital_signs.glucose,
                unit="mg/dL",
                system="http://unitsofmeasure.org",
                code="mg/dL",
            ),
        )
        observations.append(obs)

    return observations


def fhir_observation_to_vital_sign_field(fhir_observation: FHIRObservation) -> tuple[str | None, Any]:
    """
    Extract field name and value from FHIR Observation.

    Since each FHIR Observation contains one measurement, this returns
    the corresponding VitalSigns field name and value.

    Args:
        fhir_observation: FHIR Observation resource

    Returns:
        Tuple of (field_name, value) or (None, None) if not recognized
    """
    if not fhir_observation.code or not fhir_observation.code.coding:
        return (None, None)

    # Get LOINC code
    loinc_code = None
    for coding in fhir_observation.code.coding:
        if coding.system == "http://loinc.org":
            loinc_code = coding.code
            break

    if not loinc_code:
        return (None, None)

    # Map LOINC code to field
    loinc_to_field = {v: k for k, v in LOINC_CODES.items()}

    if loinc_code not in loinc_to_field:
        return (None, None)

    field_name = loinc_to_field[loinc_code]

    # Extract value based on field type
    if field_name == "blood_pressure":
        # Blood pressure panel - extract components
        if not fhir_observation.component:
            return (None, None)

        sys_value = None
        dia_value = None

        for component in fhir_observation.component:
            if component.code and component.code.coding:
                comp_code = component.code.coding[0].code
                if comp_code == LOINC_CODES["blood_pressure_sys"]:
                    sys_value = component.valueQuantity.value if component.valueQuantity else None
                elif comp_code == LOINC_CODES["blood_pressure_dia"]:
                    dia_value = component.valueQuantity.value if component.valueQuantity else None

        return ("blood_pressure", {"sys": sys_value, "dia": dia_value})

    elif field_name == "pain_scale":
        # Pain scale uses valueInteger
        if fhir_observation.valueInteger is not None:
            return (field_name, fhir_observation.valueInteger)
    else:
        # Most vitals use valueQuantity
        if fhir_observation.valueQuantity:
            return (field_name, fhir_observation.valueQuantity.value)

    return (None, None)


def validate_fhir_observation(data: dict[str, Any]) -> FHIRObservation:
    """
    Validate and parse FHIR Observation JSON.

    Args:
        data: Raw FHIR Observation JSON dict

    Returns:
        Validated FHIR Observation resource

    Raises:
        ValidationError: If FHIR validation fails
    """
    try:
        return FHIRObservation(**data)
    except Exception as e:
        raise ValidationError(f"Invalid FHIR Observation resource: {str(e)}")


# =============================================
# Condition Resource Converters
# =============================================

def diagnosis_to_fhir_condition(diagnosis) -> "FHIRCondition":
    """
    Convert internal Diagnosis to FHIR Condition resource.
    
    Maps encounter-based diagnoses to FHIR Condition with encounter-diagnosis category.
    
    Args:
        diagnosis: Diagnosis model instance
        
    Returns:
        FHIR Condition resource
    """
    from fhir.resources.condition import Condition as FHIRCondition
    from fhir.resources.codeableconcept import CodeableConcept
    from fhir.resources.coding import Coding
    from fhir.resources.reference import Reference
    from fhir.resources.annotation import Annotation
    
    # Map internal status to FHIR clinical status
    clinical_status_map = {
        "active": "active",
        "resolved": "resolved",
        "chronic": "active",  # Chronic is still clinically active
        "inactive": "inactive",
    }
    clinical_status = clinical_status_map.get(diagnosis.status, "active")
    
    # Build Condition resource
    condition_data = {
        "id": str(diagnosis.id),
        "clinicalStatus": CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/condition-clinical",
                    code=clinical_status,
                )
            ]
        ),
        "verificationStatus": CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    code="confirmed",  # All diagnoses in EMR are confirmed
                )
            ]
        ),
        "category": [
            CodeableConcept(
                coding=[
                    Coding(
                        system="http://terminology.hl7.org/CodeSystem/condition-category",
                        code="encounter-diagnosis",
                        display="Encounter Diagnosis",
                    )
                ]
            )
        ],
        "code": CodeableConcept(
            coding=[
                Coding(
                    system="http://hl7.org/fhir/sid/icd-10",
                    code=diagnosis.icd10_code,
                    display=diagnosis.description,
                )
            ],
            text=diagnosis.description,
        ),
        "subject": Reference(reference=f"Patient/{diagnosis.encounter.patient_id}"),
        "encounter": Reference(reference=f"Encounter/{diagnosis.encounter_id}"),
        "recordedDate": diagnosis.created_at.isoformat() if diagnosis.created_at else None,
    }
    
    # Add onset date if present
    if diagnosis.onset_date:
        condition_data["onsetDateTime"] = diagnosis.onset_date.isoformat()
    
    # Add abatement (resolution) date if resolved
    if diagnosis.resolved_date:
        condition_data["abatementDateTime"] = diagnosis.resolved_date.isoformat()
    
    # Add notes if present
    if diagnosis.notes:
        condition_data["note"] = [Annotation(text=diagnosis.notes)]
    
    return FHIRCondition(**condition_data)


def problem_list_to_fhir_condition(problem) -> "FHIRCondition":
    """
    Convert internal PatientProblemList to FHIR Condition resource.
    
    Maps patient-level problem list items to FHIR Condition with problem-list-item category.
    
    Args:
        problem: PatientProblemList model instance
        
    Returns:
        FHIR Condition resource
    """
    from fhir.resources.condition import Condition as FHIRCondition
    from fhir.resources.codeableconcept import CodeableConcept
    from fhir.resources.coding import Coding
    from fhir.resources.reference import Reference
    from fhir.resources.annotation import Annotation
    
    # Map internal status to FHIR clinical status
    clinical_status_map = {
        "active": "active",
        "resolved": "resolved",
        "inactive": "inactive",
    }
    clinical_status = clinical_status_map.get(problem.status, "active")
    
    # Build Condition resource
    condition_data = {
        "id": str(problem.id),
        "clinicalStatus": CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/condition-clinical",
                    code=clinical_status,
                )
            ]
        ),
        "verificationStatus": CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    code="confirmed",  # All problems in problem list are confirmed
                )
            ]
        ),
        "category": [
            CodeableConcept(
                coding=[
                    Coding(
                        system="http://terminology.hl7.org/CodeSystem/condition-category",
                        code="problem-list-item",
                        display="Problem List Item",
                    )
                ]
            )
        ],
        "code": CodeableConcept(
            coding=[
                Coding(
                    system="http://hl7.org/fhir/sid/icd-10",
                    code=problem.icd10_code,
                    display=problem.description,
                )
            ],
            text=problem.description,
        ),
        "subject": Reference(reference=f"Patient/{problem.patient_id}"),
        "recordedDate": problem.created_at.isoformat() if problem.created_at else None,
    }
    
    # Add onset date if present
    if problem.onset_date:
        condition_data["onsetDateTime"] = problem.onset_date.isoformat()
    
    # Add notes if present
    if problem.notes:
        condition_data["note"] = [Annotation(text=problem.notes)]
    
    return FHIRCondition(**condition_data)


def validate_fhir_condition(data: dict[str, Any]) -> "FHIRCondition":
    """
    Validate and parse FHIR Condition JSON.
    
    Args:
        data: Raw FHIR Condition JSON dict
        
    Returns:
        Validated FHIR Condition resource
        
    Raises:
        ValidationError: If FHIR validation fails
    """
    from fhir.resources.condition import Condition as FHIRCondition
    
    try:
        return FHIRCondition(**data)
    except Exception as e:
        raise ValidationError(f"Invalid FHIR Condition resource: {str(e)}")


# =============================================
# MedicationRequest Resource Converters
# =============================================

# Route code mappings (SNOMED CT)
ROUTE_CODES = {
    "oral": {"code": "26643006", "display": "Oral route"},
    "IV": {"code": "47625008", "display": "Intravenous route"},
    "IM": {"code": "78421000", "display": "Intramuscular route"},
    "topico": {"code": "6064005", "display": "Topical route"},
    "subcutanea": {"code": "34206005", "display": "Subcutaneous route"},
    "rectal": {"code": "37161004", "display": "Rectal route"},
    "inhalacion": {"code": "447694001", "display": "Respiratory tract route"},
}


def prescription_to_fhir_medication_request(prescription) -> "FHIRMedicationRequest":
    """
    Convert internal Prescription to FHIR MedicationRequest resource.
    
    Maps pharmacy prescriptions to FHIR MedicationRequest with proper dosage instructions.
    
    Args:
        prescription: Prescription model instance
        
    Returns:
        FHIR MedicationRequest resource
    """
    from fhir.resources.medicationrequest import MedicationRequest as FHIRMedicationRequest
    from fhir.resources.dosage import Dosage
    from fhir.resources.codeableconcept import CodeableConcept
    from fhir.resources.coding import Coding
    from fhir.resources.reference import Reference
    from fhir.resources.annotation import Annotation
    
    # Map internal status to FHIR status
    status_map = {
        "active": "active",
        "dispensed": "completed",
        "partially_dispensed": "active",
        "cancelled": "cancelled",
        "expired": "stopped",
    }
    fhir_status = status_map.get(prescription.status, "active")
    
    # Build dosage instruction
    dosage_instruction = Dosage(
        text=f"{prescription.dosage} {prescription.frequency}",
        route=_map_route_to_coding(prescription.route),
    )
    
    # Add timing if duration is specified
    if prescription.duration_days:
        dosage_instruction.text += f" por {prescription.duration_days} días"
    
    # Add patient instructions if present
    if prescription.instructions:
        dosage_instruction.patientInstruction = prescription.instructions
    
    # Build MedicationRequest resource
    medication_request_data = {
        "id": str(prescription.id),
        "status": fhir_status,
        "intent": "order",  # All prescriptions are medication orders
        "medicationCodeableConcept": CodeableConcept(
            text=prescription.medication_name
        ),
        "subject": Reference(reference=f"Patient/{prescription.patient_id}"),
        "encounter": Reference(reference=f"Encounter/{prescription.encounter_id}"),
        "authoredOn": prescription.created_at.isoformat() if prescription.created_at else None,
        "requester": Reference(reference=f"Practitioner/{prescription.prescribed_by}"),
        "dosageInstruction": [dosage_instruction],
        "dispenseRequest": {
            "numberOfRepeatsAllowed": 0,  # No refills by default
            "quantity": {
                "value": prescription.quantity_prescribed,
                "unit": "unit",  # Could be enhanced with actual units
            },
        },
        "substitution": {
            "allowedBoolean": prescription.substitution_allowed,
        },
    }
    
    # Add notes if there are alerts
    if prescription.alerts_json:
        notes = []
        if prescription.alerts_json.get("allergy_warning"):
            notes.append(Annotation(text="ALERT: Patient has drug allergies. Check alerts_json for details."))
        if prescription.alerts_json.get("interaction_warning"):
            notes.append(Annotation(text="ALERT: Potential drug interactions detected."))
        if notes:
            medication_request_data["note"] = notes
    
    return FHIRMedicationRequest(**medication_request_data)


def _map_route_to_coding(route: str) -> CodeableConcept:
    """
    Map internal route string to FHIR CodeableConcept with SNOMED CT codes.
    
    Args:
        route: Internal route string (oral, IV, IM, etc.)
        
    Returns:
        FHIR CodeableConcept with SNOMED CT coding
    """
    from fhir.resources.codeableconcept import CodeableConcept
    from fhir.resources.coding import Coding
    
    route_lower = route.lower()
    route_info = ROUTE_CODES.get(route_lower, {"code": "26643006", "display": "Oral route"})
    
    return CodeableConcept(
        coding=[
            Coding(
                system="http://snomed.info/sct",
                code=route_info["code"],
                display=route_info["display"],
            )
        ],
        text=route,
    )


def validate_fhir_medication_request(data: dict[str, Any]) -> "FHIRMedicationRequest":
    """
    Validate and parse FHIR MedicationRequest JSON.
    
    Args:
        data: Raw FHIR MedicationRequest JSON dict
        
    Returns:
        Validated FHIR MedicationRequest resource
        
    Raises:
        ValidationError: If FHIR validation fails
    """
    from fhir.resources.medicationrequest import MedicationRequest as FHIRMedicationRequest
    
    try:
        return FHIRMedicationRequest(**data)
    except Exception as e:
        raise ValidationError(f"Invalid FHIR MedicationRequest resource: {str(e)}")


# =============================================
# AllergyIntolerance Resource Converters
# =============================================

def allergy_to_fhir_allergy_intolerance(allergy) -> "FHIRAllergyIntolerance":
    """
    Convert internal Allergy to FHIR AllergyIntolerance resource.
    
    Maps patient allergies to FHIR AllergyIntolerance with proper categorization.
    
    Args:
        allergy: Allergy model instance
        
    Returns:
        FHIR AllergyIntolerance resource
    """
    from fhir.resources.allergyintolerance import AllergyIntolerance as FHIRAllergyIntolerance
    from fhir.resources.codeableconcept import CodeableConcept
    from fhir.resources.coding import Coding
    from fhir.resources.reference import Reference
    from fhir.resources.allergyintolerancereaction import AllergyIntoleranceReaction
    
    # Map allergen_type to FHIR category
    category_map = {
        "drug": "medication",
        "food": "food",
        "environment": "environment",
        "latex": "environment",
        "other": "biologic",
    }
    category = category_map.get(allergy.allergen_type, "biologic")
    
    # Map severity
    severity_map = {
        "mild": "mild",
        "moderate": "moderate",
        "severe": "severe",
        "life_threatening": "severe",  # FHIR doesn't have life_threatening, map to severe
    }
    fhir_severity = severity_map.get(allergy.severity, "moderate")
    
    # Map clinical status
    clinical_status_map = {
        "active": "active",
        "inactive": "inactive",
    }
    clinical_status = clinical_status_map.get(allergy.status, "active")
    
    # Determine verification status
    verification_status = "confirmed" if allergy.verified_by else "unconfirmed"
    
    # Build AllergyIntolerance resource
    allergy_intolerance_data = {
        "id": str(allergy.id),
        "clinicalStatus": CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    code=clinical_status,
                )
            ]
        ),
        "verificationStatus": CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                    code=verification_status,
                )
            ]
        ),
        "type": "allergy",  # All entries are allergies (vs intolerance)
        "category": [category],
        "code": CodeableConcept(
            text=allergy.allergen
        ),
        "patient": Reference(reference=f"Patient/{allergy.patient_id}"),
        "recordedDate": allergy.created_at.isoformat() if allergy.created_at else None,
    }
    
    # Add onset date if present
    if allergy.reported_date:
        allergy_intolerance_data["onsetDateTime"] = allergy.reported_date.isoformat()
    
    # Add recorder if verified
    if allergy.verified_by:
        allergy_intolerance_data["recorder"] = Reference(
            reference=f"Practitioner/{allergy.verified_by}"
        )
    
    # Add reaction if present
    if allergy.reaction:
        reaction = AllergyIntoleranceReaction(
            manifestation=[
                CodeableConcept(text=allergy.reaction)
            ],
            severity=fhir_severity,
        )
        allergy_intolerance_data["reaction"] = [reaction]
    
    return FHIRAllergyIntolerance(**allergy_intolerance_data)


def validate_fhir_allergy_intolerance(data: dict[str, Any]) -> "FHIRAllergyIntolerance":
    """
    Validate and parse FHIR AllergyIntolerance JSON.
    
    Args:
        data: Raw FHIR AllergyIntolerance JSON dict
        
    Returns:
        Validated FHIR AllergyIntolerance resource
        
    Raises:
        ValidationError: If FHIR validation fails
    """
    from fhir.resources.allergyintolerance import AllergyIntolerance as FHIRAllergyIntolerance
    
    try:
        return FHIRAllergyIntolerance(**data)
    except Exception as e:
        raise ValidationError(f"Invalid FHIR AllergyIntolerance resource: {str(e)}")
