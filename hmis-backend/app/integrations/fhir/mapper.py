"""
Mapeador de recursos FHIR R4.
Convierte entidades internas a recursos FHIR estandar para interoperabilidad.
"""

from datetime import date, datetime
from typing import Any
import uuid


def patient_to_fhir(patient: Any) -> dict:
    """Mapea un paciente interno a FHIR Patient resource."""
    gender_map = {"M": "male", "F": "female", "otro": "other"}

    resource = {
        "resourceType": "Patient",
        "id": str(patient.id),
        "identifier": [
            {
                "system": "urn:hmis:mrn",
                "value": patient.mrn,
            },
            {
                "system": f"urn:hmis:document:{patient.document_type}",
                "value": patient.document_number,
            },
        ],
        "active": patient.is_active,
        "name": [
            {
                "use": "official",
                "family": patient.last_name,
                "given": [patient.first_name],
            }
        ],
        "gender": gender_map.get(patient.gender, "unknown"),
        "birthDate": patient.birth_date.isoformat() if patient.birth_date else None,
    }

    # Contacto
    telecom = []
    if patient.phone:
        telecom.append({"system": "phone", "value": patient.phone, "use": "home"})
    if patient.mobile_phone:
        telecom.append({"system": "phone", "value": patient.mobile_phone, "use": "mobile"})
    if patient.email:
        telecom.append({"system": "email", "value": patient.email})
    if telecom:
        resource["telecom"] = telecom

    # Direccion
    if patient.address_line1:
        resource["address"] = [
            {
                "use": "home",
                "line": [patient.address_line1],
                "city": patient.city,
                "state": patient.state_province,
                "postalCode": patient.postal_code,
                "country": patient.country,
            }
        ]

    return resource


def encounter_to_fhir(encounter: Any) -> dict:
    """Mapea un encuentro interno a FHIR Encounter resource."""
    type_map = {
        "ambulatory": "AMB",
        "emergency": "EMER",
        "inpatient": "IMP",
    }
    status_map = {
        "in_progress": "in-progress",
        "completed": "finished",
        "cancelled": "cancelled",
    }

    resource = {
        "resourceType": "Encounter",
        "id": str(encounter.id),
        "status": status_map.get(encounter.status, "unknown"),
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": type_map.get(encounter.encounter_type, "AMB"),
        },
        "subject": {"reference": f"Patient/{encounter.patient_id}"},
        "participant": [
            {
                "individual": {"reference": f"Practitioner/{encounter.provider_id}"},
            }
        ],
        "period": {
            "start": encounter.start_datetime.isoformat() if encounter.start_datetime else None,
            "end": encounter.end_datetime.isoformat() if encounter.end_datetime else None,
        },
    }

    if encounter.chief_complaint:
        resource["reasonCode"] = [{"text": encounter.chief_complaint}]

    return resource


def diagnosis_to_fhir(diagnosis: Any, patient_id: str) -> dict:
    """Mapea un diagnostico a FHIR Condition resource."""
    status_map = {
        "active": "active",
        "resolved": "resolved",
        "chronic": "active",
    }

    resource = {
        "resourceType": "Condition",
        "id": str(diagnosis.id),
        "clinicalStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": status_map.get(diagnosis.status, "active"),
                }
            ]
        },
        "code": {
            "coding": [
                {
                    "system": "http://hl7.org/fhir/sid/icd-10",
                    "code": diagnosis.icd10_code,
                    "display": diagnosis.description,
                }
            ]
        },
        "subject": {"reference": f"Patient/{patient_id}"},
    }

    if diagnosis.onset_date:
        resource["onsetDateTime"] = diagnosis.onset_date.isoformat()

    return resource


def vital_signs_to_fhir(vitals: Any) -> dict:
    """Mapea signos vitales a FHIR Observation resource."""
    components = []

    if vitals.blood_pressure_sys is not None:
        components.append({
            "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6", "display": "Presion sistolica"}]},
            "valueQuantity": {"value": vitals.blood_pressure_sys, "unit": "mmHg"},
        })
    if vitals.blood_pressure_dia is not None:
        components.append({
            "code": {"coding": [{"system": "http://loinc.org", "code": "8462-4", "display": "Presion diastolica"}]},
            "valueQuantity": {"value": vitals.blood_pressure_dia, "unit": "mmHg"},
        })
    if vitals.heart_rate is not None:
        components.append({
            "code": {"coding": [{"system": "http://loinc.org", "code": "8867-4", "display": "Frecuencia cardiaca"}]},
            "valueQuantity": {"value": vitals.heart_rate, "unit": "bpm"},
        })
    if vitals.temperature is not None:
        components.append({
            "code": {"coding": [{"system": "http://loinc.org", "code": "8310-5", "display": "Temperatura"}]},
            "valueQuantity": {"value": vitals.temperature, "unit": "Cel"},
        })
    if vitals.oxygen_saturation is not None:
        components.append({
            "code": {"coding": [{"system": "http://loinc.org", "code": "2708-6", "display": "SpO2"}]},
            "valueQuantity": {"value": vitals.oxygen_saturation, "unit": "%"},
        })

    return {
        "resourceType": "Observation",
        "id": str(vitals.id),
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "vital-signs",
                    }
                ]
            }
        ],
        "code": {
            "coding": [{"system": "http://loinc.org", "code": "85353-1", "display": "Signos vitales"}]
        },
        "subject": {"reference": f"Patient/{vitals.patient_id}"},
        "effectiveDateTime": vitals.measured_at.isoformat() if vitals.measured_at else None,
        "component": components,
    }
