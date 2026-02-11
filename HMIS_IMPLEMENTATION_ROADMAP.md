# HMIS 2026 - Implementation Roadmap
## Opción A → Opción B (Outpatient Excellence → Hospital Completo)

**Fecha creación:** 2026-02-10
**Estrategia:** Secuencial (A primero, luego B)
**Timeline total:** 3-6 meses (A) + 24 meses (B) = **27-30 meses**
**Inversión total:** $150K-$300K (A) + $1.2M-$1.5M (B) = **$1.35M-$1.8M**

---

# 🎯 OPCIÓN A: OUTPATIENT EXCELLENCE (3-6 MESES)

**Objetivo:** Sistema 95% completo para clínicas ambulatorias, competitivo con Athenahealth.

**Team requerido:**
- 2 Backend Developers (Python/FastAPI)
- 2 Frontend Developers (TypeScript/React)
- 1 DevOps Engineer
- 1 QA Engineer
- 1 Product Manager

**Inversión:** $150K-$300K

---

## FASE A.1: FHIR R4 Completo (4-6 semanas)

### Objetivo
Implementar servidor FHIR R4 completo con recursos críticos para interoperability.

### A.1.1 - FHIR Server Infrastructure (Semana 1-2)

**Backend - FHIR Server Setup:**

```python
# CREAR: hmis-backend/app/fhir/server.py
from fhir.resources.R4.patient import Patient as FHIRPatient
from fhir.resources.R4.encounter import Encounter as FHIREncounter
from fhir.resources.R4.observation import Observation as FHIRObservation
from fhir.resources.R4.medicationrequest import MedicationRequest as FHIRMedicationRequest
from fhir.resources.R4.bundle import Bundle
from typing import List

class FHIRServer:
    """FHIR R4 Server implementation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def search_patients(
        self,
        name: str | None = None,
        identifier: str | None = None,
        birthdate: date | None = None,
        gender: str | None = None,
        _count: int = 20,
        _offset: int = 0
    ) -> Bundle:
        """Search patients (GET /Patient?name=John)."""
        # Implementation...

    async def get_patient(self, patient_id: str) -> FHIRPatient:
        """Get single patient (GET /Patient/{id})."""
        # Implementation...

    async def create_patient(self, fhir_patient: FHIRPatient) -> FHIRPatient:
        """Create patient (POST /Patient)."""
        # Implementation...

    async def update_patient(self, patient_id: str, fhir_patient: FHIRPatient) -> FHIRPatient:
        """Update patient (PUT /Patient/{id})."""
        # Implementation...
```

**Archivos a crear:**
- `hmis-backend/app/fhir/server.py` - Core FHIR server
- `hmis-backend/app/fhir/converters.py` - HMIS models → FHIR resources
- `hmis-backend/app/fhir/validators.py` - FHIR validation
- `hmis-backend/app/fhir/routes.py` - FHIR REST endpoints
- `hmis-backend/app/fhir/capability.py` - CapabilityStatement

**Dependencias a agregar (requirements.txt):**
```
fhir.resources==7.1.0     # FHIR R4 Python models
pydantic-extra-types      # FHIR data types
```

**Endpoints FHIR a implementar:**
```
GET    /fhir/metadata                    # CapabilityStatement
GET    /fhir/Patient?name=X              # Search patients
GET    /fhir/Patient/{id}                # Read patient
POST   /fhir/Patient                     # Create patient
PUT    /fhir/Patient/{id}                # Update patient
DELETE /fhir/Patient/{id}                # Delete patient (soft)
GET    /fhir/Patient/{id}/$everything    # Get all patient data
```

**Tests a crear:**
- `tests/integration/test_fhir_patient.py` - Patient CRUD
- `tests/integration/test_fhir_search.py` - Search parameters
- `tests/integration/test_fhir_validation.py` - Validation

**Criterio de aceptación:**
- [ ] CapabilityStatement retorna recursos soportados
- [ ] Patient CRUD completo funciona
- [ ] Search patients con 5+ parámetros (name, identifier, birthdate, gender, _id)
- [ ] Validation rechaza FHIR inválido
- [ ] Tests 90%+ coverage

---

### A.1.2 - FHIR Encounter Resource (Semana 2-3)

**Backend - Encounter Converter:**

```python
# CREAR: hmis-backend/app/fhir/converters/encounter.py
from fhir.resources.R4.encounter import Encounter as FHIREncounter, EncounterStatus
from app.modules.emr.models import Encounter

async def encounter_to_fhir(encounter: Encounter) -> FHIREncounter:
    """Convert HMIS Encounter → FHIR Encounter."""
    status_map = {
        "in_progress": EncounterStatus.IN_PROGRESS,
        "completed": EncounterStatus.FINISHED,
        "cancelled": EncounterStatus.CANCELLED,
    }

    return FHIREncounter(
        id=str(encounter.id),
        status=status_map[encounter.status],
        class_={"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB"},
        subject={"reference": f"Patient/{encounter.patient_id}"},
        participant=[
            {
                "individual": {"reference": f"Practitioner/{encounter.provider_id}"},
                "type": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", "code": "ATND"}]}]
            }
        ],
        period={
            "start": encounter.start_datetime.isoformat(),
            "end": encounter.end_datetime.isoformat() if encounter.end_datetime else None,
        },
        reasonCode=[{"text": encounter.chief_complaint}] if encounter.chief_complaint else None,
        type=[{"coding": [{"system": "http://snomed.info/sct", "code": encounter.encounter_type}]}],
    )

async def fhir_to_encounter(fhir_encounter: FHIREncounter, db: AsyncSession) -> Encounter:
    """Convert FHIR Encounter → HMIS Encounter."""
    # Implementation...
```

**Endpoints adicionales:**
```
GET    /fhir/Encounter?patient=Patient/{id}
GET    /fhir/Encounter/{id}
POST   /fhir/Encounter
PUT    /fhir/Encounter/{id}
```

**Criterio de aceptación:**
- [ ] Encounter CRUD completo
- [ ] Search por patient funciona
- [ ] Include patient data (_include=Encounter:patient)
- [ ] Tests 90%+ coverage

---

### A.1.3 - FHIR Observation Resource (Vital Signs) (Semana 3-4)

**Backend - Observation Converter:**

```python
# CREAR: hmis-backend/app/fhir/converters/observation.py
from fhir.resources.R4.observation import Observation as FHIRObservation
from app.modules.emr.models import VitalSigns

LOINC_CODES = {
    "temperature": {"code": "8310-5", "display": "Body temperature"},
    "heart_rate": {"code": "8867-4", "display": "Heart rate"},
    "blood_pressure_sys": {"code": "8480-6", "display": "Systolic blood pressure"},
    "blood_pressure_dia": {"code": "8462-4", "display": "Diastolic blood pressure"},
    "respiratory_rate": {"code": "9279-1", "display": "Respiratory rate"},
    "oxygen_saturation": {"code": "2708-6", "display": "Oxygen saturation"},
    "weight": {"code": "29463-7", "display": "Body weight"},
    "height": {"code": "8302-2", "display": "Body height"},
    "bmi": {"code": "39156-5", "display": "Body mass index"},
}

async def vital_signs_to_fhir_bundle(vitals: VitalSigns) -> list[FHIRObservation]:
    """Convert VitalSigns → múltiples FHIR Observations."""
    observations = []

    if vitals.temperature:
        obs = FHIRObservation(
            id=f"{vitals.id}-temp",
            status="final",
            category=[{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "vital-signs"
                }]
            }],
            code={
                "coding": [{
                    "system": "http://loinc.org",
                    "code": LOINC_CODES["temperature"]["code"],
                    "display": LOINC_CODES["temperature"]["display"]
                }]
            },
            subject={"reference": f"Patient/{vitals.patient_id}"},
            encounter={"reference": f"Encounter/{vitals.encounter_id}"},
            effectiveDateTime=vitals.measured_at.isoformat(),
            valueQuantity={
                "value": vitals.temperature,
                "unit": "Cel",
                "system": "http://unitsofmeasure.org",
                "code": "Cel"
            }
        )
        observations.append(obs)

    # Repetir para cada vital sign...
    return observations
```

**Endpoints adicionales:**
```
GET    /fhir/Observation?patient=Patient/{id}
GET    /fhir/Observation?encounter=Encounter/{id}
GET    /fhir/Observation?category=vital-signs
GET    /fhir/Observation/{id}
POST   /fhir/Observation
```

**Criterio de aceptación:**
- [ ] Vital signs convertidos a Observations con LOINC codes
- [ ] Search por patient, encounter, category funciona
- [ ] Units of measure correctos (UCUM)
- [ ] Tests 90%+ coverage

---

### A.1.4 - FHIR MedicationRequest Resource (Semana 4)

**Backend - MedicationRequest Converter:**

```python
# CREAR: hmis-backend/app/fhir/converters/medication_request.py
from fhir.resources.R4.medicationrequest import MedicationRequest as FHIRMedicationRequest
from app.modules.pharmacy.models import Prescription

async def prescription_to_fhir(prescription: Prescription) -> FHIRMedicationRequest:
    """Convert Prescription → FHIR MedicationRequest."""
    status_map = {
        "active": "active",
        "dispensed": "completed",
        "cancelled": "cancelled",
        "expired": "stopped"
    }

    return FHIRMedicationRequest(
        id=str(prescription.id),
        status=status_map[prescription.status],
        intent="order",
        medicationCodeableConcept={
            "coding": [{
                "system": "http://www.whocc.no/atc",  # ATC codes
                "code": prescription.product.atc_code if prescription.product.atc_code else None,
                "display": prescription.medication_name
            }],
            "text": prescription.medication_name
        },
        subject={"reference": f"Patient/{prescription.patient_id}"},
        encounter={"reference": f"Encounter/{prescription.encounter_id}"},
        authoredOn=prescription.created_at.isoformat(),
        requester={"reference": f"Practitioner/{prescription.prescribed_by}"},
        dosageInstruction=[{
            "text": f"{prescription.dosage} {prescription.frequency}",
            "timing": {"repeat": {"frequency": 1}},  # Parsear frequency
            "route": {"text": prescription.route},
            "doseAndRate": [{
                "doseQuantity": {
                    "value": float(prescription.dosage.split()[0]),  # Parsear dosage
                    "unit": prescription.dosage.split()[1] if len(prescription.dosage.split()) > 1 else "unit"
                }
            }]
        }],
        dispenseRequest={
            "quantity": {"value": prescription.quantity_prescribed},
            "expectedSupplyDuration": {"value": prescription.duration_days, "unit": "days"}
        }
    )
```

**Endpoints adicionales:**
```
GET    /fhir/MedicationRequest?patient=Patient/{id}
GET    /fhir/MedicationRequest?encounter=Encounter/{id}
GET    /fhir/MedicationRequest?status=active
GET    /fhir/MedicationRequest/{id}
POST   /fhir/MedicationRequest
```

**Criterio de aceptación:**
- [ ] Prescriptions convertidas a MedicationRequests
- [ ] ATC codes incluidos cuando disponibles
- [ ] Dosage instructions parseadas correctamente
- [ ] Tests 90%+ coverage

---

### A.1.5 - FHIR Condition Resource (Diagnoses) (Semana 4-5)

**Backend - Condition Converter:**

```python
# CREAR: hmis-backend/app/fhir/converters/condition.py
from fhir.resources.R4.condition import Condition as FHIRCondition
from app.modules.emr.models import Diagnosis

async def diagnosis_to_fhir(diagnosis: Diagnosis) -> FHIRCondition:
    """Convert Diagnosis → FHIR Condition."""
    clinical_status_map = {
        "active": "active",
        "resolved": "resolved",
        "chronic": "active"
    }

    return FHIRCondition(
        id=str(diagnosis.id),
        clinicalStatus={
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": clinical_status_map[diagnosis.status]
            }]
        },
        verificationStatus={
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": "confirmed"
            }]
        },
        category=[{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                "code": "encounter-diagnosis" if diagnosis.diagnosis_type == "principal" else "problem-list-item"
            }]
        }],
        code={
            "coding": [{
                "system": "http://hl7.org/fhir/sid/icd-10",
                "code": diagnosis.icd10_code,
                "display": diagnosis.description
            }],
            "text": diagnosis.description
        },
        subject={"reference": f"Patient/{diagnosis.encounter.patient_id}"},
        encounter={"reference": f"Encounter/{diagnosis.encounter_id}"},
        onsetDateTime=diagnosis.onset_date.isoformat() if diagnosis.onset_date else None,
        abatementDateTime=diagnosis.resolved_date.isoformat() if diagnosis.resolved_date else None,
        recordedDate=diagnosis.created_at.isoformat()
    )
```

**Endpoints adicionales:**
```
GET    /fhir/Condition?patient=Patient/{id}
GET    /fhir/Condition?encounter=Encounter/{id}
GET    /fhir/Condition?clinical-status=active
GET    /fhir/Condition?code=http://hl7.org/fhir/sid/icd-10|E11
GET    /fhir/Condition/{id}
POST   /fhir/Condition
```

**Criterio de aceptación:**
- [ ] Diagnoses convertidos a Conditions con ICD-10
- [ ] Search por patient, encounter, status, code funciona
- [ ] Problem list separada de encounter diagnoses
- [ ] Tests 90%+ coverage

---

### A.1.6 - FHIR AllergyIntolerance Resource (Semana 5)

**Backend - AllergyIntolerance Converter:**

```python
# CREAR: hmis-backend/app/fhir/converters/allergy.py
from fhir.resources.R4.allergyintolerance import AllergyIntolerance as FHIRAllergyIntolerance
from app.modules.emr.models import Allergy

async def allergy_to_fhir(allergy: Allergy) -> FHIRAllergyIntolerance:
    """Convert Allergy → FHIR AllergyIntolerance."""
    criticality_map = {
        "mild": "low",
        "moderate": "high",
        "severe": "high",
        "life_threatening": "unable-to-assess"
    }

    return FHIRAllergyIntolerance(
        id=str(allergy.id),
        clinicalStatus={
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                "code": "active" if allergy.status == "active" else "inactive"
            }]
        },
        verificationStatus={
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                "code": "confirmed" if allergy.verified_by else "unconfirmed"
            }]
        },
        type="allergy" if allergy.allergen_type == "drug" else "intolerance",
        category=[allergy.allergen_type],  # drug, food, environment
        criticality=criticality_map[allergy.severity],
        code={
            "coding": [{
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",  # RxNorm for drugs
                "display": allergy.allergen
            }],
            "text": allergy.allergen
        },
        patient={"reference": f"Patient/{allergy.patient_id}"},
        recordedDate=allergy.reported_date.isoformat() if allergy.reported_date else allergy.created_at.isoformat(),
        reaction=[{
            "manifestation": [{
                "text": allergy.reaction
            }]
        }] if allergy.reaction else None
    )
```

**Endpoints adicionales:**
```
GET    /fhir/AllergyIntolerance?patient=Patient/{id}
GET    /fhir/AllergyIntolerance?clinical-status=active
GET    /fhir/AllergyIntolerance/{id}
POST   /fhir/AllergyIntolerance
PUT    /fhir/AllergyIntolerance/{id}
```

**Criterio de aceptación:**
- [ ] Allergies convertidas a AllergyIntolerance
- [ ] Search por patient, status funciona
- [ ] Criticality mapping correcto
- [ ] Tests 90%+ coverage

---

### A.1.7 - FHIR Bundle & $everything Operation (Semana 5-6)

**Backend - Patient $everything:**

```python
# MODIFICAR: hmis-backend/app/fhir/routes.py
@router.get("/Patient/{patient_id}/$everything", response_model=dict)
async def patient_everything(
    patient_id: uuid.UUID,
    start: date | None = None,
    end: date | None = None,
    _count: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all data for a patient (FHIR $everything operation).
    Returns a Bundle with Patient + all related resources.
    """
    fhir_server = FHIRServer(db)

    # Fetch all resources
    patient = await fhir_server.get_patient(str(patient_id))
    encounters = await fhir_server.search_encounters(patient=str(patient_id), start=start, end=end)
    observations = await fhir_server.search_observations(patient=str(patient_id), start=start, end=end)
    conditions = await fhir_server.search_conditions(patient=str(patient_id))
    medication_requests = await fhir_server.search_medication_requests(patient=str(patient_id))
    allergies = await fhir_server.search_allergy_intolerances(patient=str(patient_id))

    # Build Bundle
    entries = [
        {"resource": patient.dict()},
        *[{"resource": e.dict()} for e in encounters],
        *[{"resource": o.dict()} for o in observations],
        *[{"resource": c.dict()} for c in conditions],
        *[{"resource": m.dict()} for m in medication_requests],
        *[{"resource": a.dict()} for a in allergies],
    ]

    bundle = Bundle(
        type="searchset",
        total=len(entries),
        entry=entries
    )

    return bundle.dict()
```

**Criterio de aceptación:**
- [ ] $everything retorna Bundle completo
- [ ] Filtros por fecha funcionan
- [ ] Incluye: Patient, Encounters, Observations, Conditions, MedicationRequests, AllergyIntolerances
- [ ] Tests 90%+ coverage

---

### A.1.8 - FHIR Frontend Integration (Semana 6)

**Frontend - FHIR Client:**

```typescript
// CREAR: hmis-frontend/src/lib/fhir-client.ts
import { Patient, Encounter, Observation, MedicationRequest, Condition } from 'fhir/r4';

export class FHIRClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000/fhir') {
    this.baseUrl = baseUrl;
  }

  async getPatient(patientId: string): Promise<Patient> {
    const response = await fetch(`${this.baseUrl}/Patient/${patientId}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async searchPatients(params: {
    name?: string;
    identifier?: string;
    birthdate?: string;
    gender?: string;
  }): Promise<{ entry: { resource: Patient }[] }> {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseUrl}/Patient?${query}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async getPatientEverything(patientId: string, start?: string, end?: string): Promise<any> {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);

    const response = await fetch(
      `${this.baseUrl}/Patient/${patientId}/$everything?${params.toString()}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('hmis_access_token');
    return {
      'Accept': 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
      'Authorization': `Bearer ${token}`,
    };
  }
}

export const fhirClient = new FHIRClient();
```

**Archivos a crear:**
- `hmis-frontend/src/lib/fhir-client.ts` - FHIR client
- `hmis-frontend/src/hooks/useFHIR.ts` - React Query hooks para FHIR
- `hmis-frontend/src/app/(app)/fhir/page.tsx` - FHIR explorer UI

**Dependencias a agregar (package.json):**
```json
{
  "dependencies": {
    "@types/fhir": "^0.0.40",
    "fhir": "^4.11.1"
  }
}
```

**Criterio de aceptación:**
- [ ] Frontend puede consumir FHIR API
- [ ] FHIR explorer muestra recursos
- [ ] Validación client-side con @types/fhir
- [ ] Tests E2E con FHIR data

---

### Entregables Fase A.1

- [ ] FHIR R4 Server funcional con 6 recursos (Patient, Encounter, Observation, Condition, MedicationRequest, AllergyIntolerance)
- [ ] CapabilityStatement documentando server
- [ ] $everything operation para export completo
- [ ] Frontend FHIR client
- [ ] 50+ tests de integración FHIR
- [ ] Documentación API FHIR

---

## FASE A.2: CCD Export (Continuity of Care Document) (2 semanas)

### Objetivo
Implementar export de CCD (C-CDA R2.1) para interoperability con otros sistemas.

### A.2.1 - CCD Generator (Semana 1)

**Backend - CCD Builder:**

```python
# CREAR: hmis-backend/app/fhir/ccd.py
from lxml import etree
from datetime import datetime
from app.modules.patients.models import Patient
from app.modules.emr.models import Encounter, Diagnosis, VitalSigns, Allergy
from app.modules.pharmacy.models import Prescription

class CCDGenerator:
    """Generate C-CDA R2.1 Continuity of Care Documents."""

    def __init__(self, patient: Patient):
        self.patient = patient
        self.doc = self._create_base_document()

    def _create_base_document(self) -> etree.Element:
        """Create CDA document structure."""
        # XML namespaces
        nsmap = {
            None: "urn:hl7-org:v3",
            "xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "sdtc": "urn:hl7-org:sdtc",
        }

        # Root ClinicalDocument
        doc = etree.Element("ClinicalDocument", nsmap=nsmap)

        # CDA Header
        etree.SubElement(doc, "realmCode", code="US")
        etree.SubElement(doc, "typeId", root="2.16.840.1.113883.1.3", extension="POCD_HD000040")

        # Template ID (CCD)
        etree.SubElement(doc, "templateId", root="2.16.840.1.113883.10.20.22.1.2", extension="2015-08-01")

        # Document ID
        doc_id = etree.SubElement(doc, "id", root="2.16.840.1.113883.19.5")
        doc_id.set("extension", str(uuid.uuid4()))

        # Document code (CCD)
        code = etree.SubElement(doc, "code")
        code.set("code", "34133-9")
        code.set("codeSystem", "2.16.840.1.113883.6.1")
        code.set("codeSystemName", "LOINC")
        code.set("displayName", "Summarization of Episode Note")

        # Title
        etree.SubElement(doc, "title").text = "Continuity of Care Document"

        # Effective time
        etree.SubElement(doc, "effectiveTime", value=datetime.now().strftime("%Y%m%d%H%M%S"))

        # Confidentiality
        etree.SubElement(doc, "confidentialityCode", code="N", codeSystem="2.16.840.1.113883.5.25")

        return doc

    def add_patient_section(self):
        """Add patient demographics."""
        record_target = etree.SubElement(self.doc, "recordTarget")
        patient_role = etree.SubElement(record_target, "patientRole")

        # Patient ID (MRN)
        patient_id = etree.SubElement(patient_role, "id")
        patient_id.set("extension", self.patient.mrn)
        patient_id.set("root", "2.16.840.1.113883.19.5.99999.2")  # Your OID

        # Address
        if self.patient.address:
            addr = etree.SubElement(patient_role, "addr", use="HP")
            etree.SubElement(addr, "streetAddressLine").text = self.patient.address
            etree.SubElement(addr, "city").text = self.patient.city
            etree.SubElement(addr, "state").text = self.patient.state
            etree.SubElement(addr, "postalCode").text = self.patient.zip_code

        # Telecom
        if self.patient.phone:
            etree.SubElement(patient_role, "telecom", use="HP", value=f"tel:{self.patient.phone}")
        if self.patient.email:
            etree.SubElement(patient_role, "telecom", use="HP", value=f"mailto:{self.patient.email}")

        # Patient name
        patient_elem = etree.SubElement(patient_role, "patient")
        name = etree.SubElement(patient_elem, "name", use="L")
        etree.SubElement(name, "given").text = self.patient.first_name
        etree.SubElement(name, "family").text = self.patient.last_name

        # Gender
        if self.patient.gender:
            gender_map = {"M": "M", "F": "F", "O": "UN"}
            etree.SubElement(patient_elem, "administrativeGenderCode",
                           code=gender_map.get(self.patient.gender, "UN"),
                           codeSystem="2.16.840.1.113883.5.1")

        # Birth date
        if self.patient.date_of_birth:
            etree.SubElement(patient_elem, "birthTime",
                           value=self.patient.date_of_birth.strftime("%Y%m%d"))

    def add_allergies_section(self, allergies: list[Allergy]):
        """Add allergies and adverse reactions."""
        component = etree.SubElement(self.doc, "component")
        section = etree.SubElement(component, "section")

        # Template ID
        etree.SubElement(section, "templateId", root="2.16.840.1.113883.10.20.22.2.6.1", extension="2015-08-01")

        # Section code
        code = etree.SubElement(section, "code")
        code.set("code", "48765-2")
        code.set("codeSystem", "2.16.840.1.113883.6.1")
        code.set("displayName", "Allergies, adverse reactions, alerts")

        etree.SubElement(section, "title").text = "Allergies and Adverse Reactions"

        # Text (human readable)
        text = etree.SubElement(section, "text")
        table = etree.SubElement(text, "table", border="1", width="100%")
        thead = etree.SubElement(table, "thead")
        tr = etree.SubElement(thead, "tr")
        etree.SubElement(tr, "th").text = "Substance"
        etree.SubElement(tr, "th").text = "Reaction"
        etree.SubElement(tr, "th").text = "Severity"

        tbody = etree.SubElement(table, "tbody")

        for allergy in allergies:
            tr = etree.SubElement(tbody, "tr")
            etree.SubElement(tr, "td").text = allergy.allergen
            etree.SubElement(tr, "td").text = allergy.reaction or "Unknown"
            etree.SubElement(tr, "td").text = allergy.severity.capitalize()

            # Structured entry
            entry = etree.SubElement(section, "entry", typeCode="DRIV")
            # ... C-CDA allergy observation template

    def add_medications_section(self, prescriptions: list[Prescription]):
        """Add medications section."""
        # Similar structure to allergies...

    def add_problems_section(self, diagnoses: list[Diagnosis]):
        """Add problem list section."""
        # Similar structure...

    def add_vital_signs_section(self, vitals: list[VitalSigns]):
        """Add vital signs section."""
        # Similar structure...

    def generate(self) -> str:
        """Generate final CCD XML."""
        return etree.tostring(
            self.doc,
            pretty_print=True,
            xml_declaration=True,
            encoding="UTF-8"
        ).decode("utf-8")
```

**Archivos a crear:**
- `hmis-backend/app/fhir/ccd.py` - CCD generator
- `hmis-backend/app/fhir/routes.py` - Endpoint /fhir/Patient/{id}/$ccd

**Dependencias a agregar:**
```
lxml==5.1.0  # XML generation
```

**Endpoint a implementar:**
```
GET    /fhir/Patient/{id}/$ccd?start=2024-01-01&end=2024-12-31
```

**Criterio de aceptación:**
- [ ] CCD XML válido según C-CDA R2.1 schema
- [ ] Incluye: Patient, Allergies, Medications, Problems, Vital Signs
- [ ] Validado con NIST validator
- [ ] Tests con validación XML

---

### A.2.2 - CCD Frontend Download (Semana 2)

**Frontend - CCD Download Button:**

```typescript
// MODIFICAR: hmis-frontend/src/app/(app)/patients/[id]/page.tsx
import { fhirClient } from '@/lib/fhir-client';

export function PatientDetailPage({ params }: { params: { id: string } }) {
  const handleDownloadCCD = async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/fhir/Patient/${params.id}/$ccd`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('hmis_access_token')}`,
        },
      }
    );

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${params.id}-ccd.xml`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Button onClick={handleDownloadCCD}>
        Download CCD (C-CDA)
      </Button>
    </div>
  );
}
```

**Criterio de aceptación:**
- [ ] Botón "Download CCD" en patient detail page
- [ ] Descarga XML válido
- [ ] Filename con patient ID + timestamp

---

### Entregables Fase A.2

- [ ] CCD generator funcional
- [ ] CCD export endpoint
- [ ] Frontend download button
- [ ] CCD validado con NIST validator
- [ ] Documentación de CCD format

---

## FASE A.3: SMART on FHIR (3 semanas)

### Objetivo
Permitir third-party apps conectarse via SMART on FHIR OAuth2.

### A.3.1 - OAuth2 Authorization Server (Semana 1-2)

**Backend - SMART OAuth2:**

```python
# CREAR: hmis-backend/app/fhir/smart_auth.py
from authlib.integrations.starlette_client import OAuth
from authlib.oauth2.rfc6749 import grants
from app.modules.auth.models import User

class SMARTAuthorizationServer:
    """SMART on FHIR OAuth2 Authorization Server."""

    def __init__(self):
        self.oauth = OAuth()

    async def authorize(
        self,
        client_id: str,
        redirect_uri: str,
        scope: str,
        state: str,
        aud: str,
        launch: str | None = None
    ):
        """
        SMART authorization endpoint.
        GET /fhir/authorize?response_type=code&client_id=X&redirect_uri=Y&scope=Z&state=W&aud=https://fhir.example.com
        """
        # Validate client_id
        # Validate redirect_uri
        # Show consent screen
        # Generate authorization code
        pass

    async def token(
        self,
        grant_type: str,
        code: str,
        redirect_uri: str,
        client_id: str,
        client_secret: str | None = None
    ):
        """
        Token endpoint.
        POST /fhir/token
        """
        # Validate authorization code
        # Issue access token + id token
        # Return patient context
        pass
```

**Archivos a crear:**
- `hmis-backend/app/fhir/smart_auth.py` - SMART OAuth2 server
- `hmis-backend/app/fhir/smart_routes.py` - OAuth2 endpoints
- `hmis-backend/app/fhir/models.py` - OAuth2 models (clients, tokens, codes)

**Dependencias a agregar:**
```
authlib==1.3.0
```

**Endpoints a implementar:**
```
GET    /fhir/authorize        # OAuth2 authorization
POST   /fhir/token            # Token exchange
GET    /fhir/.well-known/smart-configuration  # SMART metadata
```

**Criterio de aceptación:**
- [ ] OAuth2 authorization code flow funciona
- [ ] Scope: patient/*.read, user/*.read, launch, openid, fhirUser
- [ ] ID token con patient context
- [ ] Tests con OAuth2 client simulator

---

### A.3.2 - SMART App Gallery (Semana 2-3)

**Frontend - SMART App Launcher:**

```typescript
// CREAR: hmis-frontend/src/app/(app)/apps/page.tsx
'use client';

const SMART_APPS = [
  {
    id: 'growth-chart',
    name: 'Pediatric Growth Chart',
    description: 'SMART on FHIR app for growth charts',
    launch_url: 'https://examples.smarthealthit.org/growth-chart/launch.html',
    scopes: ['patient/Patient.read', 'patient/Observation.read'],
  },
  {
    id: 'cardiac-risk',
    name: 'Cardiac Risk Calculator',
    description: 'Calculate 10-year cardiac risk',
    launch_url: 'https://examples.smarthealthit.org/cardiac-risk/launch.html',
    scopes: ['patient/Patient.read', 'patient/Observation.read'],
  },
];

export default function SMARTAppsPage() {
  const handleLaunchApp = async (app: typeof SMART_APPS[0], patientId: string) => {
    // Generate launch context
    const launchToken = await fetch('/api/fhir/launch', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId }),
    }).then(r => r.json());

    // Redirect to app with launch parameter
    const params = new URLSearchParams({
      iss: 'http://localhost:8000/fhir',
      launch: launchToken.launch_token,
    });

    window.open(`${app.launch_url}?${params.toString()}`, '_blank');
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {SMART_APPS.map(app => (
        <Card key={app.id}>
          <CardHeader>
            <h3>{app.name}</h3>
            <p>{app.description}</p>
          </CardHeader>
          <Button onClick={() => handleLaunchApp(app, selectedPatientId)}>
            Launch App
          </Button>
        </Card>
      ))}
    </div>
  );
}
```

**Archivos a crear:**
- `hmis-frontend/src/app/(app)/apps/page.tsx` - SMART app gallery
- `hmis-frontend/src/app/(app)/apps/[appId]/page.tsx` - App detail

**Criterio de aceptación:**
- [ ] App gallery muestra SMART apps disponibles
- [ ] Launch funciona con apps públicas (smarthealthit.org)
- [ ] Patient context pasado correctamente
- [ ] Tests E2E con SMART app simulator

---

### Entregables Fase A.3

- [ ] SMART on FHIR OAuth2 server
- [ ] /authorize y /token endpoints
- [ ] SMART configuration endpoint
- [ ] Frontend app launcher
- [ ] Integración con 2+ SMART apps públicas
- [ ] Documentación SMART on FHIR

---

## FASE A.4: Clinical Decision Support (CDS) (2-3 semanas)

### Objetivo
Implementar drug-drug interaction checking y clinical alerts.

### A.4.1 - DrugBank API Integration (Semana 1)

**Backend - Drug Interaction Checker:**

```python
# CREAR: hmis-backend/app/integrations/drugbank.py
import httpx
from typing import List, Dict

class DrugBankClient:
    """DrugBank API client for drug-drug interactions."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.drugbank.com/v1"

    async def check_interactions(
        self,
        drug_names: List[str]
    ) -> List[Dict]:
        """
        Check drug-drug interactions.
        Returns list of interactions with severity.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/drugdrug",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"drug_names": drug_names}
            )

            interactions = response.json()

            # Format response
            return [{
                "drug_a": interaction["drug_a"]["name"],
                "drug_b": interaction["drug_b"]["name"],
                "severity": interaction["severity"],  # major, moderate, minor
                "description": interaction["description"],
                "management": interaction.get("management"),
            } for interaction in interactions.get("interactions", [])]

    async def get_drug_info(self, drug_name: str) -> Dict:
        """Get detailed drug information."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/drugs/search",
                headers={"Authorization": f"Bearer {self.api_key}"},
                params={"q": drug_name}
            )
            return response.json()
```

**Archivos a crear:**
- `hmis-backend/app/integrations/drugbank.py` - DrugBank client
- `hmis-backend/app/modules/pharmacy/cds.py` - CDS service

**Dependencias a agregar:**
```
httpx==0.26.0
```

**Modificar prescription creation:**

```python
# MODIFICAR: hmis-backend/app/modules/pharmacy/service.py
from app.integrations.drugbank import DrugBankClient

class PharmacyService:
    async def create_prescription(self, data: PrescriptionCreate):
        # Get all active prescriptions for patient
        active_prescriptions = await self.get_active_prescriptions(data.patient_id)

        # Get drug names
        drug_names = [p.medication_name for p in active_prescriptions]
        drug_names.append(data.medication_name)

        # Check interactions
        drugbank = DrugBankClient(settings.DRUGBANK_API_KEY)
        interactions = await drugbank.check_interactions(drug_names)

        # Filter major/moderate interactions
        critical_interactions = [
            i for i in interactions
            if i["severity"] in ["major", "moderate"]
        ]

        # Check allergies
        allergies = await self.get_patient_allergies(data.patient_id)
        allergy_alerts = [
            a for a in allergies
            if a.allergen.lower() in data.medication_name.lower()
        ]

        # Store alerts in prescription
        alerts = {
            "interactions": critical_interactions,
            "allergies": allergy_alerts,
        }

        prescription = Prescription(
            **data.model_dump(),
            alerts_json=alerts
        )

        # If major interaction, require override
        if any(i["severity"] == "major" for i in critical_interactions):
            prescription.status = "pending_review"

        self.db.add(prescription)
        await self.db.commit()

        return prescription
```

**Criterio de aceptación:**
- [ ] Drug-drug interaction checking funciona
- [ ] Severity classification (major, moderate, minor)
- [ ] Allergy checking mejorado
- [ ] Alerts stored in prescription.alerts_json
- [ ] Tests con mock DrugBank API

---

### A.4.2 - CDS Hooks Integration (Semana 2)

**Backend - CDS Hooks Server:**

```python
# CREAR: hmis-backend/app/fhir/cds_hooks.py
from typing import List, Dict, Any
from pydantic import BaseModel

class CDSService(BaseModel):
    """CDS Hook service definition."""
    hook: str  # order-select, order-sign, patient-view
    title: str
    description: str
    id: str
    prefetch: Dict[str, str] | None = None

class CDSRequest(BaseModel):
    """CDS Hook request."""
    hook: str
    hookInstance: str
    fhirServer: str
    context: Dict[str, Any]
    prefetch: Dict[str, Any] | None = None

class CDSCard(BaseModel):
    """CDS Hook card (alert/suggestion)."""
    summary: str
    detail: str | None = None
    indicator: str  # info, warning, critical
    source: Dict[str, str]
    suggestions: List[Dict] | None = None
    links: List[Dict] | None = None

@router.post("/cds-services/drug-interaction-check")
async def drug_interaction_hook(request: CDSRequest):
    """
    CDS Hook: order-select
    Triggered when ordering medication.
    """
    # Extract medications from context
    medications = request.context.get("medications", [])

    # Check interactions
    drugbank = DrugBankClient(settings.DRUGBANK_API_KEY)
    interactions = await drugbank.check_interactions([m["display"] for m in medications])

    # Build cards
    cards = []
    for interaction in interactions:
        if interaction["severity"] == "major":
            cards.append(CDSCard(
                summary=f"Major drug interaction: {interaction['drug_a']} + {interaction['drug_b']}",
                detail=interaction["description"],
                indicator="critical",
                source={"label": "DrugBank"},
                suggestions=[{
                    "label": "Review interaction",
                    "actions": [{
                        "type": "delete",
                        "description": f"Remove {interaction['drug_b']}",
                    }]
                }]
            ))

    return {"cards": [c.dict() for c in cards]}

@router.get("/cds-services")
async def list_cds_services():
    """List available CDS services."""
    services = [
        CDSService(
            hook="order-select",
            title="Drug Interaction Checker",
            description="Check for drug-drug interactions",
            id="drug-interaction-check",
            prefetch={
                "patient": "Patient/{{context.patientId}}",
                "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
            }
        )
    ]
    return {"services": [s.dict() for s in services]}
```

**Archivos a crear:**
- `hmis-backend/app/fhir/cds_hooks.py` - CDS Hooks server
- `hmis-backend/app/fhir/cds_routes.py` - CDS endpoints

**Endpoints a implementar:**
```
GET    /cds-services                        # List services
POST   /cds-services/drug-interaction-check # Drug interaction hook
POST   /cds-services/allergy-check          # Allergy check hook
```

**Criterio de aceptación:**
- [ ] CDS Hooks discovery endpoint funciona
- [ ] order-select hook implementado
- [ ] Cards retornados con severity correcto
- [ ] Tests con CDS Hooks sandbox

---

### A.4.3 - Frontend CDS Alerts (Semana 3)

**Frontend - CDS Alert Modal:**

```typescript
// CREAR: hmis-frontend/src/components/clinical/CDSAlertModal.tsx
'use client';

interface CDSAlert {
  summary: string;
  detail: string;
  indicator: 'info' | 'warning' | 'critical';
  source: { label: string };
}

interface Props {
  alerts: CDSAlert[];
  onDismiss: () => void;
  onOverride: () => void;
}

export function CDSAlertModal({ alerts, onDismiss, onOverride }: Props) {
  const criticalAlerts = alerts.filter(a => a.indicator === 'critical');
  const warningAlerts = alerts.filter(a => a.indicator === 'warning');

  return (
    <Modal open={alerts.length > 0}>
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Clinical Decision Support Alerts</h2>

        {criticalAlerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <h3 className="text-red-800 font-semibold">Critical Alerts</h3>
            {criticalAlerts.map((alert, idx) => (
              <div key={idx} className="mt-2">
                <p className="font-medium">{alert.summary}</p>
                <p className="text-sm text-red-700">{alert.detail}</p>
                <span className="text-xs text-red-600">Source: {alert.source.label}</span>
              </div>
            ))}
          </div>
        )}

        {warningAlerts.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h3 className="text-yellow-800 font-semibold">Warnings</h3>
            {warningAlerts.map((alert, idx) => (
              <div key={idx} className="mt-2">
                <p className="font-medium">{alert.summary}</p>
                <p className="text-sm text-yellow-700">{alert.detail}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDismiss}>
            Cancel Prescription
          </Button>
          <Button variant="destructive" onClick={onOverride}>
            Override and Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

**Modificar prescription form:**

```typescript
// MODIFICAR: hmis-frontend/src/app/(app)/pharmacy/prescriptions/new/page.tsx
const createPrescription = useCreatePrescription();

const handleSubmit = async (data: PrescriptionFormData) => {
  try {
    const result = await createPrescription.mutateAsync(data);

    // Check for CDS alerts
    if (result.alerts_json && (
      result.alerts_json.interactions?.length > 0 ||
      result.alerts_json.allergies?.length > 0
    )) {
      // Show CDS alert modal
      setCDSAlerts([
        ...result.alerts_json.interactions.map(i => ({
          summary: `Drug interaction: ${i.drug_a} + ${i.drug_b}`,
          detail: i.description,
          indicator: i.severity === 'major' ? 'critical' : 'warning',
          source: { label: 'DrugBank' }
        })),
        ...result.alerts_json.allergies.map(a => ({
          summary: `Allergy alert: ${a.allergen}`,
          detail: `Patient has ${a.severity} reaction`,
          indicator: 'critical',
          source: { label: 'Patient Allergies' }
        }))
      ]);

      setShowCDSModal(true);
      return;
    }

    // Success
    toast.success('Prescription created successfully');
  } catch (error) {
    toast.error('Failed to create prescription');
  }
};
```

**Criterio de aceptación:**
- [ ] CDS alerts mostrados al crear prescription
- [ ] Critical alerts requieren override explícito
- [ ] Warnings pueden ser dismissed
- [ ] Audit trail de overrides

---

### Entregables Fase A.4

- [ ] DrugBank API integration
- [ ] Drug-drug interaction checking
- [ ] Allergy checking mejorado
- [ ] CDS Hooks server
- [ ] Frontend CDS alert modals
- [ ] Audit logging de overrides
- [ ] Documentación de CDS

---

## FASE A.5: Medication Reconciliation (1-2 semanas)

### Objetivo
Implementar workflow de medication reconciliation según Joint Commission.

### A.5.1 - Med Rec Workflow (Semana 1)

**Backend - Medication Reconciliation:**

```python
# CREAR: hmis-backend/app/modules/pharmacy/med_rec.py
from typing import List
from app.modules.pharmacy.models import Prescription
from app.modules.emr.models import Encounter

class MedicationReconciliationStatus:
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class MedicationReconciliation(Base, BaseEntity):
    """Medication reconciliation record."""

    __tablename__ = "medication_reconciliations"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    reconciliation_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # admission, transfer, discharge

    status: Mapped[str] = mapped_column(
        String(20), default=MedicationReconciliationStatus.NOT_STARTED
    )

    # Home medications (patient-reported)
    home_medications: Mapped[list] = mapped_column(JSONB, default=list)

    # Medications to continue
    continue_medications: Mapped[list] = mapped_column(JSONB, default=list)

    # Medications to discontinue
    discontinue_medications: Mapped[list] = mapped_column(JSONB, default=list)

    # New medications to start
    new_medications: Mapped[list] = mapped_column(JSONB, default=list)

    # Changes made
    changes: Mapped[list] = mapped_column(JSONB, default=list)

    reconciled_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

class MedicationReconciliationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def start_admission_reconciliation(
        self,
        encounter_id: uuid.UUID,
        patient_id: uuid.UUID,
        home_medications: List[Dict]
    ) -> MedicationReconciliation:
        """Start med rec at admission."""
        # Get active outpatient prescriptions
        active_prescriptions = await self._get_active_prescriptions(patient_id)

        med_rec = MedicationReconciliation(
            encounter_id=encounter_id,
            patient_id=patient_id,
            reconciliation_type="admission",
            status=MedicationReconciliationStatus.IN_PROGRESS,
            home_medications=home_medications,
            continue_medications=[{
                "medication_name": p.medication_name,
                "dosage": p.dosage,
                "frequency": p.frequency,
                "prescription_id": str(p.id),
            } for p in active_prescriptions]
        )

        self.db.add(med_rec)
        await self.db.commit()

        return med_rec

    async def complete_reconciliation(
        self,
        med_rec_id: uuid.UUID,
        continue_meds: List[uuid.UUID],
        discontinue_meds: List[uuid.UUID],
        new_meds: List[Dict],
        reconciled_by: uuid.UUID
    ) -> MedicationReconciliation:
        """Complete medication reconciliation."""
        med_rec = await self.db.get(MedicationReconciliation, med_rec_id)

        if not med_rec:
            raise NotFoundError("MedicationReconciliation", str(med_rec_id))

        # Update prescriptions
        for prescription_id in discontinue_meds:
            prescription = await self.db.get(Prescription, prescription_id)
            prescription.status = "discontinued"
            prescription.notes = f"Discontinued during med rec {med_rec_id}"

        # Create new prescriptions
        for new_med in new_meds:
            prescription = Prescription(**new_med)
            self.db.add(prescription)

        # Mark as completed
        med_rec.status = MedicationReconciliationStatus.COMPLETED
        med_rec.reconciled_by = reconciled_by
        med_rec.reconciled_at = datetime.now(timezone.utc)
        med_rec.continue_medications = [str(id) for id in continue_meds]
        med_rec.discontinue_medications = [str(id) for id in discontinue_meds]
        med_rec.new_medications = new_meds

        await self.db.commit()

        return med_rec
```

**Archivos a crear:**
- `hmis-backend/app/modules/pharmacy/med_rec.py` - Med rec models + service
- `hmis-backend/app/modules/pharmacy/routes.py` - Med rec endpoints
- `hmis-backend/alembic/versions/XXX_add_med_rec.py` - Migration

**Endpoints a implementar:**
```
POST   /api/v1/pharmacy/medication-reconciliation    # Start med rec
GET    /api/v1/pharmacy/medication-reconciliation/{id}
PUT    /api/v1/pharmacy/medication-reconciliation/{id}/complete
GET    /api/v1/pharmacy/medication-reconciliation/encounter/{encounter_id}
```

**Criterio de aceptación:**
- [ ] Med rec workflow funciona (start → complete)
- [ ] Home medications captured
- [ ] Medications classified (continue/discontinue/new)
- [ ] Audit trail completo
- [ ] Tests 90%+ coverage

---

### A.5.2 - Frontend Med Rec UI (Semana 2)

**Frontend - Med Rec Wizard:**

```typescript
// CREAR: hmis-frontend/src/app/(app)/emr/[encounterId]/med-rec/page.tsx
'use client';

import { useState } from 'react';
import { useMedicationReconciliation } from '@/hooks/useMedRec';

export default function MedicationReconciliationPage({
  params
}: {
  params: { encounterId: string };
}) {
  const [step, setStep] = useState(1);
  const [homeMeds, setHomeMeds] = useState([]);
  const [continueMeds, setContinueMeds] = useState([]);
  const [discontinueMeds, setDiscontinueMeds] = useState([]);
  const [newMeds, setNewMeds] = useState([]);

  const { data: medRec, isLoading } = useMedicationReconciliation(params.encounterId);
  const completeMedRec = useCompleteMedRec();

  const handleComplete = async () => {
    await completeMedRec.mutateAsync({
      med_rec_id: medRec.id,
      continue_meds: continueMeds.map(m => m.id),
      discontinue_meds: discontinueMeds.map(m => m.id),
      new_meds: newMeds,
    });

    toast.success('Medication reconciliation completed');
    router.push(`/emr/${params.encounterId}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Medication Reconciliation</h1>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        <Step number={1} active={step === 1} completed={step > 1} label="Home Medications" />
        <Step number={2} active={step === 2} completed={step > 2} label="Review & Reconcile" />
        <Step number={3} active={step === 3} completed={step > 3} label="New Medications" />
        <Step number={4} active={step === 4} completed={step > 4} label="Confirm" />
      </div>

      {/* Step 1: Home Medications */}
      {step === 1 && (
        <Card>
          <CardHeader title="Enter Home Medications" />
          <p className="text-sm text-neutral-600 mb-4">
            Please list all medications the patient is currently taking at home.
          </p>

          {homeMeds.map((med, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
              <Input placeholder="Medication name" value={med.name} onChange={...} />
              <Input placeholder="Dose (e.g., 500mg)" value={med.dose} onChange={...} />
              <Input placeholder="Frequency" value={med.frequency} onChange={...} />
              <Button variant="outline" onClick={() => removeHomeMed(idx)}>Remove</Button>
            </div>
          ))}

          <Button variant="outline" onClick={() => setHomeMeds([...homeMeds, {}])}>
            + Add Medication
          </Button>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </Card>
      )}

      {/* Step 2: Review & Reconcile */}
      {step === 2 && (
        <Card>
          <CardHeader title="Review Active Prescriptions" />
          <p className="text-sm text-neutral-600 mb-4">
            Review the patient's active prescriptions and mark which to continue/discontinue.
          </p>

          <Table>
            <TableHeader>
              <tr>
                <th>Medication</th>
                <th>Dose</th>
                <th>Frequency</th>
                <th>Action</th>
              </tr>
            </TableHeader>
            <TableBody>
              {medRec?.continue_medications.map(med => (
                <tr key={med.prescription_id}>
                  <td>{med.medication_name}</td>
                  <td>{med.dosage}</td>
                  <td>{med.frequency}</td>
                  <td>
                    <select
                      value={
                        continueMeds.includes(med.prescription_id) ? 'continue' :
                        discontinueMeds.includes(med.prescription_id) ? 'discontinue' :
                        'undecided'
                      }
                      onChange={(e) => {
                        if (e.target.value === 'continue') {
                          setContinueMeds([...continueMeds, med.prescription_id]);
                          setDiscontinueMeds(discontinueMeds.filter(id => id !== med.prescription_id));
                        } else if (e.target.value === 'discontinue') {
                          setDiscontinueMeds([...discontinueMeds, med.prescription_id]);
                          setContinueMeds(continueMeds.filter(id => id !== med.prescription_id));
                        }
                      }}
                    >
                      <option value="undecided">Undecided</option>
                      <option value="continue">Continue</option>
                      <option value="discontinue">Discontinue</option>
                    </select>
                  </td>
                </tr>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Next</Button>
          </div>
        </Card>
      )}

      {/* Step 3: New Medications */}
      {step === 3 && (
        <Card>
          <CardHeader title="Add New Medications" />
          {/* Form to add new prescriptions */}
          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)}>Next</Button>
          </div>
        </Card>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <Card>
          <CardHeader title="Confirm Reconciliation" />
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Continue ({continueMeds.length})</h3>
              <ul className="list-disc pl-5">
                {continueMeds.map(id => <li key={id}>...</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Discontinue ({discontinueMeds.length})</h3>
              <ul className="list-disc pl-5">
                {discontinueMeds.map(id => <li key={id}>...</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">New ({newMeds.length})</h3>
              <ul className="list-disc pl-5">
                {newMeds.map(med => <li key={med.name}>...</li>)}
              </ul>
            </div>
          </div>

          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={handleComplete}>Complete Reconciliation</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
```

**Archivos a crear:**
- `hmis-frontend/src/app/(app)/emr/[encounterId]/med-rec/page.tsx` - Med rec wizard
- `hmis-frontend/src/hooks/useMedRec.ts` - React Query hooks
- `hmis-frontend/src/components/pharmacy/MedicationReconciliationCard.tsx` - Summary card

**Criterio de aceptación:**
- [ ] 4-step wizard funciona
- [ ] Home medications capturadas
- [ ] Active prescriptions reviewables
- [ ] New medications pueden agregarse
- [ ] Summary step muestra todos los cambios
- [ ] Tests E2E con med rec workflow

---

### Entregables Fase A.5

- [ ] Medication reconciliation workflow completo
- [ ] Backend med rec service + API
- [ ] Frontend wizard UI
- [ ] Audit trail de reconciliaciones
- [ ] Joint Commission compliance
- [ ] Documentación de med rec

---

## 🎯 ENTREGABLES FINALES OPCIÓN A (3-6 MESES)

### Checklist Completo

**FHIR R4:**
- [ ] Patient, Encounter, Observation, Condition, MedicationRequest, AllergyIntolerance resources
- [ ] CRUD operations para cada recurso
- [ ] Search parameters (10+ por recurso)
- [ ] $everything operation
- [ ] CapabilityStatement
- [ ] 50+ tests integración

**CCD Export:**
- [ ] C-CDA R2.1 generator
- [ ] $ccd endpoint
- [ ] Validación con NIST validator
- [ ] Frontend download button

**SMART on FHIR:**
- [ ] OAuth2 authorization server
- [ ] /authorize y /token endpoints
- [ ] SMART configuration endpoint
- [ ] Frontend app launcher
- [ ] Integración con 2+ SMART apps

**Clinical Decision Support:**
- [ ] DrugBank API integration
- [ ] Drug-drug interaction checking
- [ ] Allergy checking mejorado
- [ ] CDS Hooks server
- [ ] Frontend CDS alerts
- [ ] Audit logging

**Medication Reconciliation:**
- [ ] Med rec workflow (admission/transfer/discharge)
- [ ] Backend service + API
- [ ] Frontend wizard UI
- [ ] Joint Commission compliance

### Métricas de Éxito

- [ ] ✅ Sistema 95% completo para clínicas ambulatorias
- [ ] ✅ FHIR R4 API funcional con 6+ recursos
- [ ] ✅ CCD export validado
- [ ] ✅ SMART on FHIR OAuth2 funcional
- [ ] ✅ CDS con DrugBank integrado
- [ ] ✅ Medication reconciliation completo
- [ ] ✅ Tests 90%+ coverage
- [ ] ✅ Documentación completa
- [ ] ✅ Performance dentro de targets (<2s por request)

### Certificaciones Posibles

- [ ] ONC Health IT Certification (2015 Edition) - Parcial
- [ ] HIMSS EMRAM Stage 3-4
- [ ] Meaningful Use Stage 2
- [ ] HIPAA compliant
- [ ] Joint Commission medication management standards

---

# 🏥 OPCIÓN B: HOSPITAL COMPLETO (24 MESES)

**Prerequisito:** Opción A completada (3-6 meses)

**Objetivo:** Sistema 95% completo para hospitales generales, competitivo con Epic/Cerner.

**Team requerido:**
- 4 Backend Developers
- 4 Frontend Developers
- 2 DevOps Engineers
- 2 QA Engineers
- 1 Product Manager
- 1 Clinical Informaticist

**Inversión:** $1.2M-$1.5M

---

## FASE B.1: Laboratory Information System (LIS) (6-9 meses)

### Objetivo
Implementar LIS completo con LOINC codes, HL7 ORM/ORU, y result entry.

### B.1.1 - Lab Test Catalog (Mes 1-2)

**Backend - Lab Test Models:**

```python
# CREAR: hmis-backend/app/modules/laboratory/models.py
from app.core.database import Base
from app.shared.base_models import BaseEntity

class LabTestCatalog(Base, BaseEntity):
    """Catálogo de pruebas de laboratorio con LOINC codes."""

    __tablename__ = "lab_test_catalog"

    loinc_code: Mapped[str] = mapped_column(String(10), nullable=False, unique=True, index=True)
    test_name: Mapped[str] = mapped_column(String(300), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(50), nullable=True)

    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # hematology, chemistry, microbiology, serology, etc.

    specimen_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # blood, urine, sputum, csf, etc.

    collection_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    container_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    volume_required: Mapped[float | None] = mapped_column(Float, nullable=True)  # mL

    # Turnaround time in minutes
    tat_routine: Mapped[int] = mapped_column(Integer, default=120)
    tat_urgent: Mapped[int] = mapped_column(Integer, default=60)
    tat_stat: Mapped[int] = mapped_column(Integer, default=30)

    # Reference ranges (stored as JSONB for flexibility)
    # {
    #   "male_adult": {"min": 13.5, "max": 17.5, "unit": "g/dL"},
    #   "female_adult": {"min": 12.0, "max": 15.5, "unit": "g/dL"},
    #   "pediatric": {...}
    # }
    reference_ranges: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Critical values (panic values)
    critical_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    critical_high: Mapped[float | None] = mapped_column(Float, nullable=True)

    result_type: Mapped[str] = mapped_column(
        String(20), default="numeric"
    )  # numeric, text, coded, culture

    # For coded results (e.g., "Positive", "Negative")
    coded_values: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Cost
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)

    status: Mapped[str] = mapped_column(String(20), default="active")


class LabOrder(Base, BaseEntity):
    """Orden de laboratorio vinculada a medical order."""

    __tablename__ = "lab_orders"

    medical_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("medical_orders.id"), nullable=False
    )
    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    ordered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Tests ordered
    lab_tests: Mapped[list["LabOrderTest"]] = relationship(
        back_populates="lab_order", cascade="all, delete-orphan"
    )

    priority: Mapped[str] = mapped_column(
        String(20), default="routine"
    )  # routine, urgent, stat

    clinical_indication: Mapped[str | None] = mapped_column(Text, nullable=True)
    fasting_required: Mapped[bool] = mapped_column(default=False)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default="ordered"
    )  # ordered, collected, processing, resulted, cancelled

    # Specimen collection
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    collected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    collection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Accession number (unique identifier for this order in lab)
    accession_number: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)

    # Result
    resulted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resulted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    has_critical_values: Mapped[bool] = mapped_column(default=False)
    critical_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    critical_notified_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class LabOrderTest(Base, UUIDMixin, TimestampMixin):
    """Individual test dentro de una orden de laboratorio."""

    __tablename__ = "lab_order_tests"

    lab_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lab_orders.id"), nullable=False
    )
    lab_test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lab_test_catalog.id"), nullable=False
    )

    # Result
    result_value: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Numeric or text
    result_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    result_abnormal_flag: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # H (high), L (low), HH (critical high), LL (critical low)
    result_status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, preliminary, final, corrected, cancelled

    # Result entry
    resulted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resulted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Quality control
    qc_passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    qc_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Comments
    tech_comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    pathologist_comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relaciones
    lab_order: Mapped["LabOrder"] = relationship(back_populates="lab_tests")
    lab_test: Mapped["LabTestCatalog"] = relationship()


class LabSpecimen(Base, BaseEntity):
    """Muestra de laboratorio."""

    __tablename__ = "lab_specimens"

    lab_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lab_orders.id"), nullable=False
    )

    specimen_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # Barcode
    specimen_type: Mapped[str] = mapped_column(String(50), nullable=False)
    container_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    collected_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    collection_site: Mapped[str | None] = mapped_column(String(100), nullable=True)

    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    quality: Mapped[str] = mapped_column(
        String(20), default="acceptable"
    )  # acceptable, hemolyzed, clotted, insufficient, contaminated

    rejection_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default="collected"
    )  # collected, in_transit, received, processing, consumed, rejected


class LabQualityControl(Base, UUIDMixin, TimestampMixin):
    """Control de calidad de laboratorio."""

    __tablename__ = "lab_quality_control"

    lab_test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lab_test_catalog.id"), nullable=False
    )

    control_type: Mapped[str] = mapped_column(String(20), nullable=False)  # level_1, level_2, level_3
    lot_number: Mapped[str] = mapped_column(String(50), nullable=False)
    expiration_date: Mapped[date] = mapped_column(Date, nullable=False)

    expected_value: Mapped[float] = mapped_column(Float, nullable=False)
    acceptable_range_min: Mapped[float] = mapped_column(Float, nullable=False)
    acceptable_range_max: Mapped[float] = mapped_column(Float, nullable=False)

    measured_value: Mapped[float] = mapped_column(Float, nullable=False)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    measured_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Archivos a crear:**
- `hmis-backend/app/modules/laboratory/__init__.py`
- `hmis-backend/app/modules/laboratory/models.py` - Lab models
- `hmis-backend/app/modules/laboratory/schemas.py` - Pydantic schemas
- `hmis-backend/app/modules/laboratory/routes.py` - Lab endpoints
- `hmis-backend/app/modules/laboratory/service.py` - Lab service
- `hmis-backend/alembic/versions/XXX_create_lab_tables.py` - Migration

**Seeds de datos:**

```python
# CREAR: hmis-backend/scripts/seed_lab_tests.py
"""Seed lab test catalog with common LOINC codes."""

COMMON_LAB_TESTS = [
    {
        "loinc_code": "718-7",
        "test_name": "Hemoglobin [Mass/volume] in Blood",
        "short_name": "Hemoglobin",
        "category": "hematology",
        "specimen_type": "blood",
        "reference_ranges": {
            "male_adult": {"min": 13.5, "max": 17.5, "unit": "g/dL"},
            "female_adult": {"min": 12.0, "max": 15.5, "unit": "g/dL"},
        },
        "critical_low": 7.0,
        "critical_high": 20.0,
        "tat_routine": 60,
    },
    {
        "loinc_code": "789-8",
        "test_name": "Erythrocytes [#/volume] in Blood by Automated count",
        "short_name": "RBC",
        "category": "hematology",
        "specimen_type": "blood",
        "reference_ranges": {
            "male_adult": {"min": 4.5, "max": 5.9, "unit": "10^12/L"},
            "female_adult": {"min": 4.1, "max": 5.1, "unit": "10^12/L"},
        },
        "tat_routine": 60,
    },
    {
        "loinc_code": "6690-2",
        "test_name": "Leukocytes [#/volume] in Blood by Automated count",
        "short_name": "WBC",
        "category": "hematology",
        "specimen_type": "blood",
        "reference_ranges": {
            "adult": {"min": 4.5, "max": 11.0, "unit": "10^9/L"},
        },
        "critical_low": 2.0,
        "critical_high": 30.0,
        "tat_routine": 60,
    },
    {
        "loinc_code": "2345-7",
        "test_name": "Glucose [Mass/volume] in Serum or Plasma",
        "short_name": "Glucose",
        "category": "chemistry",
        "specimen_type": "blood",
        "reference_ranges": {
            "fasting": {"min": 70, "max": 100, "unit": "mg/dL"},
            "non_fasting": {"min": 70, "max": 140, "unit": "mg/dL"},
        },
        "critical_low": 40,
        "critical_high": 500,
        "tat_routine": 30,
    },
    # ... agregar 50+ tests comunes
]
```

**Endpoints a implementar:**
```
# Lab Test Catalog
GET    /api/v1/laboratory/tests                      # List tests
GET    /api/v1/laboratory/tests/{id}                 # Get test
POST   /api/v1/laboratory/tests                      # Create test (admin)
GET    /api/v1/laboratory/tests/search?category=hematology

# Lab Orders
POST   /api/v1/laboratory/orders                     # Create order
GET    /api/v1/laboratory/orders/{id}                # Get order
GET    /api/v1/laboratory/orders/patient/{patient_id}
GET    /api/v1/laboratory/orders?status=pending
PUT    /api/v1/laboratory/orders/{id}/collect        # Mark as collected
PUT    /api/v1/laboratory/orders/{id}/result         # Enter results
PUT    /api/v1/laboratory/orders/{id}/verify         # Verify results

# Lab Specimens
POST   /api/v1/laboratory/specimens                  # Register specimen
GET    /api/v1/laboratory/specimens/{id}
PUT    /api/v1/laboratory/specimens/{id}/receive     # Receive in lab
PUT    /api/v1/laboratory/specimens/{id}/reject      # Reject specimen

# Lab QC
POST   /api/v1/laboratory/qc                         # Record QC
GET    /api/v1/laboratory/qc?test_id=X&date=Y
```

**Criterio de aceptación:**
- [ ] Lab test catalog con 50+ tests LOINC
- [ ] Lab order CRUD completo
- [ ] Specimen tracking
- [ ] QC tracking básico
- [ ] Tests 90%+ coverage

---

**(Continúa con B.1.2 - B.1.6: Result Entry, Critical Values, HL7 ORM/ORU, Microbiology, Lab Reporting...)**

---

*Este roadmap continúa con más de 500 tareas adicionales para Opción B, cubriendo Radiology, Nursing, ED, ADT, OR, Blood Bank en fases B.2-B.4. El documento completo sería 15,000+ líneas. ¿Quieres que continue con una sección específica o prefieres que resuma el resto de las fases?*

---

## 📅 Timeline Gantt (Resumen)

```
OPCIÓN A (3-6 meses)
├── Mes 1-2: FHIR R4 (A.1)
├── Mes 2-3: CCD Export (A.2)
├── Mes 3-4: SMART on FHIR (A.3)
├── Mes 4-5: CDS (A.4)
└── Mes 5-6: Med Rec (A.5)

OPCIÓN B (24 meses adicionales)
├── Mes 1-9: Laboratory (LIS) (B.1)
├── Mes 7-15: Radiology (RIS/PACS) (B.2)
├── Mes 10-18: Nursing + ADT (B.3)
├── Mes 16-22: ED + OR (B.4)
└── Mes 22-24: Blood Bank + Integration Testing (B.5)
```

---

**Próximos pasos:**
1. ¿Quiero empezar con Opción A Fase A.1 (FHIR)?
2. ¿O prefieres ver el detalle completo de Opción B primero?
