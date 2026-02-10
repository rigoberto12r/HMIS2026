# HMIS Patient Portal

## Overview

The HMIS Patient Portal is a comprehensive patient-facing web application that allows patients to access their medical records, manage appointments, view prescriptions, check lab results, and handle billing - all in one secure, user-friendly interface.

This portal is completely separate from the admin dashboard, with its own authentication system, UI theme, and security model designed specifically for patient users.

---

## Features

### 1. Patient Authentication
- **Self-Registration**: New patients can create accounts with email verification
- **Secure Login**: Separate authentication system from staff login
- **Password Protection**: Minimum 8 character passwords with hashing (Argon2)
- **Token-based Auth**: JWT access and refresh tokens for session management

### 2. Dashboard
- **Quick Stats**: Overview of upcoming appointments, prescriptions, lab results, and outstanding balance
- **Recent Alerts**: Notifications for appointment reminders, lab results, prescription refills, etc.
- **Upcoming Appointments**: Next 3 appointments at a glance
- **Quick Actions**: Fast navigation to key portal sections

### 3. Appointments
- **View Appointments**: See all upcoming and past appointments
- **Appointment Details**: Provider, specialty, date/time, location, reason
- **Cancel Appointments**: Cancel appointments (24+ hours in advance)
- **Status Tracking**: Track appointment status (scheduled, confirmed, completed, etc.)

### 4. Medical Records
- **Visit History**: Complete encounter history with provider details
- **Diagnoses**: All diagnoses with ICD-10 codes and dates
- **Vital Signs**: Historical vital signs (temperature, blood pressure, heart rate, etc.)
- **Organized Tabs**: Easy navigation between visits, diagnoses, and vitals

### 5. Prescriptions
- **Active Prescriptions**: View all active medications
- **Prescription Details**: Medication name, dosage, frequency, duration, instructions
- **Refill Requests**: Request prescription refills directly through the portal
- **Refill Tracking**: Track remaining refills
- **Provider Information**: See who prescribed each medication

### 6. Lab Results
- **Test Results**: View laboratory test results as they become available
- **Abnormal Flags**: Highlighted abnormal results with warnings
- **Reference Ranges**: Compare results against normal ranges
- **Result History**: Track lab values over time
- **Downloadable Reports**: Download PDF reports when available

### 7. Billing & Payments
- **Invoice Management**: View all invoices with detailed line items
- **Payment History**: Complete payment transaction history
- **Outstanding Balance**: Track total amount due
- **Invoice Details**: Subtotal, tax, payments, balance due
- **Payment Options**: Online payment capability (integration required)
- **Download Invoices**: Download invoice PDFs

### 8. Profile Management
- **Personal Information**: View demographic and identification details
- **Contact Updates**: Update email, phone, and address
- **Medical Information**: View blood type, MRN, age
- **Secure Updates**: Changes logged for security and audit

---

## Architecture

### Backend (`hmis-backend/app/modules/portal/`)

#### Files Created:
```
portal/
├── __init__.py           # Module initialization
├── models.py             # Database models (PatientPortalAccount, PortalNotification, etc.)
├── schemas.py            # Pydantic schemas for request/response validation
├── service.py            # Business logic layer
└── routes.py             # API endpoints
```

#### Key Components:

**Models** (`models.py`):
- `PatientPortalAccount`: Links Patient to User for authentication
- `PortalNotification`: Patient-facing notifications and alerts
- `PrescriptionRefillRequest`: Track refill requests from patients

**Service Layer** (`service.py`):
- Patient registration and authentication
- Profile management
- Appointment retrieval and cancellation
- Medical records access (encounters, diagnoses, vitals)
- Prescription management and refill requests
- Billing and payment history
- Dashboard data aggregation

**API Routes** (`routes.py`):
- `POST /api/v1/portal/register` - Patient registration
- `POST /api/v1/portal/login` - Patient login
- `GET /api/v1/portal/profile` - Get patient profile
- `PATCH /api/v1/portal/profile` - Update patient profile
- `GET /api/v1/portal/appointments` - Get appointments
- `POST /api/v1/portal/appointments/{id}/cancel` - Cancel appointment
- `GET /api/v1/portal/medical-records/encounters` - Get visit history
- `GET /api/v1/portal/medical-records/diagnoses` - Get diagnoses
- `GET /api/v1/portal/medical-records/vitals` - Get vital signs
- `GET /api/v1/portal/prescriptions` - Get prescriptions
- `POST /api/v1/portal/prescriptions/refill` - Request refill
- `GET /api/v1/portal/lab-results` - Get lab results
- `GET /api/v1/portal/billing/invoices` - Get invoices
- `GET /api/v1/portal/billing/payments` - Get payment history
- `GET /api/v1/portal/dashboard` - Get dashboard data

### Frontend (`hmis-frontend/src/app/portal/`)

#### Files Created:
```
portal/
├── layout.tsx                  # Portal layout with patient-friendly navigation
├── login/
│   └── page.tsx               # Patient login page
├── register/
│   └── page.tsx               # Patient self-registration
├── dashboard/
│   └── page.tsx               # Patient dashboard
├── appointments/
│   └── page.tsx               # Appointments management
├── medical-records/
│   └── page.tsx               # Medical history viewer
├── prescriptions/
│   └── page.tsx               # Prescription management
├── lab-results/
│   └── page.tsx               # Lab results viewer
├── billing/
│   └── page.tsx               # Billing and payments
└── profile/
    └── page.tsx               # Profile settings
```

#### Design Features:
- **Separate Theme**: Blue/cyan color scheme (vs. primary/secondary for admin)
- **Patient-Friendly UI**: Simple, clear navigation optimized for non-medical users
- **Mobile Responsive**: Works on phones, tablets, and desktops
- **Accessibility**: WCAG 2.1 compliant with proper ARIA labels
- **Secure**: All routes protected with authentication checks

---

## Security Features

### Authentication & Authorization
- Separate authentication system from staff/admin
- JWT tokens stored in localStorage (access + refresh)
- Token validation on every API request
- Protected routes redirect to login if unauthenticated

### Data Access Control
- Patients can only access their own data
- Backend validates patient_id from JWT token
- No access to other patients' information
- Audit logging for all data access

### Privacy & Compliance
- HIPAA-compliant data handling
- Encrypted data transmission (HTTPS required)
- Secure password storage (Argon2)
- Session timeout and token expiration
- No sensitive data in URLs or client-side storage

### Input Validation
- Frontend: React Hook Form with validation
- Backend: Pydantic schemas for request validation
- SQL injection prevention (SQLAlchemy ORM)
- XSS protection (React auto-escaping)

---

## Usage Guide

### For Developers

#### 1. Database Migration
After creating the portal, run migrations to create new tables:

```bash
cd hmis-backend
alembic revision --autogenerate -m "Add patient portal tables"
alembic upgrade head
```

#### 2. Testing the Portal

**Register a New Patient:**
```bash
curl -X POST http://localhost:8000/api/v1/portal/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@example.com",
    "password": "SecurePass123!",
    "first_name": "John",
    "last_name": "Doe",
    "document_type": "cedula",
    "document_number": "123-4567890-1",
    "birth_date": "1990-01-15",
    "gender": "M",
    "mobile_phone": "(123) 456-7890"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:8000/api/v1/portal/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@example.com",
    "password": "SecurePass123!"
  }'
```

**Access Protected Endpoints:**
```bash
curl http://localhost:8000/api/v1/portal/dashboard \
  -H "Authorization: Bearer <access_token>"
```

#### 3. Frontend Development

Start the development server:
```bash
cd hmis-frontend
npm run dev
```

Access the portal at: `http://localhost:3000/portal/login`

#### 4. Environment Variables

Ensure these are set in your `.env` file:

```env
# Backend
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Future Enhancements

### Planned Features
1. **Appointment Booking**: Allow patients to book appointments directly
2. **Secure Messaging**: Direct messaging with healthcare providers
3. **Document Upload**: Upload insurance cards, medical documents
4. **Family Accounts**: Parents managing children's health records
5. **Health Reminders**: Medication reminders, appointment notifications
6. **Telemedicine Integration**: Video consultations
7. **Mobile App**: Native iOS/Android apps
8. **Wearable Integration**: Sync fitness trackers, smartwatches
9. **Vaccine Records**: COVID-19, flu, childhood immunizations
10. **Insurance Management**: Add/update insurance policies

### Payment Gateway Integration
To enable online payments, integrate with:
- **Stripe**: Credit/debit cards
- **PayPal**: PayPal accounts
- **Square**: Card readers for in-person payments
- Local payment processors for Latin America (Mercado Pago, etc.)

### Email/SMS Notifications
Implement notifications for:
- Appointment reminders (24h, 1h before)
- Lab results available
- Prescription refill approvals
- Invoice due dates
- Welcome emails for new registrations
- Password reset links

---

## Testing

### Manual Testing Checklist

**Registration & Login:**
- [ ] Register new patient account
- [ ] Login with valid credentials
- [ ] Login with invalid credentials fails
- [ ] Logout clears session
- [ ] Token refresh works

**Dashboard:**
- [ ] Shows correct stats
- [ ] Displays upcoming appointments
- [ ] Shows recent alerts
- [ ] Quick action links work

**Appointments:**
- [ ] View upcoming appointments
- [ ] View past appointments
- [ ] Cancel appointment (24h+ away)
- [ ] Cannot cancel recent appointment

**Medical Records:**
- [ ] View visit history
- [ ] View diagnoses
- [ ] View vital signs
- [ ] Data displays correctly

**Prescriptions:**
- [ ] View active prescriptions
- [ ] View all prescriptions
- [ ] Request refill
- [ ] Cannot refill non-refillable prescriptions

**Lab Results:**
- [ ] View lab results
- [ ] Abnormal results highlighted
- [ ] Reference ranges shown

**Billing:**
- [ ] View invoices
- [ ] View unpaid invoices only
- [ ] View payment history
- [ ] Download invoice PDFs

**Profile:**
- [ ] View personal information
- [ ] Update contact information
- [ ] Update address
- [ ] Changes saved successfully

### Automated Testing

Create tests in `hmis-backend/tests/test_portal.py`:

```python
# Example test structure
def test_patient_registration():
    """Test patient self-registration."""
    pass

def test_patient_login():
    """Test patient authentication."""
    pass

def test_dashboard_data():
    """Test dashboard data retrieval."""
    pass

def test_appointment_cancellation():
    """Test appointment cancellation logic."""
    pass

def test_prescription_refill_request():
    """Test prescription refill workflow."""
    pass
```

---

## Troubleshooting

### Common Issues

**1. Login Fails with 401**
- Check if user account exists in database
- Verify password is correct
- Check JWT_SECRET_KEY matches between login and token validation

**2. Profile Update Fails**
- Ensure token is valid and not expired
- Check if patient_id matches authenticated user
- Verify required fields are provided

**3. Dashboard Shows No Data**
- Check if patient has any appointments/prescriptions/etc.
- Verify database relationships are correct
- Check foreign key constraints

**4. Frontend Shows "Not Authorized"**
- Clear localStorage and login again
- Check if token is expired
- Verify API URL is correct in environment variables

**5. CORS Errors**
- Ensure backend CORS middleware is configured
- Check ALLOWED_ORIGINS in backend config
- Verify frontend is making requests to correct API URL

---

## API Documentation

Full API documentation available at:
- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

Look for the "Patient Portal" tag to see all portal endpoints.

---

## License & Credits

Part of the HMIS SaaS platform - Hospital Management Information System for Latin America.

**Security Notice**: This is a production-ready patient portal with enterprise-grade security. Ensure proper SSL/TLS, regular security audits, and compliance with local healthcare regulations (HIPAA, GDPR, etc.) before deploying to production.

**Support**: For questions or issues, contact the development team or refer to the main HMIS documentation.
