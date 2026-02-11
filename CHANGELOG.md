# Changelog

All notable changes to the HMIS SaaS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-02-07

### Initial Release

This is the first production-ready release of HMIS SaaS - a comprehensive cloud-native Hospital Management Information System designed for Latin America.

### Added

#### Core Infrastructure
- **Multi-tenant architecture** with schema-per-tenant isolation
- **FastAPI backend** (Python 3.11) with async/await support
- **Next.js 14 frontend** with App Router and Server-Side Rendering
- **PostgreSQL 16** database with JSONB support
- **Redis 7** for caching and session management
- **Meilisearch** for fast full-text search
- **MinIO/S3** for object storage
- **Docker Compose** for local development
- **Kubernetes** deployment manifests

#### Authentication & Authorization
- JWT-based authentication with access and refresh tokens
- Role-based access control (RBAC)
- Granular permission system
- Password reset via email
- Account lockout after failed attempts
- Secure password hashing with Argon2

#### Patient Management
- Patient registration with unique Medical Record Number (MRN)
- Demographics management (name, DOB, gender, contact info)
- Document management (passport, ID card, driver's license)
- Multi-insurance policy support (primary, secondary)
- Patient search by name, MRN, or document number
- Advanced filtering (gender, document type, status)
- Soft delete (inactive status)

#### Appointment Scheduling
- Provider/doctor management with specialties
- Schedule template creation (weekly recurring slots)
- Availability calendar with conflict detection
- Appointment types (consultation, follow-up, procedure)
- Multi-status workflow (scheduled, confirmed, arrived, in_progress, completed, cancelled, no_show)
- Appointment rescheduling
- Waiting list management with priority levels
- Check-in functionality

#### Electronic Medical Records (EMR)
- **Encounter Management:**
  - Create encounters (outpatient, emergency, inpatient)
  - Link encounters to appointments
  - Chief complaint documentation
  - Encounter status workflow
  - Disposition tracking (alta, hospitalizacion, referencia)

- **Clinical Notes:**
  - SOAP notes (Subjective, Objective, Assessment, Plan)
  - Procedure notes
  - Discharge summaries
  - Addendum notes
  - Digital signature for immutability
  - Audit trail for all notes

- **Vital Signs:**
  - Blood pressure (systolic/diastolic)
  - Heart rate, respiratory rate
  - Temperature (Celsius/Fahrenheit)
  - Oxygen saturation (SpO2)
  - Height and weight with automatic BMI calculation
  - Historical tracking for trend analysis

- **Diagnoses:**
  - ICD-10 coded diagnoses
  - Primary, secondary, and differential designations
  - Active, resolved, and chronic statuses
  - Patient problem list

- **Allergies:**
  - Medication, food, and environmental allergies
  - Reaction descriptions
  - Severity levels (mild, moderate, severe)
  - Allergy alerts in prescribing workflow

- **Medical Orders:**
  - Laboratory orders
  - Radiology/imaging orders
  - Procedure orders
  - Consultation requests
  - STAT priority flagging
  - Order status tracking

- **Clinical Templates:**
  - Pre-built SOAP note templates
  - Specialty-specific templates
  - Custom template creation

#### Billing & Financial Management
- **Service Catalog:**
  - Comprehensive medical service catalog
  - CPT code support
  - Pricing management
  - Service categories

- **Invoicing:**
  - Create invoices from encounters or manual entry
  - Line item management (quantity, price, discounts)
  - Tax calculation (ITBIS for Dominican Republic)
  - Fiscal compliance (NCF generation for DR)
  - Multiple fiscal document types (B01, B02, B14, B15)
  - Invoice numbering (sequential)
  - PDF invoice generation
  - Self-pay and insurance billing

- **Payments:**
  - Cash, card, bank transfer, check
  - Partial and full payment support
  - Payment reference tracking
  - Payment reversal
  - Automatic invoice status updates

- **Insurance Claims:**
  - Create claims from invoices
  - Link to patient insurance policies
  - Submit to insurance companies
  - Claim adjudication workflow (approved, partially approved, denied)
  - Denial reason tracking
  - Automatic patient balance calculation

- **Credit Notes:**
  - Full or partial invoice credits
  - Linked to original invoice
  - Fiscal number generation
  - Automatic balance adjustment

- **Accounting:**
  - Chart of accounts (hospital-specific)
  - General ledger journal entries
  - Automatic posting (invoice, payment, credit note)
  - Double-entry bookkeeping
  - Trial balance report
  - Accounts receivable aging report

- **Fiscal Compliance:**
  - RNC/Cedula validation (Dominican Republic)
  - DGII reports (607, 608, 609)
  - NCF sequence management
  - Tax rate configuration by country

#### Pharmacy & Inventory
- **Product Catalog:**
  - Medications, supplies, and devices
  - Generic and brand names
  - Strength and dosage forms
  - Controlled substance designation
  - Active ingredient tracking

- **Prescription Management:**
  - Electronic prescription creation
  - Dosage, frequency, route, duration
  - Quantity and refills
  - Patient instructions
  - Drug allergy checking
  - Drug interaction warnings
  - Prescription cancellation
  - Refill requests (patient portal)

- **Dispensation:**
  - Lot-based dispensing (FEFO - First Expired, First Out)
  - Expiration date verification
  - Quantity verification
  - Controlled substance logging
  - Dispensation receipt printing

- **Inventory Management:**
  - Multi-warehouse support
  - Stock levels by product and warehouse
  - Reorder point alerts
  - Low stock warnings
  - Stock movements (receipt, transfer, adjustment, wastage)
  - Expiring medication alerts (90-day lookahead)
  - Lot tracking with expiration dates

- **Purchase Orders:**
  - Create purchase orders to suppliers
  - Order status workflow (draft, submitted, ordered, received, cancelled)
  - Multi-line items
  - Automatic stock update upon receipt

- **Controlled Substances:**
  - DEA Schedule tracking
  - Audit log for every transaction
  - Balance reconciliation
  - Regulatory reporting

#### Payment Gateway Integration (Stripe)
- **Payment Intents:**
  - Create payment intents for invoices
  - Client-side payment processing with Stripe Elements
  - 3D Secure (SCA) support
  - Payment method saving

- **Customer Management:**
  - Automatic Stripe customer creation
  - Link customers to patients
  - Saved payment methods
  - Default payment method management

- **Refunds:**
  - Full and partial refunds
  - Refund reason tracking
  - Automatic invoice updates

- **Webhooks:**
  - Payment success handling
  - Payment failure handling
  - Refund notifications
  - Signature verification for security

- **Security:**
  - PCI-compliant (Stripe handles card data)
  - No card storage in HMIS
  - Tokenized payments only

#### Patient Portal
- **Self-Service Registration:**
  - Patients create their own accounts
  - Email verification
  - Link to existing patient record

- **Authentication:**
  - Separate login for patients
  - Password reset
  - Secure session management

- **Appointments:**
  - View upcoming and past appointments
  - Book new appointments (available slots)
  - Cancel appointments
  - Receive appointment reminders

- **Medical Records:**
  - View active allergies
  - View active diagnoses
  - View active medications
  - View immunization history
  - View recent visit summaries

- **Prescriptions:**
  - View active prescriptions
  - View prescription history
  - Request refills
  - See refills remaining

- **Billing:**
  - View outstanding invoices
  - View payment history
  - Make online payments via Stripe
  - Download invoice PDFs
  - Download payment receipts

- **Profile Management:**
  - Update contact information
  - Update emergency contact
  - Change password

#### Custom Reporting System
- **Report Builder:**
  - Define custom reports with SQL-like queries
  - Select data sources (patients, encounters, invoices, etc.)
  - Choose columns to include
  - Apply filters and sorting
  - Group and aggregate data

- **Predefined Reports:**
  - Patient demographics report
  - Appointment statistics
  - Revenue by service category
  - Revenue by provider
  - Insurance claim summary
  - Diagnosis frequency
  - Medication dispensing log
  - Inventory valuation
  - Accounts receivable aging

- **Report Execution:**
  - Run reports on-demand
  - Parameter input (date ranges, filters)
  - Preview results
  - Drill-down capabilities

- **Report Scheduling:**
  - Schedule recurring reports (daily, weekly, monthly)
  - Email delivery to recipients
  - Multiple output formats

- **Export Formats:**
  - PDF (print-ready)
  - Excel (.xlsx)
  - CSV (data import/export)
  - JSON (API integration)

#### Email Notifications
- **SendGrid Integration:**
  - Transactional email sending
  - Email templates
  - Delivery tracking

- **Notification Types:**
  - Appointment reminders (24 hours before)
  - Appointment confirmations
  - Password reset emails
  - Account verification emails
  - Payment receipts
  - Invoice delivery
  - Prescription ready notifications

- **Email Customization:**
  - Hospital branding
  - Configurable templates
  - Multi-language support (Spanish, English)

#### PDF Generation
- **Invoice PDFs:**
  - Professional invoice layout
  - Hospital logo and details
  - Line item breakdown
  - Tax calculations
  - Payment history
  - QR code for online payment

- **Patient Reports:**
  - Visit summaries
  - Medication lists
  - Test results
  - Discharge instructions

- **Prescription Labels:**
  - Patient information
  - Medication details
  - Dosage instructions
  - Warnings

#### Audit & Compliance
- **Comprehensive Audit Logging:**
  - All patient access logged
  - All modifications logged (before/after values)
  - Failed login attempts
  - Permission changes
  - Administrative actions

- **Audit Log Features:**
  - Searchable and filterable
  - Export to CSV/Excel
  - 6-year retention (HIPAA compliant)
  - Monthly partitioning for performance

- **Regulatory Compliance:**
  - HIPAA technical safeguards
  - PCI-DSS via Stripe
  - Dominican Republic fiscal compliance (DGII)
  - Data encryption at rest and in transit

#### Monitoring & Observability
- **Prometheus Metrics:**
  - Request count and latency
  - Error rates
  - Database query performance
  - Cache hit rates
  - Active connections

- **Sentry Error Tracking:**
  - Automatic error capture
  - Stack traces
  - User context
  - Release tracking
  - Performance monitoring

- **Structured Logging:**
  - JSON log format
  - Request ID tracking
  - Tenant ID in all logs
  - Severity levels (ERROR, WARNING, INFO, DEBUG)

- **Health Checks:**
  - Liveness probe (/health/live)
  - Readiness probe (/health/ready)
  - Database connectivity check
  - Redis connectivity check

#### Security Features
- **Application Security:**
  - Input validation with Pydantic
  - SQL injection prevention (parameterized queries)
  - XSS prevention (output escaping)
  - CSRF protection
  - Rate limiting (100 req/min per IP, 1000 req/hour per user)
  - CORS configuration

- **Data Security:**
  - Encryption at rest (PostgreSQL pgcrypto)
  - Encryption in transit (TLS 1.2+)
  - Password hashing with Argon2
  - Secure session management

- **Network Security:**
  - HTTPS enforcement
  - HSTS header
  - Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
  - Trusted host middleware

- **Multi-Tenancy Security:**
  - Schema-per-tenant isolation
  - Row-level security policies
  - Automatic tenant scoping
  - No cross-tenant queries possible

#### Developer Experience
- **API Documentation:**
  - Interactive Swagger UI (/api/docs)
  - ReDoc documentation (/api/redoc)
  - OpenAPI 3.0 specification
  - Request/response examples

- **Testing:**
  - Backend: pytest with 162 tests
  - Frontend: Jest with React Testing Library
  - Test coverage reporting
  - CI/CD integration

- **Code Quality:**
  - Black code formatting (Python)
  - isort import sorting (Python)
  - flake8 linting (Python)
  - ESLint + Prettier (TypeScript/React)
  - Type checking (mypy, TypeScript)

- **Development Tools:**
  - Docker Compose for local dev
  - Hot reload (uvicorn --reload, next dev)
  - Database migrations with Alembic
  - Seed data scripts

#### User Interface
- **Modern Design:**
  - Responsive layout (mobile, tablet, desktop)
  - Tailwind CSS styling
  - Dark mode support (planned for future)
  - Accessibility (WCAG 2.1 AA compliance planned)

- **Components:**
  - Reusable UI component library
  - Form components with validation
  - Data tables with sorting and filtering
  - Modal dialogs
  - Toast notifications
  - Loading states and skeletons

- **Error Handling:**
  - Error boundary components
  - User-friendly error messages
  - Automatic retry for transient errors
  - Offline detection

- **Performance:**
  - Code splitting
  - Lazy loading
  - Image optimization
  - Caching strategies

#### Internationalization
- **Multi-language Support:**
  - Spanish (primary language)
  - English (secondary language)
  - Date/time formatting per locale
  - Currency formatting

- **Localization:**
  - Latin America-specific features
  - Dominican Republic fiscal compliance
  - Local date/time formats

### Technical Stack

**Backend:**
- FastAPI 0.109+
- Python 3.11+
- PostgreSQL 16
- Redis 7
- SQLAlchemy 2.0 (async)
- Alembic 1.13 (migrations)
- Pydantic 2.6 (validation)
- pytest (testing)

**Frontend:**
- Next.js 14.1
- React 18.2
- TypeScript 5.3
- Tailwind CSS 3.4
- Zustand 4.4 (state management)
- TanStack Query 5.17 (data fetching)
- React Hook Form 7.49 (forms)
- Jest 29.7 (testing)

**Infrastructure:**
- Docker & Docker Compose
- Kubernetes (optional)
- Nginx (reverse proxy)
- Prometheus (metrics)
- Grafana (dashboards)
- Sentry (error tracking)

**External Services:**
- Stripe (payments)
- SendGrid (email)
- Meilisearch (search)
- MinIO/S3 (storage)

### Documentation
- User Manual (USER_MANUAL.md)
- Deployment Guide (DEPLOYMENT_GUIDE.md)
- API Documentation (API_DOCUMENTATION.md)
- Developer Guide (DEVELOPER_GUIDE.md)
- Security Policy (SECURITY.md)
- This Changelog (CHANGELOG.md)

### Known Issues
- None reported at initial release

### Contributors
- Development Team
- Claude Sonnet 4.5 (AI Assistant)

---

## [Unreleased]

### Planned Features (Future Releases)

**v1.1.0:**
- Two-factor authentication (2FA)
- Advanced reporting with charts/graphs
- Lab results integration
- Radiology/imaging module
- Bed management (inpatient)
- Operating room scheduling

**v1.2.0:**
- Mobile applications (iOS, Android)
- Offline mode support
- Voice dictation for clinical notes
- Telemedicine integration (video consultations)
- HL7/FHIR API support

**v1.3.0:**
- AI-powered clinical decision support
- Medication interaction database
- Clinical guidelines/protocols
- Care plans and treatment protocols

**v2.0.0:**
- Multi-facility support (hospital networks)
- Advanced analytics and business intelligence
- Patient engagement tools (surveys, education)
- Integration marketplace (third-party apps)

---

## Version History

| Version | Release Date | Description |
|---------|--------------|-------------|
| 1.0.0   | 2026-02-07   | Initial production release |

---

**Note:** This changelog will be updated with each release. For detailed commit history, see Git log.
