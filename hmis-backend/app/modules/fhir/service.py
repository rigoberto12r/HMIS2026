"""
FHIR Service Layer.

Implements FHIR business logic using repository pattern.
Handles conversion between FHIR resources and internal models.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fhir.resources.patient import Patient as FHIRPatient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.fhir.converters import (
    encounter_to_fhir,
    fhir_to_encounter_data,
    fhir_to_patient_data,
    patient_to_fhir,
    vital_signs_to_fhir_observations,
    fhir_observation_to_vital_sign_field,
    diagnosis_to_fhir_condition,
    problem_list_to_fhir_condition,
    prescription_to_fhir_medication_request,
    allergy_to_fhir_allergy_intolerance,
)
from app.modules.fhir.schemas import FHIRBundle, FHIRBundleEntry, PatientSearchParams
from app.modules.patients.models import Patient
from app.modules.patients.repository import PatientRepository
from app.modules.emr.models import Encounter, VitalSigns, Diagnosis, PatientProblemList, Allergy
from app.modules.emr.repository import EncounterRepository, VitalSignsRepository, DiagnosisRepository, ProblemListRepository, AllergyRepository
from app.modules.pharmacy.models import Prescription
from app.modules.pharmacy.repository import PrescriptionRepository
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError


class FHIRService:
    """
    FHIR business logic service.

    Uses PatientRepository for data access and converters for FHIR translation.
    """

    def __init__(self, db: AsyncSession, base_url: str = "http://localhost:8000/api/v1/fhir"):
        self.db = db
        self.patient_repo = PatientRepository(Patient, db)
        self.encounter_repo = EncounterRepository(Encounter, db)
        self.vital_signs_repo = VitalSignsRepository(VitalSigns, db)
        self.diagnosis_repo = DiagnosisRepository(Diagnosis, db)
        self.problem_list_repo = ProblemListRepository(PatientProblemList, db)
        self.prescription_repo = PrescriptionRepository(Prescription, db)
        self.allergy_repo = AllergyRepository(Allergy, db)
        self.base_url = base_url

    async def get_patient_by_id(self, patient_id: UUID) -> FHIRPatient:
        """
        Get FHIR Patient by internal ID.

        Args:
            patient_id: Internal patient UUID

        Returns:
            FHIR Patient resource

        Raises:
            NotFoundError: If patient not found
        """
        patient = await self.patient_repo.get_with_insurance(patient_id)
        if not patient:
            raise NotFoundError("Patient", str(patient_id))

        return patient_to_fhir(patient, self.base_url)

    async def search_patients(self, params: PatientSearchParams) -> FHIRBundle:
        """
        Search patients with FHIR parameters.

        Args:
            params: FHIR search parameters

        Returns:
            FHIR Bundle with search results
        """
        # Map FHIR search params to internal search
        query = None
        if params.family:
            query = params.family
        elif params.given:
            query = params.given
        elif params.identifier:
            query = params.identifier

        # Map FHIR gender to internal
        gender = None
        if params.gender:
            gender_map = {"male": "M", "female": "F", "other": "otro", "unknown": "otro"}
            gender = gender_map.get(params.gender)

        # Search using repository
        patients, total = await self.patient_repo.search(
            query=query,
            gender=gender,
            offset=params.offset,
            limit=params.count,
        )

        # Filter by birthdate if provided
        if params.birthdate:
            birth_date = date.fromisoformat(params.birthdate)
            patients = [p for p in patients if p.birth_date == birth_date]
            total = len(patients)

        # Filter by id if provided
        if params.id:
            try:
                id_uuid = UUID(params.id)
                patients = [p for p in patients if p.id == id_uuid]
                total = len(patients)
            except ValueError:
                patients = []
                total = 0

        # Convert to FHIR Bundle
        entries = [
            FHIRBundleEntry(
                fullUrl=f"{self.base_url}/Patient/{p.id}",
                resource=patient_to_fhir(p, self.base_url).model_dump(mode="json"),
            )
            for p in patients
        ]

        return FHIRBundle(total=total, entry=entries)

    async def create_patient(self, fhir_patient: FHIRPatient, created_by: UUID) -> FHIRPatient:
        """
        Create patient from FHIR Patient resource.

        Args:
            fhir_patient: FHIR Patient resource
            created_by: User ID creating the patient

        Returns:
            Created FHIR Patient resource with generated ID and MRN

        Raises:
            ConflictError: If patient with same document already exists
            ValidationError: If FHIR resource is invalid
        """
        # Convert FHIR to internal data
        patient_data = fhir_to_patient_data(fhir_patient)

        # Check for duplicates by document
        existing = await self.patient_repo.find_by_document(
            patient_data["document_type"],
            patient_data["document_number"],
        )
        if existing:
            raise ConflictError(
                f"Patient with {patient_data['document_type']} {patient_data['document_number']} already exists",
                details={"existing_id": str(existing.id), "existing_mrn": existing.mrn},
            )

        # Generate MRN if not provided
        if "mrn" not in patient_data or not patient_data["mrn"]:
            counter = await self.patient_repo.get_mrn_counter()
            patient_data["mrn"] = f"MRN{counter + 1:08d}"

        # Create patient
        patient = Patient(**patient_data, created_by=created_by, updated_by=created_by)
        patient = await self.patient_repo.create(patient)

        # Reload with relationships
        patient = await self.patient_repo.get_with_insurance(patient.id)

        return patient_to_fhir(patient, self.base_url)

    async def update_patient(
        self, patient_id: UUID, fhir_patient: FHIRPatient, updated_by: UUID
    ) -> FHIRPatient:
        """
        Update patient from FHIR Patient resource.

        Args:
            patient_id: Internal patient UUID
            fhir_patient: FHIR Patient resource with updates
            updated_by: User ID updating the patient

        Returns:
            Updated FHIR Patient resource

        Raises:
            NotFoundError: If patient not found
            ValidationError: If FHIR resource is invalid
        """
        # Get existing patient
        patient = await self.patient_repo.get_with_insurance(patient_id)
        if not patient:
            raise NotFoundError("Patient", str(patient_id))

        # Convert FHIR to internal data
        patient_data = fhir_to_patient_data(fhir_patient)

        # Don't allow changing MRN or document (business rule)
        patient_data.pop("mrn", None)
        patient_data.pop("document_type", None)
        patient_data.pop("document_number", None)

        # Update patient
        for key, value in patient_data.items():
            setattr(patient, key, value)

        patient.updated_by = updated_by
        patient = await self.patient_repo.update(patient)

        # Reload with relationships
        patient = await self.patient_repo.get_with_insurance(patient.id)

        return patient_to_fhir(patient, self.base_url)

    async def delete_patient(self, patient_id: UUID, deleted_by: UUID) -> None:
        """
        Delete (soft delete) patient.

        Args:
            patient_id: Internal patient UUID
            deleted_by: User ID deleting the patient

        Raises:
            NotFoundError: If patient not found
        """
        patient = await self.patient_repo.get(patient_id)
        if not patient:
            raise NotFoundError("Patient", str(patient_id))

        await self.patient_repo.soft_delete(patient_id, deleted_by)

    # ============================================================================
    # ENCOUNTER METHODS
    # ============================================================================

    async def get_encounter_by_id(self, encounter_id: UUID):
        """
        Get FHIR Encounter by internal ID.

        Args:
            encounter_id: Internal encounter UUID

        Returns:
            FHIR Encounter resource

        Raises:
            NotFoundError: If encounter not found
        """
        from fhir.resources.encounter import Encounter as FHIREncounter

        encounter = await self.encounter_repo.get_with_details(encounter_id)
        if not encounter:
            raise NotFoundError("Encounter", str(encounter_id))

        return encounter_to_fhir(encounter, self.base_url)

    async def search_encounters(
        self,
        patient_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        encounter_type: Optional[str] = None,
        status: Optional[str] = None,
        count: int = 20,
        offset: int = 0,
    ) -> FHIRBundle:
        """
        Search encounters with FHIR parameters.

        Args:
            patient_id: Filter by patient
            date_from: Filter by start date (ge)
            date_to: Filter by start date (le)
            encounter_type: Filter by type (ambulatory/emergency/inpatient)
            status: Filter by status (in_progress/completed/cancelled)
            count: Results per page
            offset: Pagination offset

        Returns:
            FHIR Bundle with search results
        """
        # Map FHIR status to internal if provided
        if status:
            status_map = {
                "in-progress": "in_progress",
                "finished": "completed",
                "cancelled": "cancelled",
            }
            status = status_map.get(status, status)

        # Search using repository
        # Note: EncounterRepository doesn't have a search method yet,
        # so we'll use find_by_patient for now
        if patient_id:
            encounters, total = await self.encounter_repo.find_by_patient(
                patient_id=patient_id,
                include_completed=True,
                offset=offset,
                limit=count,
            )
        else:
            # If no patient filter, get recent encounters (this would need a new repo method)
            # For now, return empty results if no patient specified
            encounters = []
            total = 0

        # Apply additional filters in memory (TODO: move to repository)
        if date_from:
            encounters = [e for e in encounters if e.start_datetime.date() >= date_from]
            total = len(encounters)

        if date_to:
            encounters = [e for e in encounters if e.start_datetime.date() <= date_to]
            total = len(encounters)

        if encounter_type:
            encounters = [e for e in encounters if e.encounter_type == encounter_type]
            total = len(encounters)

        if status:
            encounters = [e for e in encounters if e.status == status]
            total = len(encounters)

        # Convert to FHIR Bundle
        entries = [
            FHIRBundleEntry(
                fullUrl=f"{self.base_url}/Encounter/{e.id}",
                resource=encounter_to_fhir(e, self.base_url).model_dump(mode="json"),
            )
            for e in encounters
        ]

        return FHIRBundle(total=total, entry=entries)

    async def create_encounter(self, fhir_encounter, created_by: UUID):
        """
        Create encounter from FHIR Encounter resource.

        Args:
            fhir_encounter: FHIR Encounter resource
            created_by: User ID creating the encounter

        Returns:
            Created FHIR Encounter resource with generated ID

        Raises:
            NotFoundError: If referenced patient doesn't exist
            ValidationError: If FHIR resource is invalid
        """
        from fhir.resources.encounter import Encounter as FHIREncounter

        # Convert FHIR to internal data
        encounter_data = fhir_to_encounter_data(fhir_encounter)

        # Verify patient exists
        patient = await self.patient_repo.get(encounter_data["patient_id"])
        if not patient:
            raise NotFoundError("Patient", str(encounter_data["patient_id"]))

        # Create encounter
        encounter = Encounter(**encounter_data, created_by=created_by, updated_by=created_by)
        encounter = await self.encounter_repo.create(encounter)

        # Reload with relationships
        encounter = await self.encounter_repo.get_with_details(encounter.id)

        return encounter_to_fhir(encounter, self.base_url)

    async def update_encounter(
        self, encounter_id: UUID, fhir_encounter, updated_by: UUID
    ):
        """
        Update encounter from FHIR Encounter resource.

        Args:
            encounter_id: Internal encounter UUID
            fhir_encounter: FHIR Encounter resource with updates
            updated_by: User ID updating the encounter

        Returns:
            Updated FHIR Encounter resource

        Raises:
            NotFoundError: If encounter not found
            ValidationError: If FHIR resource is invalid
        """
        from fhir.resources.encounter import Encounter as FHIREncounter

        # Get existing encounter
        encounter = await self.encounter_repo.get_with_details(encounter_id)
        if not encounter:
            raise NotFoundError("Encounter", str(encounter_id))

        # Convert FHIR to internal data
        encounter_data = fhir_to_encounter_data(fhir_encounter)

        # Don't allow changing patient (business rule)
        encounter_data.pop("patient_id", None)

        # Update encounter
        for key, value in encounter_data.items():
            if value is not None:  # Only update non-null values
                setattr(encounter, key, value)

        encounter.updated_by = updated_by
        encounter = await self.encounter_repo.update(encounter)

        # Reload with relationships
        encounter = await self.encounter_repo.get_with_details(encounter.id)

        return encounter_to_fhir(encounter, self.base_url)


    # ============================================================================
    # OBSERVATION METHODS (Vital Signs)
    # ============================================================================

    async def get_observations_by_vital_signs_id(self, vital_signs_id: UUID):
        """
        Get all FHIR Observations for a VitalSigns record.

        Args:
            vital_signs_id: VitalSigns UUID

        Returns:
            List of FHIR Observation resources

        Raises:
            NotFoundError: If vital signs not found
        """
        from fhir.resources.observation import Observation as FHIRObservation

        vital_signs = await self.vital_signs_repo.get(vital_signs_id)
        if not vital_signs:
            raise NotFoundError("VitalSigns", str(vital_signs_id))

        return vital_signs_to_fhir_observations(vital_signs, self.base_url)

    async def search_observations(
        self,
        patient_id: Optional[UUID] = None,
        encounter_id: Optional[UUID] = None,
        category: Optional[str] = None,
        code: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        count: int = 20,
        offset: int = 0,
    ) -> FHIRBundle:
        """
        Search observations (vital signs) with FHIR parameters.

        Args:
            patient_id: Filter by patient
            encounter_id: Filter by encounter
            category: Filter by category (vital-signs, laboratory)
            code: Filter by LOINC code
            date_from: Filter by measurement date (ge)
            date_to: Filter by measurement date (le)
            count: Results per page
            offset: Pagination offset

        Returns:
            FHIR Bundle with Observation results
        """
        # Build query filters
        filters = {}
        if encounter_id:
            filters["encounter_id"] = encounter_id
        if patient_id:
            filters["patient_id"] = patient_id

        # Get vital signs from repository
        # Note: VitalSignsRepository doesn't have a full search method,
        # so we use find_by or build custom query
        if encounter_id:
            vital_signs_list = await self.vital_signs_repo.find_by_encounter(encounter_id)
            total = len(vital_signs_list)
        elif patient_id:
            vital_signs_list = await self.vital_signs_repo.find_recent_by_patient(
                patient_id, limit=count + offset
            )
            total = len(vital_signs_list)
        else:
            # No filter - return empty for now (could implement global search)
            vital_signs_list = []
            total = 0

        # Apply date filters in memory (TODO: move to repository)
        if date_from:
            vital_signs_list = [vs for vs in vital_signs_list if vs.measured_at.date() >= date_from]
            total = len(vital_signs_list)

        if date_to:
            vital_signs_list = [vs for vs in vital_signs_list if vs.measured_at.date() <= date_to]
            total = len(vital_signs_list)

        # Apply pagination
        vital_signs_list = vital_signs_list[offset : offset + count]

        # Convert to FHIR Observations
        entries = []
        for vs in vital_signs_list:
            observations = vital_signs_to_fhir_observations(vs, self.base_url)

            # Filter by category if specified
            if category:
                observations = [
                    obs
                    for obs in observations
                    if obs.category and obs.category[0].coding[0].code == category
                ]

            # Filter by code if specified
            if code:
                observations = [
                    obs
                    for obs in observations
                    if obs.code and any(c.code == code for c in obs.code.coding)
                ]

            # Add to bundle entries
            for obs in observations:
                entries.append(
                    FHIRBundleEntry(
                        fullUrl=f"{self.base_url}/Observation/{obs.id}",
                        resource=obs.model_dump(mode="json"),
                    )
                )

        return FHIRBundle(total=len(entries), entry=entries)

    async def get_observation_by_id(self, observation_id: str):
        """
        Get single FHIR Observation by composite ID.

        Observation IDs are composite: {vital_signs_id}-{type}
        E.g., "abc123-temp", "abc123-bp"

        Args:
            observation_id: Composite observation ID

        Returns:
            FHIR Observation resource

        Raises:
            NotFoundError: If observation not found
        """
        from fhir.resources.observation import Observation as FHIRObservation

        # Parse composite ID
        parts = observation_id.rsplit("-", 1)
        if len(parts) != 2:
            raise NotFoundError("Observation", observation_id)

        vital_signs_id_str, obs_type = parts

        try:
            vital_signs_id = UUID(vital_signs_id_str)
        except ValueError:
            raise NotFoundError("Observation", observation_id)

        # Get vital signs
        vital_signs = await self.vital_signs_repo.get(vital_signs_id)
        if not vital_signs:
            raise NotFoundError("Observation", observation_id)

        # Convert to observations
        observations = vital_signs_to_fhir_observations(vital_signs, self.base_url)

        # Find matching observation
        for obs in observations:
            if obs.id == observation_id:
                return obs

        raise NotFoundError("Observation", observation_id)

    # =============================================
    # Condition Resource Methods
    # =============================================

    async def search_conditions(
        self,
        patient_id: UUID | None = None,
        encounter_id: UUID | None = None,
        category: str | None = None,
        clinical_status: str | None = None,
        code: str | None = None,
        onset_date_from: date | None = None,
        onset_date_to: date | None = None,
        count: int = 20,
        offset: int = 0,
    ) -> FHIRBundle:
        """
        Search FHIR Conditions (diagnoses and problem list items).
        
        Args:
            patient_id: Filter by patient
            encounter_id: Filter by encounter
            category: Filter by category (encounter-diagnosis or problem-list-item)
            clinical_status: Filter by clinical status (active, resolved, inactive)
            code: Filter by ICD-10 code
            onset_date_from: Filter by onset date (from)
            onset_date_to: Filter by onset date (to)
            count: Results per page
            offset: Pagination offset
            
        Returns:
            FHIR Bundle with Condition resources
        """
        from fhir.resources.condition import Condition as FHIRCondition
        
        conditions: list[FHIRCondition] = []
        
        # Search encounter-based diagnoses if category is not specified or is encounter-diagnosis
        if category is None or category == "encounter-diagnosis":
            if encounter_id:
                diagnoses = await self.diagnosis_repo.find_by_encounter(encounter_id)
            elif patient_id:
                diagnoses = await self.diagnosis_repo.find_by_patient(patient_id)
            else:
                diagnoses = []
            
            # Convert to FHIR Conditions
            for diagnosis in diagnoses:
                # Apply filters
                if clinical_status and diagnosis.status != clinical_status:
                    # Map status to check
                    status_map = {"active": "active", "resolved": "resolved", "chronic": "active", "inactive": "inactive"}
                    if status_map.get(diagnosis.status) != clinical_status:
                        continue
                        
                if code and diagnosis.icd10_code != code:
                    continue
                    
                if onset_date_from and diagnosis.onset_date and diagnosis.onset_date < onset_date_from:
                    continue
                    
                if onset_date_to and diagnosis.onset_date and diagnosis.onset_date > onset_date_to:
                    continue
                
                conditions.append(diagnosis_to_fhir_condition(diagnosis))
        
        # Search problem list items if category is not specified or is problem-list-item
        if category is None or category == "problem-list-item":
            if patient_id:
                if clinical_status == "active":
                    problems = await self.problem_list_repo.find_active_by_patient(patient_id)
                else:
                    # Get all problems for patient
                    problems = await self.problem_list_repo.find_by(patient_id=patient_id)
            else:
                problems = []
            
            # Convert to FHIR Conditions
            for problem in problems:
                # Apply filters
                if clinical_status:
                    status_map = {"active": "active", "resolved": "resolved", "inactive": "inactive"}
                    if status_map.get(problem.status) != clinical_status:
                        continue
                        
                if code and problem.icd10_code != code:
                    continue
                    
                if onset_date_from and problem.onset_date and problem.onset_date < onset_date_from:
                    continue
                    
                if onset_date_to and problem.onset_date and problem.onset_date > onset_date_to:
                    continue
                
                conditions.append(problem_list_to_fhir_condition(problem))
        
        # Apply pagination
        total = len(conditions)
        paginated_conditions = conditions[offset : offset + count]
        
        # Build FHIR Bundle
        entries = []
        for condition in paginated_conditions:
            entry = FHIRBundleEntry(
                fullUrl=f"{self.base_url}/Condition/{condition.id}",
                resource=condition,
            )
            entries.append(entry)
        
        bundle = FHIRBundle(
            type="searchset",
            total=total,
            entry=entries,
        )
        
        return bundle

    async def get_condition_by_id(self, condition_id: UUID) -> "FHIRCondition":
        """
        Get FHIR Condition by ID.
        
        Searches both Diagnosis and PatientProblemList tables.
        
        Args:
            condition_id: Condition UUID (matches diagnosis or problem ID)
            
        Returns:
            FHIR Condition resource
            
        Raises:
            NotFoundError: If condition not found
        """
        from fhir.resources.condition import Condition as FHIRCondition
        
        # Try to find as diagnosis first
        diagnosis = await self.diagnosis_repo.get(condition_id)
        if diagnosis:
            return diagnosis_to_fhir_condition(diagnosis)
        
        # Try to find as problem list item
        problem = await self.problem_list_repo.get(condition_id)
        if problem:
            return problem_list_to_fhir_condition(problem)
        
        raise NotFoundError("Condition", str(condition_id))

    # =============================================
    # MedicationRequest Resource Methods
    # =============================================

    async def search_medication_requests(
        self,
        patient_id: UUID | None = None,
        encounter_id: UUID | None = None,
        status: str | None = None,
        intent: str | None = None,
        authoredon_from: date | None = None,
        authoredon_to: date | None = None,
        count: int = 20,
        offset: int = 0,
    ) -> FHIRBundle:
        """
        Search FHIR MedicationRequests (prescriptions).
        
        Args:
            patient_id: Filter by patient
            encounter_id: Filter by encounter
            status: Filter by status (active, completed, cancelled, stopped)
            intent: Filter by intent (always 'order' for prescriptions)
            authoredon_from: Filter by authored date (from)
            authoredon_to: Filter by authored date (to)
            count: Results per page
            offset: Pagination offset
            
        Returns:
            FHIR Bundle with MedicationRequest resources
        """
        from fhir.resources.medicationrequest import MedicationRequest as FHIRMedicationRequest
        
        # Query prescriptions
        if encounter_id:
            prescriptions = await self.prescription_repo.find_by_encounter(encounter_id)
        elif patient_id:
            prescriptions = await self.prescription_repo.find_by_patient(
                patient_id, 
                status=status if status and status != "completed" and status != "stopped" else None
            )
        else:
            prescriptions = []
        
        # Convert to FHIR MedicationRequests
        medication_requests: list[FHIRMedicationRequest] = []
        for prescription in prescriptions:
            # Apply additional filters
            if status:
                # Map FHIR status to internal status for filtering
                status_map_reverse = {
                    "active": ["active", "partially_dispensed"],
                    "completed": ["dispensed"],
                    "cancelled": ["cancelled"],
                    "stopped": ["expired"],
                }
                if prescription.status not in status_map_reverse.get(status, [status]):
                    continue
            
            if authoredon_from and prescription.created_at and prescription.created_at.date() < authoredon_from:
                continue
            
            if authoredon_to and prescription.created_at and prescription.created_at.date() > authoredon_to:
                continue
            
            medication_requests.append(prescription_to_fhir_medication_request(prescription))
        
        # Apply pagination
        total = len(medication_requests)
        paginated_requests = medication_requests[offset : offset + count]
        
        # Build FHIR Bundle
        entries = []
        for med_request in paginated_requests:
            entry = FHIRBundleEntry(
                fullUrl=f"{self.base_url}/MedicationRequest/{med_request.id}",
                resource=med_request,
            )
            entries.append(entry)
        
        bundle = FHIRBundle(
            type="searchset",
            total=total,
            entry=entries,
        )
        
        return bundle

    async def get_medication_request_by_id(self, medication_request_id: UUID) -> "FHIRMedicationRequest":
        """
        Get FHIR MedicationRequest by ID.
        
        Args:
            medication_request_id: MedicationRequest UUID (same as prescription ID)
            
        Returns:
            FHIR MedicationRequest resource
            
        Raises:
            NotFoundError: If medication request not found
        """
        from fhir.resources.medicationrequest import MedicationRequest as FHIRMedicationRequest
        
        prescription = await self.prescription_repo.get(medication_request_id)
        if not prescription:
            raise NotFoundError("MedicationRequest", str(medication_request_id))
        
        return prescription_to_fhir_medication_request(prescription)

    # =============================================
    # AllergyIntolerance Resource Methods
    # =============================================

    async def search_allergy_intolerances(
        self,
        patient_id: UUID | None = None,
        clinical_status: str | None = None,
        category: str | None = None,
        allergy_type: str | None = None,
        count: int = 20,
        offset: int = 0,
    ) -> FHIRBundle:
        """
        Search FHIR AllergyIntolerances (patient allergies).
        
        Args:
            patient_id: Filter by patient (required)
            clinical_status: Filter by clinical status (active, inactive)
            category: Filter by category (medication, food, environment, biologic)
            allergy_type: Filter by type (always 'allergy' for this system)
            count: Results per page
            offset: Pagination offset
            
        Returns:
            FHIR Bundle with AllergyIntolerance resources
        """
        from fhir.resources.allergyintolerance import AllergyIntolerance as FHIRAllergyIntolerance
        
        if not patient_id:
            # Return empty bundle if no patient specified
            return FHIRBundle(type="searchset", total=0, entry=[])
        
        # Query allergies
        if clinical_status == "active":
            allergies = await self.allergy_repo.find_active_by_patient(patient_id)
        else:
            # Get all allergies for patient
            allergies = await self.allergy_repo.find_by(patient_id=patient_id)
        
        # Convert to FHIR AllergyIntolerances
        allergy_intolerances: list[FHIRAllergyIntolerance] = []
        for allergy in allergies:
            # Apply filters
            if clinical_status:
                status_map = {"active": "active", "inactive": "inactive"}
                if allergy.status != clinical_status:
                    continue
            
            if category:
                # Map internal allergen_type to FHIR category
                allergen_category_map = {
                    "drug": "medication",
                    "food": "food",
                    "environment": "environment",
                    "latex": "environment",
                    "other": "biologic",
                }
                if allergen_category_map.get(allergy.allergen_type) != category:
                    continue
            
            allergy_intolerances.append(allergy_to_fhir_allergy_intolerance(allergy))
        
        # Apply pagination
        total = len(allergy_intolerances)
        paginated_allergies = allergy_intolerances[offset : offset + count]
        
        # Build FHIR Bundle
        entries = []
        for allergy_intolerance in paginated_allergies:
            entry = FHIRBundleEntry(
                fullUrl=f"{self.base_url}/AllergyIntolerance/{allergy_intolerance.id}",
                resource=allergy_intolerance,
            )
            entries.append(entry)
        
        bundle = FHIRBundle(
            type="searchset",
            total=total,
            entry=entries,
        )
        
        return bundle

    async def get_allergy_intolerance_by_id(self, allergy_id: UUID) -> "FHIRAllergyIntolerance":
        """
        Get FHIR AllergyIntolerance by ID.
        
        Args:
            allergy_id: AllergyIntolerance UUID (same as allergy ID)
            
        Returns:
            FHIR AllergyIntolerance resource
            
        Raises:
            NotFoundError: If allergy intolerance not found
        """
        from fhir.resources.allergyintolerance import AllergyIntolerance as FHIRAllergyIntolerance
        
        allergy = await self.allergy_repo.get(allergy_id)
        if not allergy:
            raise NotFoundError("AllergyIntolerance", str(allergy_id))

        return allergy_to_fhir_allergy_intolerance(allergy)

    # =============================================
    # $everything Operation
    # =============================================

    async def get_patient_everything(self, patient_id: UUID) -> FHIRBundle:
        """
        FHIR $everything operation for Patient resource.

        Returns a Bundle containing the Patient and all related resources:
        - Patient resource
        - All Encounters
        - All Observations (vital signs)
        - All Conditions (diagnoses + problem list)
        - All MedicationRequests (prescriptions)
        - All AllergyIntolerances

        This operation is useful for exporting a complete patient record.

        Args:
            patient_id: Patient UUID

        Returns:
            FHIR Bundle of type "searchset" with all patient-related resources

        Raises:
            NotFoundError: If patient not found
        """
        # Verify patient exists
        patient = await self.patient_repo.get_with_insurance(patient_id)
        if not patient:
            raise NotFoundError("Patient", str(patient_id))

        entries = []

        # 1. Add Patient resource
        patient_fhir = patient_to_fhir(patient, self.base_url)
        entries.append(
            FHIRBundleEntry(
                fullUrl=f"{self.base_url}/Patient/{patient_id}",
                resource=patient_fhir,
            )
        )

        # 2. Add all Encounters
        encounters = await self.encounter_repo.find_by_patient(patient_id)
        for encounter in encounters:
            encounter_fhir = encounter_to_fhir(encounter)
            entries.append(
                FHIRBundleEntry(
                    fullUrl=f"{self.base_url}/Encounter/{encounter.id}",
                    resource=encounter_fhir,
                )
            )

        # 3. Add all Observations (vital signs)
        vital_signs_list = await self.vital_signs_repo.find_by_patient(patient_id)
        for vital_signs in vital_signs_list:
            observations = vital_signs_to_fhir_observations(vital_signs)
            for observation in observations:
                entries.append(
                    FHIRBundleEntry(
                        fullUrl=f"{self.base_url}/Observation/{observation.id}",
                        resource=observation,
                    )
                )

        # 4. Add all Conditions (diagnoses)
        diagnoses = await self.diagnosis_repo.find_by_patient(patient_id)
        for diagnosis in diagnoses:
            condition_fhir = diagnosis_to_fhir_condition(diagnosis)
            entries.append(
                FHIRBundleEntry(
                    fullUrl=f"{self.base_url}/Condition/{diagnosis.id}",
                    resource=condition_fhir,
                )
            )

        # 5. Add all Conditions (problem list)
        problems = await self.problem_list_repo.find_by_patient(patient_id)
        for problem in problems:
            condition_fhir = problem_list_to_fhir_condition(problem)
            entries.append(
                FHIRBundleEntry(
                    fullUrl=f"{self.base_url}/Condition/{problem.id}",
                    resource=condition_fhir,
                )
            )

        # 6. Add all MedicationRequests (prescriptions)
        prescriptions = await self.prescription_repo.find_by_patient(patient_id)
        for prescription in prescriptions:
            med_request_fhir = prescription_to_fhir_medication_request(prescription)
            entries.append(
                FHIRBundleEntry(
                    fullUrl=f"{self.base_url}/MedicationRequest/{prescription.id}",
                    resource=med_request_fhir,
                )
            )

        # 7. Add all AllergyIntolerances
        allergies = await self.allergy_repo.find_by_patient(patient_id)
        for allergy in allergies:
            allergy_fhir = allergy_to_fhir_allergy_intolerance(allergy)
            entries.append(
                FHIRBundleEntry(
                    fullUrl=f"{self.base_url}/AllergyIntolerance/{allergy.id}",
                    resource=allergy_fhir,
                )
            )

        # Build comprehensive Bundle
        bundle = FHIRBundle(
            type="searchset",
            total=len(entries),
            entry=entries,
        )

        return bundle
