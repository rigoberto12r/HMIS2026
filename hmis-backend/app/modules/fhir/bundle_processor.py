"""
FHIR Bundle batch/transaction processor.

Handles FHIR Bundle operations (batch and transaction) per FHIR R4 specification.
"""

from typing import Any
from uuid import UUID

from fhir.resources.bundle import Bundle, BundleEntry, BundleEntryRequest, BundleEntryResponse
from fhir.resources.operationoutcome import OperationOutcome, OperationOutcomeIssue
from fhir.resources.patient import Patient as FHIRPatient
from fhir.resources.encounter import Encounter as FHIREncounter
from fhir.resources.condition import Condition as FHIRCondition
from fhir.resources.medicationrequest import MedicationRequest as FHIRMedicationRequest
from fhir.resources.allergyintolerance import AllergyIntolerance as FHIRAllergyIntolerance
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.fhir.service import FHIRService
from app.shared.exceptions import NotFoundError, ValidationError, ConflictError


class BundleProcessor:
    """
    Processes FHIR Bundle resources (batch and transaction).

    Batch: Process all entries independently, continue on error.
    Transaction: Atomic operation, rollback all changes on any error.
    """

    def __init__(self, db: AsyncSession, fhir_service: FHIRService, user_id: UUID):
        """
        Initialize bundle processor.

        Args:
            db: Database session
            fhir_service: FHIR service instance
            user_id: Current user ID for audit trail
        """
        self.db = db
        self.fhir_service = fhir_service
        self.user_id = user_id

    async def process_bundle(self, bundle: Bundle) -> Bundle:
        """
        Process FHIR Bundle (batch or transaction).

        Args:
            bundle: FHIR Bundle with type 'batch' or 'transaction'

        Returns:
            FHIR Bundle with entry.response for each request

        Raises:
            ValidationError: If bundle type is invalid or transaction fails
        """
        if bundle.type not in ["batch", "transaction"]:
            raise ValidationError(
                f"Unsupported bundle type: {bundle.type}. Must be 'batch' or 'transaction'.",
                details={"bundle_type": bundle.type}
            )

        if not bundle.entry:
            raise ValidationError("Bundle must contain at least one entry.")

        # Process based on bundle type
        if bundle.type == "batch":
            return await self._process_batch(bundle)
        else:
            return await self._process_transaction(bundle)

    async def _process_batch(self, bundle: Bundle) -> Bundle:
        """
        Process batch bundle (independent requests, continue on error).

        Args:
            bundle: FHIR Bundle with type 'batch'

        Returns:
            FHIR Bundle with response for each entry
        """
        response_entries = []

        for entry in bundle.entry:
            try:
                response = await self._process_entry(entry)
                response_entries.append(response)
            except Exception as e:
                # In batch mode, continue on error and return OperationOutcome
                error_response = self._create_error_response(entry, e)
                response_entries.append(error_response)

        return Bundle(
            type="batch-response",
            entry=response_entries,
        )

    async def _process_transaction(self, bundle: Bundle) -> Bundle:
        """
        Process transaction bundle (atomic, all-or-nothing).

        Args:
            bundle: FHIR Bundle with type 'transaction'

        Returns:
            FHIR Bundle with response for each entry

        Raises:
            ValidationError: If any entry fails (triggers rollback)
        """
        response_entries = []

        # Use savepoint for nested transaction
        async with self.db.begin_nested():
            try:
                for entry in bundle.entry:
                    response = await self._process_entry(entry)
                    response_entries.append(response)

                # Commit all changes
                await self.db.commit()

            except Exception as e:
                # Rollback all changes on any error
                await self.db.rollback()
                raise ValidationError(
                    f"Transaction failed: {str(e)}. All changes rolled back.",
                    details={"error": str(e), "error_type": type(e).__name__}
                )

        return Bundle(
            type="transaction-response",
            entry=response_entries,
        )

    async def _process_entry(self, entry: BundleEntry) -> BundleEntry:
        """
        Process a single bundle entry.

        Args:
            entry: Bundle entry with request

        Returns:
            Bundle entry with response

        Raises:
            ValidationError: If request is invalid
            NotFoundError: If resource not found
            ConflictError: If resource conflicts
        """
        if not entry.request:
            raise ValidationError("Bundle entry must have a request.")

        request: BundleEntryRequest = entry.request
        method = request.method.upper()
        url = request.url

        # Parse resource type and ID from URL
        resource_type, resource_id = self._parse_url(url)

        # Process based on HTTP method
        if method == "GET":
            return await self._process_get(resource_type, resource_id, url)
        elif method == "POST":
            return await self._process_post(resource_type, entry.resource)
        elif method == "PUT":
            return await self._process_put(resource_type, resource_id, entry.resource)
        elif method == "DELETE":
            return await self._process_delete(resource_type, resource_id)
        else:
            raise ValidationError(f"Unsupported HTTP method: {method}")

    def _parse_url(self, url: str) -> tuple[str, str | None]:
        """
        Parse FHIR URL into resource type and ID.

        Args:
            url: FHIR URL (e.g., "Patient/123" or "Patient?identifier=...")

        Returns:
            Tuple of (resource_type, resource_id or None for search)
        """
        parts = url.split("?")[0].split("/")
        resource_type = parts[0]
        resource_id = parts[1] if len(parts) > 1 else None
        return resource_type, resource_id

    async def _process_get(self, resource_type: str, resource_id: str | None, url: str) -> BundleEntry:
        """
        Process GET request (read or search).

        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID (None for search)
            url: Full URL with query params

        Returns:
            Bundle entry with response containing resource or search results
        """
        if resource_id:
            # GET by ID
            resource = await self._get_resource_by_id(resource_type, resource_id)
            return BundleEntry(
                resource=resource,
                response=BundleEntryResponse(
                    status="200 OK",
                ),
            )
        else:
            # Search (return OperationOutcome - search not fully supported in bundles)
            raise ValidationError(
                "Search operations in bundles are not yet supported. Use direct search endpoints.",
                details={"url": url}
            )

    async def _process_post(self, resource_type: str, resource: Any) -> BundleEntry:
        """
        Process POST request (create).

        Args:
            resource_type: FHIR resource type
            resource: FHIR resource to create

        Returns:
            Bundle entry with response containing created resource
        """
        created_resource = await self._create_resource(resource_type, resource)

        return BundleEntry(
            resource=created_resource,
            response=BundleEntryResponse(
                status="201 Created",
                location=f"{resource_type}/{created_resource.id}",
            ),
        )

    async def _process_put(self, resource_type: str, resource_id: str, resource: Any) -> BundleEntry:
        """
        Process PUT request (update).

        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID to update
            resource: FHIR resource with updates

        Returns:
            Bundle entry with response containing updated resource
        """
        updated_resource = await self._update_resource(resource_type, resource_id, resource)

        return BundleEntry(
            resource=updated_resource,
            response=BundleEntryResponse(
                status="200 OK",
            ),
        )

    async def _process_delete(self, resource_type: str, resource_id: str) -> BundleEntry:
        """
        Process DELETE request.

        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID to delete

        Returns:
            Bundle entry with response (no content)
        """
        await self._delete_resource(resource_type, resource_id)

        return BundleEntry(
            response=BundleEntryResponse(
                status="204 No Content",
            ),
        )

    async def _get_resource_by_id(self, resource_type: str, resource_id: str) -> Any:
        """
        Get FHIR resource by ID.

        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID

        Returns:
            FHIR resource

        Raises:
            NotFoundError: If resource not found
            ValidationError: If resource type not supported
        """
        resource_id_uuid = UUID(resource_id)

        if resource_type == "Patient":
            return await self.fhir_service.get_patient_by_id(resource_id_uuid)
        elif resource_type == "Encounter":
            return await self.fhir_service.get_encounter_by_id(resource_id_uuid)
        elif resource_type == "Observation":
            return await self.fhir_service.get_observation_by_id(resource_id)
        elif resource_type == "Condition":
            return await self.fhir_service.get_condition_by_id(resource_id)
        elif resource_type == "MedicationRequest":
            return await self.fhir_service.get_medication_request_by_id(resource_id_uuid)
        elif resource_type == "AllergyIntolerance":
            return await self.fhir_service.get_allergy_intolerance_by_id(resource_id_uuid)
        else:
            raise ValidationError(f"Unsupported resource type: {resource_type}")

    async def _create_resource(self, resource_type: str, resource: Any) -> Any:
        """
        Create FHIR resource.

        Args:
            resource_type: FHIR resource type
            resource: FHIR resource to create

        Returns:
            Created FHIR resource

        Raises:
            ValidationError: If resource type not supported or validation fails
        """
        if resource_type == "Patient":
            return await self.fhir_service.create_patient(FHIRPatient(**resource.dict()), self.user_id)
        elif resource_type == "Encounter":
            return await self.fhir_service.create_encounter(FHIREncounter(**resource.dict()), self.user_id)
        else:
            raise ValidationError(
                f"Create operation not supported for resource type: {resource_type}. "
                f"Only Patient and Encounter creation is supported."
            )

    async def _update_resource(self, resource_type: str, resource_id: str, resource: Any) -> Any:
        """
        Update FHIR resource.

        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID to update
            resource: FHIR resource with updates

        Returns:
            Updated FHIR resource

        Raises:
            ValidationError: If resource type not supported
        """
        resource_id_uuid = UUID(resource_id)

        if resource_type == "Patient":
            return await self.fhir_service.update_patient(resource_id_uuid, FHIRPatient(**resource.dict()), self.user_id)
        elif resource_type == "Encounter":
            return await self.fhir_service.update_encounter(resource_id_uuid, FHIREncounter(**resource.dict()), self.user_id)
        else:
            raise ValidationError(
                f"Update operation not supported for resource type: {resource_type}. "
                f"Only Patient and Encounter updates are supported."
            )

    async def _delete_resource(self, resource_type: str, resource_id: str) -> None:
        """
        Delete FHIR resource (soft delete).

        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID to delete

        Raises:
            ValidationError: If resource type not supported
        """
        resource_id_uuid = UUID(resource_id)

        if resource_type == "Patient":
            await self.fhir_service.delete_patient(resource_id_uuid)
        else:
            raise ValidationError(
                f"Delete operation not supported for resource type: {resource_type}. "
                f"Only Patient deletion is supported."
            )

    def _create_error_response(self, entry: BundleEntry, error: Exception) -> BundleEntry:
        """
        Create error response for batch entry.

        Args:
            entry: Original bundle entry
            error: Exception that occurred

        Returns:
            Bundle entry with OperationOutcome
        """
        # Determine status code based on error type
        if isinstance(error, NotFoundError):
            status = "404 Not Found"
            severity = "error"
        elif isinstance(error, ValidationError):
            status = "400 Bad Request"
            severity = "error"
        elif isinstance(error, ConflictError):
            status = "409 Conflict"
            severity = "error"
        else:
            status = "500 Internal Server Error"
            severity = "fatal"

        outcome = OperationOutcome(
            issue=[
                OperationOutcomeIssue(
                    severity=severity,
                    code="processing",
                    diagnostics=str(error),
                )
            ]
        )

        return BundleEntry(
            resource=outcome,
            response=BundleEntryResponse(
                status=status,
                outcome=outcome,
            ),
        )
