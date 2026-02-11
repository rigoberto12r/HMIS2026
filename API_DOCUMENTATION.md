# HMIS SaaS - API Documentation

**Version:** 1.0.0
**Last Updated:** February 7, 2026
**Base URL:** `https://api.hmis.example.com/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
   - [Patients](#patients)
   - [Appointments](#appointments)
   - [EMR](#emr-electronic-medical-records)
   - [Billing](#billing)
   - [Payments (Stripe)](#payments-stripe)
   - [Pharmacy](#pharmacy)
   - [Reports](#reports)
   - [Patient Portal](#patient-portal)
   - [Admin](#admin)
3. [Request/Response Formats](#requestresponse-formats)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Pagination](#pagination)
7. [Filtering & Search](#filtering--search)
8. [Multi-Tenancy](#multi-tenancy)
9. [SDK Examples](#sdk-examples)

---

## Authentication

### Authentication Flow

HMIS uses **JWT (JSON Web Tokens)** for authentication with refresh token rotation.

**Token Lifespan:**
- Access Token: 30 minutes
- Refresh Token: 7 days

### Login

**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**
```json
{
  "email": "user@hospital.com",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@hospital.com",
    "first_name": "John",
    "last_name": "Doe",
    "roles": ["medico"]
  }
}
```

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@hospital.com",
    "password": "SecurePassword123!"
  }'
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `400 Bad Request`: Missing email or password

---

### Refresh Token

**Endpoint:** `POST /api/v1/auth/refresh`

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

### Get Current User

**Endpoint:** `GET /api/v1/auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@hospital.com",
  "first_name": "John",
  "last_name": "Doe",
  "is_verified": true,
  "tenant_id": "hospital_central",
  "roles": ["medico"],
  "permissions": ["patients:read", "patients:write", "encounters:write"]
}
```

**cURL Example:**
```bash
curl -X GET https://api.hmis.example.com/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Change Password

**Endpoint:** `POST /api/v1/auth/change-password`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword456!"
}
```

**Response:** `200 OK`
```json
{
  "mensaje": "Contrasena actualizada correctamente"
}
```

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "OldPassword123!",
    "new_password": "NewPassword456!"
  }'
```

---

## API Endpoints

All endpoints require the `Authorization` header with a valid access token unless otherwise specified.

### Patients

#### Create Patient

**Endpoint:** `POST /api/v1/patients`

**Permission Required:** `patients:write`

**Request Body:**
```json
{
  "first_name": "Maria",
  "last_name": "Garcia",
  "date_of_birth": "1985-03-15",
  "gender": "female",
  "document_type": "passport",
  "document_number": "AB123456",
  "phone": "+1-809-555-0100",
  "email": "maria.garcia@email.com",
  "address": "Calle Principal 123",
  "city": "Santo Domingo",
  "state": "Distrito Nacional",
  "postal_code": "10101",
  "country": "DO",
  "emergency_contact_name": "Juan Garcia",
  "emergency_contact_phone": "+1-809-555-0101"
}
```

**Response:** `201 Created`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "mrn": "MRN-2026-00001",
  "first_name": "Maria",
  "last_name": "Garcia",
  "date_of_birth": "1985-03-15",
  "gender": "female",
  "document_type": "passport",
  "document_number": "AB123456",
  "status": "active",
  "created_at": "2026-02-07T10:30:00Z",
  "updated_at": "2026-02-07T10:30:00Z"
}
```

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/patients \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Maria",
    "last_name": "Garcia",
    "date_of_birth": "1985-03-15",
    "gender": "female",
    "document_type": "passport",
    "document_number": "AB123456",
    "phone": "+1-809-555-0100",
    "email": "maria.garcia@email.com",
    "address": "Calle Principal 123",
    "city": "Santo Domingo",
    "state": "Distrito Nacional",
    "postal_code": "10101",
    "country": "DO"
  }'
```

---

#### Search Patients

**Endpoint:** `GET /api/v1/patients/search`

**Permission Required:** `patients:read`

**Query Parameters:**
- `query` (optional): Search by name, MRN, or document number
- `document_type` (optional): Filter by document type
- `gender` (optional): Filter by gender (male, female, other)
- `status` (optional): Filter by status (active, inactive). Default: active
- `page` (optional): Page number. Default: 1
- `page_size` (optional): Items per page. Default: 20

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "mrn": "MRN-2026-00001",
      "first_name": "Maria",
      "last_name": "Garcia",
      "date_of_birth": "1985-03-15",
      "gender": "female",
      "document_number": "AB123456",
      "phone": "+1-809-555-0100",
      "status": "active"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

**cURL Example:**
```bash
curl -X GET "https://api.hmis.example.com/api/v1/patients/search?query=Maria&page=1&page_size=20" \
  -H "Authorization: Bearer <token>"
```

---

#### Get Patient by ID

**Endpoint:** `GET /api/v1/patients/{patient_id}`

**Permission Required:** `patients:read`

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "mrn": "MRN-2026-00001",
  "first_name": "Maria",
  "last_name": "Garcia",
  "date_of_birth": "1985-03-15",
  "gender": "female",
  "document_type": "passport",
  "document_number": "AB123456",
  "phone": "+1-809-555-0100",
  "email": "maria.garcia@email.com",
  "address": "Calle Principal 123",
  "city": "Santo Domingo",
  "state": "Distrito Nacional",
  "postal_code": "10101",
  "country": "DO",
  "status": "active",
  "insurances": [
    {
      "id": "789e4567-e89b-12d3-a456-426614174000",
      "insurance_provider": "ARS Humano",
      "policy_number": "POL-123456",
      "group_number": "GRP-001",
      "is_primary": true,
      "effective_date": "2025-01-01",
      "expiration_date": "2026-12-31"
    }
  ],
  "created_at": "2026-02-07T10:30:00Z",
  "updated_at": "2026-02-07T10:30:00Z"
}
```

**cURL Example:**
```bash
curl -X GET https://api.hmis.example.com/api/v1/patients/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

---

#### Get Patient by MRN

**Endpoint:** `GET /api/v1/patients/mrn/{mrn}`

**Permission Required:** `patients:read`

**Response:** `200 OK` (same as Get Patient by ID)

**cURL Example:**
```bash
curl -X GET https://api.hmis.example.com/api/v1/patients/mrn/MRN-2026-00001 \
  -H "Authorization: Bearer <token>"
```

---

#### Update Patient

**Endpoint:** `PATCH /api/v1/patients/{patient_id}`

**Permission Required:** `patients:write`

**Request Body:** (all fields optional)
```json
{
  "phone": "+1-809-555-0999",
  "email": "newemail@email.com",
  "address": "Nueva Direccion 456"
}
```

**Response:** `200 OK` (updated patient object)

**cURL Example:**
```bash
curl -X PATCH https://api.hmis.example.com/api/v1/patients/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1-809-555-0999"
  }'
```

---

#### Add Patient Insurance

**Endpoint:** `POST /api/v1/patients/{patient_id}/insurances`

**Permission Required:** `patients:write`

**Request Body:**
```json
{
  "insurance_provider": "ARS Humano",
  "policy_number": "POL-123456",
  "group_number": "GRP-001",
  "is_primary": true,
  "effective_date": "2025-01-01",
  "expiration_date": "2026-12-31"
}
```

**Response:** `201 Created`
```json
{
  "id": "789e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "insurance_provider": "ARS Humano",
  "policy_number": "POL-123456",
  "group_number": "GRP-001",
  "is_primary": true,
  "effective_date": "2025-01-01",
  "expiration_date": "2026-12-31"
}
```

---

#### Deactivate Patient

**Endpoint:** `DELETE /api/v1/patients/{patient_id}`

**Permission Required:** `patients:write`

**Response:** `200 OK`
```json
{
  "mensaje": "Paciente desactivado correctamente"
}
```

**Note:** This is a soft delete. Patient status is set to "inactive" but record remains in database.

---

### Appointments

#### Create Appointment

**Endpoint:** `POST /api/v1/appointments`

**Permission Required:** `appointments:write`

**Request Body:**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "provider_id": "456e7890-e89b-12d3-a456-426614174000",
  "appointment_type": "consultation",
  "scheduled_start": "2026-02-10T14:00:00Z",
  "scheduled_end": "2026-02-10T14:30:00Z",
  "notes": "Follow-up for hypertension"
}
```

**Response:** `201 Created`
```json
{
  "id": "789e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "provider_id": "456e7890-e89b-12d3-a456-426614174000",
  "appointment_type": "consultation",
  "status": "scheduled",
  "scheduled_start": "2026-02-10T14:00:00Z",
  "scheduled_end": "2026-02-10T14:30:00Z",
  "notes": "Follow-up for hypertension",
  "patient": {
    "mrn": "MRN-2026-00001",
    "first_name": "Maria",
    "last_name": "Garcia"
  },
  "provider": {
    "first_name": "Dr. Carlos",
    "last_name": "Rodriguez",
    "specialty": "Cardiologia"
  },
  "created_at": "2026-02-07T10:30:00Z"
}
```

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/appointments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "123e4567-e89b-12d3-a456-426614174000",
    "provider_id": "456e7890-e89b-12d3-a456-426614174000",
    "appointment_type": "consultation",
    "scheduled_start": "2026-02-10T14:00:00Z",
    "scheduled_end": "2026-02-10T14:30:00Z",
    "notes": "Follow-up for hypertension"
  }'
```

---

#### List Appointments

**Endpoint:** `GET /api/v1/appointments`

**Permission Required:** `appointments:read`

**Query Parameters:**
- `provider_id` (optional): Filter by provider
- `patient_id` (optional): Filter by patient
- `start_date` (optional): Filter from date (YYYY-MM-DD)
- `end_date` (optional): Filter to date (YYYY-MM-DD)
- `status` (optional): Filter by status (scheduled, confirmed, arrived, in_progress, completed, cancelled, no_show)
- `page` (optional): Page number
- `page_size` (optional): Items per page

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "789e4567-e89b-12d3-a456-426614174000",
      "patient_mrn": "MRN-2026-00001",
      "patient_name": "Maria Garcia",
      "provider_name": "Dr. Carlos Rodriguez",
      "appointment_type": "consultation",
      "status": "scheduled",
      "scheduled_start": "2026-02-10T14:00:00Z",
      "scheduled_end": "2026-02-10T14:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

**cURL Example:**
```bash
curl -X GET "https://api.hmis.example.com/api/v1/appointments?start_date=2026-02-10&end_date=2026-02-17" \
  -H "Authorization: Bearer <token>"
```

---

#### Get Appointment by ID

**Endpoint:** `GET /api/v1/appointments/{appointment_id}`

**Permission Required:** `appointments:read`

**Response:** `200 OK` (full appointment object with patient and provider details)

---

#### Update Appointment Status

**Endpoint:** `PATCH /api/v1/appointments/{appointment_id}/status`

**Permission Required:** `appointments:write`

**Request Body:**
```json
{
  "status": "confirmed",
  "notes": "Patient confirmed via phone"
}
```

**Valid Status Transitions:**
- `scheduled` → `confirmed`, `cancelled`
- `confirmed` → `arrived`, `cancelled`
- `arrived` → `in_progress`, `cancelled`
- `in_progress` → `completed`
- Any → `no_show`

**Response:** `200 OK` (updated appointment object)

**cURL Example:**
```bash
curl -X PATCH https://api.hmis.example.com/api/v1/appointments/789e4567-e89b-12d3-a456-426614174000/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed"
  }'
```

---

#### Reschedule Appointment

**Endpoint:** `POST /api/v1/appointments/{appointment_id}/reschedule`

**Permission Required:** `appointments:write`

**Request Body:**
```json
{
  "new_start": "2026-02-11T10:00:00Z",
  "new_end": "2026-02-11T10:30:00Z",
  "reason": "Patient requested earlier time"
}
```

**Response:** `200 OK` (updated appointment)

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/appointments/789e4567-e89b-12d3-a456-426614174000/reschedule \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_start": "2026-02-11T10:00:00Z",
    "new_end": "2026-02-11T10:30:00Z",
    "reason": "Patient requested earlier time"
  }'
```

---

#### Get Provider Availability

**Endpoint:** `GET /api/v1/appointments/providers/{provider_id}/availability`

**Permission Required:** `appointments:read`

**Query Parameters:**
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)

**Response:** `200 OK`
```json
[
  {
    "date": "2026-02-10",
    "start_time": "09:00:00",
    "end_time": "09:30:00",
    "available": true
  },
  {
    "date": "2026-02-10",
    "start_time": "09:30:00",
    "end_time": "10:00:00",
    "available": false
  }
]
```

**cURL Example:**
```bash
curl -X GET "https://api.hmis.example.com/api/v1/appointments/providers/456e7890-e89b-12d3-a456-426614174000/availability?start_date=2026-02-10&end_date=2026-02-17" \
  -H "Authorization: Bearer <token>"
```

---

### EMR (Electronic Medical Records)

#### Create Encounter

**Endpoint:** `POST /api/v1/emr/encounters`

**Permission Required:** `encounters:write`

**Request Body:**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "provider_id": "456e7890-e89b-12d3-a456-426614174000",
  "encounter_type": "outpatient",
  "chief_complaint": "Persistent headache for 3 days",
  "appointment_id": "789e4567-e89b-12d3-a456-426614174000"
}
```

**Response:** `201 Created`
```json
{
  "id": "321e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "provider_id": "456e7890-e89b-12d3-a456-426614174000",
  "encounter_type": "outpatient",
  "status": "in_progress",
  "chief_complaint": "Persistent headache for 3 days",
  "encounter_date": "2026-02-07T10:30:00Z",
  "created_at": "2026-02-07T10:30:00Z"
}
```

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/emr/encounters \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "123e4567-e89b-12d3-a456-426614174000",
    "provider_id": "456e7890-e89b-12d3-a456-426614174000",
    "encounter_type": "outpatient",
    "chief_complaint": "Persistent headache for 3 days"
  }'
```

---

#### Record Vital Signs

**Endpoint:** `POST /api/v1/emr/vitals`

**Permission Required:** `vitals:write`

**Request Body:**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "blood_pressure_systolic": 120,
  "blood_pressure_diastolic": 80,
  "heart_rate": 72,
  "respiratory_rate": 16,
  "temperature": 36.8,
  "temperature_unit": "celsius",
  "oxygen_saturation": 98,
  "height_cm": 165,
  "weight_kg": 70
}
```

**Response:** `201 Created`
```json
{
  "id": "654e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "blood_pressure_systolic": 120,
  "blood_pressure_diastolic": 80,
  "heart_rate": 72,
  "respiratory_rate": 16,
  "temperature": 36.8,
  "temperature_unit": "celsius",
  "oxygen_saturation": 98,
  "height_cm": 165,
  "weight_kg": 70,
  "bmi": 25.7,
  "measured_at": "2026-02-07T10:35:00Z",
  "measured_by": "456e7890-e89b-12d3-a456-426614174000"
}
```

**Note:** BMI is automatically calculated from height and weight.

---

#### Create SOAP Note

**Endpoint:** `POST /api/v1/emr/notes`

**Permission Required:** `encounters:write`

**Request Body:**
```json
{
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "note_type": "soap",
  "subjective": "Patient reports persistent headache for 3 days. Pain rated 7/10. No nausea or vision changes.",
  "objective": "BP 120/80, HR 72, Temp 36.8°C. Neurological exam normal. No focal deficits.",
  "assessment": "Tension-type headache",
  "plan": "Prescribe ibuprofen 400mg TID. Follow up in 1 week if no improvement. Consider imaging if symptoms worsen."
}
```

**Response:** `201 Created`
```json
{
  "id": "987e4567-e89b-12d3-a456-426614174000",
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "note_type": "soap",
  "subjective": "Patient reports persistent headache...",
  "objective": "BP 120/80, HR 72...",
  "assessment": "Tension-type headache",
  "plan": "Prescribe ibuprofen 400mg TID...",
  "is_signed": false,
  "created_at": "2026-02-07T10:40:00Z",
  "created_by": "456e7890-e89b-12d3-a456-426614174000"
}
```

---

#### Sign Clinical Note

**Endpoint:** `POST /api/v1/emr/notes/{note_id}/sign`

**Permission Required:** `medico` role

**Response:** `200 OK`
```json
{
  "id": "987e4567-e89b-12d3-a456-426614174000",
  "is_signed": true,
  "signed_at": "2026-02-07T10:45:00Z",
  "signed_by": "456e7890-e89b-12d3-a456-426614174000"
}
```

**Note:** Once signed, the note becomes immutable. Corrections require creating an addendum note.

---

#### Create Diagnosis

**Endpoint:** `POST /api/v1/emr/diagnoses`

**Permission Required:** `encounters:write`

**Request Body:**
```json
{
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "icd10_code": "G44.2",
  "description": "Tension-type headache",
  "diagnosis_type": "primary",
  "status": "active"
}
```

**Response:** `201 Created`
```json
{
  "id": "111e4567-e89b-12d3-a456-426614174000",
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "icd10_code": "G44.2",
  "description": "Tension-type headache",
  "diagnosis_type": "primary",
  "status": "active",
  "diagnosed_at": "2026-02-07T10:40:00Z"
}
```

---

#### Get Patient Diagnoses

**Endpoint:** `GET /api/v1/emr/patients/{patient_id}/diagnoses`

**Permission Required:** `encounters:read`

**Query Parameters:**
- `status` (optional): Filter by status (active, resolved, chronic)

**Response:** `200 OK`
```json
[
  {
    "id": "111e4567-e89b-12d3-a456-426614174000",
    "icd10_code": "G44.2",
    "description": "Tension-type headache",
    "diagnosis_type": "primary",
    "status": "active",
    "diagnosed_at": "2026-02-07T10:40:00Z"
  }
]
```

---

#### Record Allergy

**Endpoint:** `POST /api/v1/emr/allergies`

**Permission Required:** `encounters:write`

**Request Body:**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "allergen": "Penicillin",
  "reaction": "Rash, hives",
  "severity": "moderate",
  "onset_date": "2020-05-10"
}
```

**Response:** `201 Created`
```json
{
  "id": "222e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "allergen": "Penicillin",
  "reaction": "Rash, hives",
  "severity": "moderate",
  "onset_date": "2020-05-10",
  "status": "active",
  "created_at": "2026-02-07T10:30:00Z"
}
```

---

#### Get Patient Allergies

**Endpoint:** `GET /api/v1/emr/patients/{patient_id}/allergies`

**Permission Required:** `encounters:read`

**Response:** `200 OK`
```json
[
  {
    "id": "222e4567-e89b-12d3-a456-426614174000",
    "allergen": "Penicillin",
    "reaction": "Rash, hives",
    "severity": "moderate",
    "onset_date": "2020-05-10",
    "status": "active"
  }
]
```

---

#### Create Medical Order

**Endpoint:** `POST /api/v1/emr/orders`

**Permission Required:** `medico` role

**Request Body:**
```json
{
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "order_type": "laboratory",
  "order_code": "CBC",
  "description": "Complete Blood Count",
  "clinical_indication": "Routine screening",
  "is_stat": false
}
```

**Response:** `201 Created`
```json
{
  "id": "333e4567-e89b-12d3-a456-426614174000",
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "order_type": "laboratory",
  "order_code": "CBC",
  "description": "Complete Blood Count",
  "status": "pending",
  "ordered_at": "2026-02-07T10:45:00Z",
  "ordered_by": "456e7890-e89b-12d3-a456-426614174000"
}
```

---

### Billing

#### Create Invoice

**Endpoint:** `POST /api/v1/billing/invoices`

**Permission Required:** `billing:write`

**Request Body:**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "billing_type": "self_pay",
  "customer_name": "Maria Garcia",
  "customer_tax_id": "001-0123456-7",
  "customer_address": "Calle Principal 123",
  "fiscal_type": "B01",
  "country_code": "DO",
  "currency": "DOP",
  "lines": [
    {
      "description": "Consulta General",
      "quantity": 1,
      "unit_price": 1500.00,
      "discount": 0,
      "tax_rate": 18
    },
    {
      "description": "Analisis de Sangre",
      "quantity": 1,
      "unit_price": 800.00,
      "discount": 0,
      "tax_rate": 18
    }
  ],
  "due_date": "2026-03-07"
}
```

**Response:** `201 Created`
```json
{
  "id": "444e4567-e89b-12d3-a456-426614174000",
  "invoice_number": "INV-2026-00001",
  "fiscal_number": "B0100000001",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "billing_type": "self_pay",
  "customer_name": "Maria Garcia",
  "customer_tax_id": "001-0123456-7",
  "status": "draft",
  "currency": "DOP",
  "subtotal": 2300.00,
  "discount_total": 0.00,
  "tax_total": 414.00,
  "grand_total": 2714.00,
  "lines": [
    {
      "description": "Consulta General",
      "quantity": 1,
      "unit_price": 1500.00,
      "discount": 0.00,
      "tax": 270.00,
      "line_total": 1770.00
    },
    {
      "description": "Analisis de Sangre",
      "quantity": 1,
      "unit_price": 800.00,
      "discount": 0.00,
      "tax": 144.00,
      "line_total": 944.00
    }
  ],
  "due_date": "2026-03-07",
  "created_at": "2026-02-07T11:00:00Z"
}
```

---

#### List Invoices

**Endpoint:** `GET /api/v1/billing/invoices`

**Permission Required:** `billing:read`

**Query Parameters:**
- `patient_id` (optional): Filter by patient
- `status` (optional): Filter by status (draft, sent, paid, overdue, cancelled)
- `page`, `page_size`: Pagination

**Response:** `200 OK` (paginated list of invoices)

---

#### Get Invoice by ID

**Endpoint:** `GET /api/v1/billing/invoices/{invoice_id}`

**Permission Required:** `billing:read`

**Response:** `200 OK` (full invoice with lines and payment history)

---

#### Download Invoice PDF

**Endpoint:** `GET /api/v1/billing/invoices/{invoice_id}/pdf`

**Permission Required:** `billing:read`

**Response:** `200 OK`
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename=factura_INV-2026-00001.pdf`

**cURL Example:**
```bash
curl -X GET https://api.hmis.example.com/api/v1/billing/invoices/444e4567-e89b-12d3-a456-426614174000/pdf \
  -H "Authorization: Bearer <token>" \
  --output invoice.pdf
```

---

#### Record Payment

**Endpoint:** `POST /api/v1/billing/payments`

**Permission Required:** `billing:write`

**Request Body:**
```json
{
  "invoice_id": "444e4567-e89b-12d3-a456-426614174000",
  "amount": 2714.00,
  "payment_method": "cash",
  "payment_date": "2026-02-07",
  "reference_number": "",
  "notes": "Full payment received in cash"
}
```

**Response:** `201 Created`
```json
{
  "id": "555e4567-e89b-12d3-a456-426614174000",
  "invoice_id": "444e4567-e89b-12d3-a456-426614174000",
  "amount": 2714.00,
  "payment_method": "cash",
  "payment_date": "2026-02-07",
  "status": "completed",
  "created_at": "2026-02-07T11:15:00Z"
}
```

**Note:** Invoice status automatically updates to "paid" when full amount is received.

---

#### Create Insurance Claim

**Endpoint:** `POST /api/v1/billing/claims`

**Permission Required:** `claims:write`

**Request Body:**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "insurance_id": "789e4567-e89b-12d3-a456-426614174000",
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "invoice_id": "444e4567-e89b-12d3-a456-426614174000",
  "claim_amount": 2714.00,
  "diagnosis_codes": ["G44.2"],
  "procedure_codes": ["99213"],
  "service_date": "2026-02-07"
}
```

**Response:** `201 Created`
```json
{
  "id": "666e4567-e89b-12d3-a456-426614174000",
  "claim_number": "CLM-2026-00001",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "insurance_provider": "ARS Humano",
  "status": "draft",
  "claim_amount": 2714.00,
  "created_at": "2026-02-07T11:20:00Z"
}
```

---

#### Submit Claim

**Endpoint:** `POST /api/v1/billing/claims/{claim_id}/submit`

**Permission Required:** `claims:write`

**Response:** `200 OK`
```json
{
  "id": "666e4567-e89b-12d3-a456-426614174000",
  "status": "submitted",
  "submitted_at": "2026-02-07T11:25:00Z"
}
```

---

### Payments (Stripe)

#### Create Payment Intent

**Endpoint:** `POST /api/v1/payments/stripe/payment-intents`

**Permission Required:** Authenticated user

**Request Body:**
```json
{
  "invoice_id": "444e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 2714.00,
  "currency": "dop",
  "customer_email": "maria.garcia@email.com",
  "customer_name": "Maria Garcia",
  "save_payment_method": true
}
```

**Response:** `201 Created`
```json
{
  "payment_intent_id": "pi_3AbCdEfGhIjKlMnO",
  "client_secret": "pi_3AbCdEfGhIjKlMnO_secret_XyZaBcDeFgHiJkLm",
  "customer_id": "cus_AbCdEfGhIjKl",
  "amount": 2714.00,
  "currency": "dop",
  "status": "requires_payment_method"
}
```

**Usage:** The `client_secret` is used on the frontend with Stripe Elements to complete the payment.

**cURL Example:**
```bash
curl -X POST https://api.hmis.example.com/api/v1/payments/stripe/payment-intents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "444e4567-e89b-12d3-a456-426614174000",
    "patient_id": "123e4567-e89b-12d3-a456-426614174000",
    "amount": 2714.00,
    "currency": "dop",
    "customer_email": "maria.garcia@email.com",
    "customer_name": "Maria Garcia"
  }'
```

---

#### Get Payment Intent Status

**Endpoint:** `GET /api/v1/payments/stripe/payment-intents/{payment_intent_id}`

**Permission Required:** Authenticated user

**Response:** `200 OK`
```json
{
  "payment_intent_id": "pi_3AbCdEfGhIjKlMnO",
  "status": "succeeded",
  "amount": 2714.00,
  "currency": "dop",
  "payment_method": "card",
  "last4": "4242",
  "brand": "visa"
}
```

---

#### Create Refund

**Endpoint:** `POST /api/v1/payments/stripe/refunds`

**Permission Required:** `billing:write`

**Request Body:**
```json
{
  "payment_intent_id": "pi_3AbCdEfGhIjKlMnO",
  "amount": 2714.00,
  "reason": "requested_by_customer"
}
```

**Response:** `200 OK`
```json
{
  "refund_id": "re_3AbCdEfGhIjKlMnO",
  "amount": 2714.00,
  "currency": "dop",
  "status": "succeeded",
  "created_at": "2026-02-07T11:30:00Z"
}
```

---

#### Stripe Webhook (No Auth)

**Endpoint:** `POST /api/v1/payments/stripe/webhooks`

**Permission Required:** None (public endpoint)

**Headers:**
```
Stripe-Signature: t=1234567890,v1=abcdef...
```

**Request Body:** (Stripe webhook event JSON)

**Response:** `200 OK`
```json
{
  "event_type": "payment_intent.succeeded",
  "processed": true
}
```

**Note:** This endpoint verifies the Stripe signature before processing. Configure this URL in your Stripe Dashboard.

---

### Pharmacy

#### Create Prescription

**Endpoint:** `POST /api/v1/pharmacy/prescriptions`

**Permission Required:** `medico` role

**Request Body:**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "encounter_id": "321e4567-e89b-12d3-a456-426614174000",
  "product_id": "777e4567-e89b-12d3-a456-426614174000",
  "dosage": "400mg",
  "frequency": "Every 8 hours",
  "route": "oral",
  "duration_days": 7,
  "quantity": 21,
  "refills_allowed": 0,
  "instructions": "Take with food. Complete full course."
}
```

**Response:** `201 Created`
```json
{
  "id": "888e4567-e89b-12d3-a456-426614174000",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "product": {
    "id": "777e4567-e89b-12d3-a456-426614174000",
    "name": "Ibuprofen",
    "strength": "400mg"
  },
  "dosage": "400mg",
  "frequency": "Every 8 hours",
  "route": "oral",
  "duration_days": 7,
  "quantity": 21,
  "refills_allowed": 0,
  "refills_used": 0,
  "status": "active",
  "prescribed_at": "2026-02-07T10:50:00Z",
  "prescribed_by": "456e7890-e89b-12d3-a456-426614174000"
}
```

---

#### Dispense Medication

**Endpoint:** `POST /api/v1/pharmacy/dispensations`

**Permission Required:** `farmaceutico` role

**Request Body:**
```json
{
  "prescription_id": "888e4567-e89b-12d3-a456-426614174000",
  "lot_id": "999e4567-e89b-12d3-a456-426614174000",
  "quantity_dispensed": 21
}
```

**Response:** `201 Created`
```json
{
  "id": "aaa4567-e89b-12d3-a456-426614174000",
  "prescription_id": "888e4567-e89b-12d3-a456-426614174000",
  "lot_number": "LOT-2026-001",
  "quantity_dispensed": 21,
  "dispensed_at": "2026-02-07T12:00:00Z",
  "dispensed_by": "999e4567-e89b-12d3-a456-426614174000"
}
```

**Note:** System validates:
- Prescription is active
- Lot has sufficient quantity
- Lot is not expired
- No drug allergies
- For controlled substances, creates audit log entry

---

#### Get Stock Levels

**Endpoint:** `GET /api/v1/pharmacy/inventory/stock`

**Permission Required:** `inventory:read`

**Query Parameters:**
- `warehouse_id` (optional): Filter by warehouse
- `low_stock_only` (optional): Show only items below reorder point

**Response:** `200 OK`
```json
[
  {
    "product_id": "777e4567-e89b-12d3-a456-426614174000",
    "product_name": "Ibuprofen 400mg",
    "warehouse_id": "bbb4567-e89b-12d3-a456-426614174000",
    "warehouse_name": "Farmacia Central",
    "quantity_on_hand": 150,
    "reorder_point": 50,
    "status": "adequate"
  },
  {
    "product_id": "ccc4567-e89b-12d3-a456-426614174000",
    "product_name": "Amoxicillin 500mg",
    "warehouse_id": "bbb4567-e89b-12d3-a456-426614174000",
    "warehouse_name": "Farmacia Central",
    "quantity_on_hand": 30,
    "reorder_point": 50,
    "status": "low"
  }
]
```

---

#### Get Expiring Lots

**Endpoint:** `GET /api/v1/pharmacy/lots/expiring`

**Permission Required:** `inventory:read`

**Query Parameters:**
- `days` (optional): Days ahead to check. Default: 90

**Response:** `200 OK`
```json
[
  {
    "id": "ddd4567-e89b-12d3-a456-426614174000",
    "lot_number": "LOT-2025-050",
    "product_name": "Aspirin 100mg",
    "quantity_remaining": 200,
    "expiration_date": "2026-04-15",
    "days_until_expiry": 67
  }
]
```

---

### Reports

#### List Report Definitions

**Endpoint:** `GET /api/v1/reports/definitions`

**Permission Required:** `reports:read`

**Query Parameters:**
- `report_type` (optional): Filter by type (clinical, financial, operational)
- `skip`, `limit`: Pagination

**Response:** `200 OK`
```json
[
  {
    "id": "eee4567-e89b-12d3-a456-426614174000",
    "name": "Monthly Revenue Report",
    "report_type": "financial",
    "description": "Total revenue by service category",
    "is_active": true
  }
]
```

---

#### Execute Report

**Endpoint:** `POST /api/v1/reports/execute`

**Permission Required:** `reports:read`

**Request Body:**
```json
{
  "definition_id": "eee4567-e89b-12d3-a456-426614174000",
  "parameters": {
    "start_date": "2026-02-01",
    "end_date": "2026-02-29"
  },
  "output_format": "json"
}
```

**Response:** `200 OK`
```json
{
  "report_id": "fff4567-e89b-12d3-a456-426614174000",
  "report_name": "Monthly Revenue Report",
  "executed_at": "2026-02-07T12:30:00Z",
  "parameters": {
    "start_date": "2026-02-01",
    "end_date": "2026-02-29"
  },
  "data": [
    {
      "category": "Consultations",
      "revenue": 45000.00,
      "count": 30
    },
    {
      "category": "Laboratory",
      "revenue": 28000.00,
      "count": 35
    }
  ],
  "summary": {
    "total_revenue": 73000.00,
    "total_services": 65
  }
}
```

---

#### Export Report

**Endpoint:** `POST /api/v1/reports/export`

**Permission Required:** `reports:read`

**Request Body:**
```json
{
  "report_id": "fff4567-e89b-12d3-a456-426614174000",
  "format": "pdf"
}
```

**Response:** `200 OK`
- Content-Type: `application/pdf` or `application/vnd.ms-excel`
- Content-Disposition: `attachment; filename=report.pdf`

**Supported Formats:** `pdf`, `excel`, `csv`

---

### Patient Portal

**Note:** Portal endpoints use separate authentication for patients.

#### Register Patient Account

**Endpoint:** `POST /api/v1/portal/register`

**Permission Required:** None (public)

**Request Body:**
```json
{
  "email": "maria.garcia@email.com",
  "password": "SecurePass123!",
  "first_name": "Maria",
  "last_name": "Garcia",
  "date_of_birth": "1985-03-15",
  "document_type": "passport",
  "document_number": "AB123456",
  "phone": "+1-809-555-0100"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Account created successfully. Please verify your email."
}
```

---

#### Patient Login

**Endpoint:** `POST /api/v1/portal/login`

**Permission Required:** None (public)

**Request Body:**
```json
{
  "email": "maria.garcia@email.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK` (same as register)

---

#### Get Portal Profile

**Endpoint:** `GET /api/v1/portal/profile`

**Permission Required:** Authenticated patient

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "mrn": "MRN-2026-00001",
  "first_name": "Maria",
  "last_name": "Garcia",
  "date_of_birth": "1985-03-15",
  "email": "maria.garcia@email.com",
  "phone": "+1-809-555-0100",
  "address": "Calle Principal 123"
}
```

---

#### List Portal Appointments

**Endpoint:** `GET /api/v1/portal/appointments`

**Permission Required:** Authenticated patient

**Query Parameters:**
- `status` (optional): upcoming, past

**Response:** `200 OK`
```json
[
  {
    "id": "789e4567-e89b-12d3-a456-426614174000",
    "provider_name": "Dr. Carlos Rodriguez",
    "specialty": "Cardiologia",
    "appointment_type": "consultation",
    "scheduled_start": "2026-02-10T14:00:00Z",
    "status": "confirmed",
    "location": "Consultorio 3"
  }
]
```

---

#### Book Portal Appointment

**Endpoint:** `POST /api/v1/portal/appointments/book`

**Permission Required:** Authenticated patient

**Request Body:**
```json
{
  "provider_id": "456e7890-e89b-12d3-a456-426614174000",
  "scheduled_start": "2026-02-15T10:00:00Z",
  "scheduled_end": "2026-02-15T10:30:00Z",
  "reason": "Annual checkup"
}
```

**Response:** `201 Created` (appointment object)

---

#### Cancel Portal Appointment

**Endpoint:** `POST /api/v1/portal/appointments/{appointment_id}/cancel`

**Permission Required:** Authenticated patient

**Request Body:**
```json
{
  "reason": "Schedule conflict"
}
```

**Response:** `200 OK`
```json
{
  "message": "Appointment cancelled successfully"
}
```

---

#### Get Portal Medical Records

**Endpoint:** `GET /api/v1/portal/medical-records`

**Permission Required:** Authenticated patient

**Response:** `200 OK`
```json
{
  "allergies": [
    {
      "allergen": "Penicillin",
      "reaction": "Rash, hives",
      "severity": "moderate"
    }
  ],
  "active_diagnoses": [
    {
      "icd10_code": "I10",
      "description": "Essential hypertension",
      "diagnosed_at": "2024-06-10"
    }
  ],
  "active_medications": [
    {
      "medication": "Lisinopril 10mg",
      "dosage": "10mg daily",
      "prescribed_at": "2024-06-10"
    }
  ]
}
```

---

#### List Portal Prescriptions

**Endpoint:** `GET /api/v1/portal/prescriptions`

**Permission Required:** Authenticated patient

**Response:** `200 OK`
```json
[
  {
    "id": "888e4567-e89b-12d3-a456-426614174000",
    "medication": "Lisinopril 10mg",
    "dosage": "10mg",
    "frequency": "Once daily",
    "prescribed_by": "Dr. Carlos Rodriguez",
    "prescribed_at": "2024-06-10",
    "refills_remaining": 5,
    "expires_at": "2025-06-10"
  }
]
```

---

#### Request Prescription Refill

**Endpoint:** `POST /api/v1/portal/prescriptions/{prescription_id}/refill`

**Permission Required:** Authenticated patient

**Request Body:**
```json
{
  "notes": "Running low on medication"
}
```

**Response:** `200 OK`
```json
{
  "message": "Refill request submitted. Pharmacy will review and contact you."
}
```

---

#### List Portal Invoices

**Endpoint:** `GET /api/v1/portal/invoices`

**Permission Required:** Authenticated patient

**Query Parameters:**
- `status` (optional): unpaid, paid, all

**Response:** `200 OK`
```json
[
  {
    "id": "444e4567-e89b-12d3-a456-426614174000",
    "invoice_number": "INV-2026-00001",
    "date": "2026-02-07",
    "total_amount": 2714.00,
    "amount_paid": 2714.00,
    "balance_due": 0.00,
    "status": "paid"
  }
]
```

---

#### Get Portal Invoice Details

**Endpoint:** `GET /api/v1/portal/invoices/{invoice_id}`

**Permission Required:** Authenticated patient

**Response:** `200 OK` (full invoice details with line items and payment history)

---

#### Pay Portal Invoice

**Endpoint:** `POST /api/v1/portal/invoices/{invoice_id}/pay`

**Permission Required:** Authenticated patient

**Request Body:**
```json
{
  "payment_method_id": "pm_card_visa",
  "amount": 2714.00
}
```

**Response:** `200 OK`
```json
{
  "payment_intent_id": "pi_3AbCdEfGhIjKlMnO",
  "status": "succeeded",
  "message": "Payment successful"
}
```

---

### Admin

**Note:** All admin endpoints require superuser or admin role.

#### Create Tenant

**Endpoint:** `POST /api/v1/admin/tenants`

**Permission Required:** Superuser only

**Request Body:**
```json
{
  "tenant_id": "hospital_norte",
  "hospital_name": "Hospital del Norte",
  "country": "DO",
  "admin_email": "admin@hospitalnorte.com",
  "admin_password": "SecurePass123!",
  "admin_first_name": "Juan",
  "admin_last_name": "Perez"
}
```

**Response:** `201 Created`
```json
{
  "tenant_id": "hospital_norte",
  "schema_name": "tenant_hospital_norte",
  "hospital_name": "Hospital del Norte",
  "admin_email": "admin@hospitalnorte.com",
  "mensaje": "Tenant 'Hospital del Norte' creado exitosamente con schema tenant_hospital_norte"
}
```

---

#### List Tenants

**Endpoint:** `GET /api/v1/admin/tenants`

**Permission Required:** Superuser only

**Response:** `200 OK`
```json
[
  {
    "tenant_id": "hospital_norte",
    "hospital_name": "Hospital del Norte",
    "country": "DO",
    "created_at": "2026-02-07T13:00:00Z",
    "is_active": true
  }
]
```

---

#### Deactivate Tenant

**Endpoint:** `PATCH /api/v1/admin/tenants/{tenant_id}/deactivate`

**Permission Required:** Superuser only

**Response:** `200 OK`
```json
{
  "mensaje": "Tenant 'hospital_norte' desactivado exitosamente"
}
```

---

#### Create User

**Endpoint:** `POST /api/v1/auth/users`

**Permission Required:** `users:write`

**Request Body:**
```json
{
  "email": "doctor@hospital.com",
  "password": "TempPass123!",
  "first_name": "Ana",
  "last_name": "Martinez",
  "roles": ["medico"]
}
```

**Response:** `201 Created`
```json
{
  "id": "ggg4567-e89b-12d3-a456-426614174000",
  "email": "doctor@hospital.com",
  "first_name": "Ana",
  "last_name": "Martinez",
  "roles": ["medico"],
  "is_verified": false,
  "created_at": "2026-02-07T13:10:00Z"
}
```

---

#### List Users

**Endpoint:** `GET /api/v1/auth/users`

**Permission Required:** `users:read`

**Query Parameters:**
- `page`, `page_size`: Pagination

**Response:** `200 OK` (paginated list of users)

---

## Request/Response Formats

### Standard Request Headers

All authenticated requests must include:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Multi-tenant header (optional, defaults to user's tenant):

```http
X-Tenant-ID: hospital_central
```

### Standard Response Format

**Success Response:**

```json
{
  "id": "uuid",
  "field1": "value",
  "field2": 123,
  "created_at": "2026-02-07T10:30:00Z",
  "updated_at": "2026-02-07T10:30:00Z"
}
```

**List Response (Paginated):**

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

**Message Response:**

```json
{
  "mensaje": "Operation completed successfully"
}
```

### Date and Time Formats

**Dates:** ISO 8601 format `YYYY-MM-DD`
- Example: `2026-02-07`

**DateTimes:** ISO 8601 format with timezone `YYYY-MM-DDTHH:MM:SSZ`
- Example: `2026-02-07T10:30:00Z`
- All times are in UTC

---

## Error Handling

### Error Response Format

```json
{
  "detail": "Error message describing what went wrong"
}
```

### HTTP Status Codes

**Success:**
- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `204 No Content` - Request successful, no content to return

**Client Errors:**
- `400 Bad Request` - Invalid request body or parameters
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate patient)
- `422 Unprocessable Entity` - Validation error

**Server Errors:**
- `500 Internal Server Error` - Unexpected server error
- `503 Service Unavailable` - Service temporarily unavailable

### Error Examples

**Validation Error (422):**

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "Invalid email format",
      "type": "value_error.email"
    },
    {
      "loc": ["body", "password"],
      "msg": "Password must be at least 8 characters",
      "type": "value_error"
    }
  ]
}
```

**Authentication Error (401):**

```json
{
  "detail": "Could not validate credentials"
}
```

**Permission Error (403):**

```json
{
  "detail": "User does not have required permission: patients:write"
}
```

**Not Found (404):**

```json
{
  "detail": "Patient not found"
}
```

**Conflict (409):**

```json
{
  "detail": "Patient with document number AB123456 already exists"
}
```

---

## Rate Limiting

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1612699200
```

### Rate Limits

**Per IP Address:**
- 100 requests per minute
- 1000 requests per hour

**Per User:**
- 1000 requests per hour
- 10,000 requests per day

**Exceeded Response:**

`429 Too Many Requests`

```json
{
  "detail": "Rate limit exceeded. Try again in 45 seconds."
}
```

### Best Practices

- Implement exponential backoff for retries
- Cache responses when appropriate
- Use webhooks for real-time updates instead of polling

---

## Pagination

### Query Parameters

```
?page=1&page_size=20
```

**Parameters:**
- `page` (optional): Page number, default: 1
- `page_size` (optional): Items per page, default: 20, max: 100

### Response Format

```json
{
  "items": [...],
  "total": 250,
  "page": 1,
  "page_size": 20,
  "total_pages": 13
}
```

### Example

```bash
curl -X GET "https://api.hmis.example.com/api/v1/patients/search?page=2&page_size=50" \
  -H "Authorization: Bearer <token>"
```

---

## Filtering & Search

### Query Syntax

**Full-text search:**
```
?query=searchterm
```

**Field-specific filters:**
```
?gender=female&status=active
```

**Date range filters:**
```
?start_date=2026-02-01&end_date=2026-02-29
```

**Combining filters:**
```
?query=maria&status=active&page=1
```

### Example

```bash
curl -X GET "https://api.hmis.example.com/api/v1/patients/search?query=Garcia&gender=female&status=active" \
  -H "Authorization: Bearer <token>"
```

---

## Multi-Tenancy

### Tenant Isolation

HMIS uses schema-per-tenant architecture for data isolation. Each hospital has its own PostgreSQL schema.

### Tenant Resolution

**Automatic (Recommended):**
- Tenant is determined from authenticated user's `tenant_id`
- No additional headers required

**Manual (Advanced):**
- Add `X-Tenant-ID` header to override
- Only allowed for superusers

```http
X-Tenant-ID: hospital_central
```

### Example

```bash
curl -X GET https://api.hmis.example.com/api/v1/patients/search \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: hospital_norte"
```

---

## SDK Examples

### Python Client

```python
import requests

class HMISClient:
    def __init__(self, base_url, email, password):
        self.base_url = base_url
        self.access_token = None
        self.refresh_token = None
        self.login(email, password)

    def login(self, email, password):
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

    def search_patients(self, query):
        response = requests.get(
            f"{self.base_url}/patients/search",
            headers=self._headers(),
            params={"query": query}
        )
        response.raise_for_status()
        return response.json()

    def create_patient(self, patient_data):
        response = requests.post(
            f"{self.base_url}/patients",
            headers=self._headers(),
            json=patient_data
        )
        response.raise_for_status()
        return response.json()

# Usage
client = HMISClient(
    base_url="https://api.hmis.example.com/api/v1",
    email="user@hospital.com",
    password="password"
)

# Search patients
patients = client.search_patients("Maria")

# Create patient
new_patient = client.create_patient({
    "first_name": "Juan",
    "last_name": "Lopez",
    "date_of_birth": "1990-05-20",
    "gender": "male",
    "document_type": "passport",
    "document_number": "CD789012",
    "phone": "+1-809-555-0200",
    "email": "juan.lopez@email.com",
    "address": "Calle Secundaria 456",
    "city": "Santo Domingo",
    "state": "Distrito Nacional",
    "postal_code": "10101",
    "country": "DO"
})
```

### JavaScript/TypeScript Client

```typescript
class HMISClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) throw new Error('Login failed');

    const data = await response.json();
    this.accessToken = data.access_token;
  }

  private headers(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async searchPatients(query: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/patients/search?query=${encodeURIComponent(query)}`,
      { headers: this.headers() }
    );

    if (!response.ok) throw new Error('Search failed');
    return response.json();
  }

  async createPatient(patientData: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/patients`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(patientData)
    });

    if (!response.ok) throw new Error('Create failed');
    return response.json();
  }
}

// Usage
const client = new HMISClient('https://api.hmis.example.com/api/v1');
await client.login('user@hospital.com', 'password');

const patients = await client.searchPatients('Maria');
```

---

## Interactive API Explorer

Visit the **Swagger UI** for interactive API exploration:

**URL:** `https://api.hmis.example.com/api/docs`

Features:
- Try out endpoints directly in browser
- View detailed request/response schemas
- Copy cURL commands
- Authentication with JWT tokens

---

**End of API Documentation**

For deployment information, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
For user guide, see [USER_MANUAL.md](./USER_MANUAL.md)
For developer guide, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
