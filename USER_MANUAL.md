# HMIS SaaS - User Manual

**Version:** 1.0.0
**Last Updated:** February 7, 2026
**Document Type:** End User Guide

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard](#dashboard)
4. [Patient Management](#patient-management)
5. [Appointments](#appointments)
6. [Electronic Medical Records (EMR)](#electronic-medical-records-emr)
7. [Prescriptions & Pharmacy](#prescriptions--pharmacy)
8. [Billing & Insurance](#billing--insurance)
9. [Reports](#reports)
10. [Patient Portal](#patient-portal)
11. [Admin Functions](#admin-functions)
12. [Troubleshooting](#troubleshooting)
13. [Glossary](#glossary)

---

## Introduction

### System Overview

HMIS SaaS (Hospital Management Information System) is a comprehensive cloud-native platform designed specifically for healthcare facilities in Latin America. The system provides integrated management of:

- Patient records and demographics
- Appointment scheduling
- Electronic medical records (EMR)
- Prescription and pharmacy management
- Billing and insurance claims
- Payment processing
- Inventory control
- Custom reporting and analytics

### Benefits

- **Cloud-Based**: Access from anywhere with internet connectivity
- **Multi-Tenant**: Secure isolation between different healthcare facilities
- **Regulatory Compliance**: Built-in support for HIPAA guidelines and Latin American fiscal requirements (DGII for Dominican Republic)
- **Real-Time Updates**: Instant synchronization across all users
- **Mobile Responsive**: Works on desktops, tablets, and smartphones
- **Integrated Payments**: Stripe payment gateway for secure online payments

### Target Users

- **Hospital Administrators**: System configuration, user management, reporting
- **Medical Staff** (Doctors, Nurses): Patient care, clinical documentation, prescriptions
- **Billing Staff**: Invoice generation, insurance claims, payment processing
- **Pharmacists**: Medication dispensation, inventory management
- **Patients**: Self-service portal for appointments, medical records, payments

---

## Getting Started

### System Requirements

**Minimum Browser Requirements:**
- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

**Internet Connection:**
- Minimum 2 Mbps download speed
- Stable connection recommended for real-time updates

### First-Time Login

1. **Receive Credentials**: Your system administrator will provide:
   - Email address (username)
   - Temporary password
   - System URL (e.g., `https://hmis.yourhospital.com`)

2. **Access the System**:
   - Navigate to the provided URL
   - Click "Sign In" on the home page

3. **Enter Credentials**:
   - Email: Your assigned email address
   - Password: Temporary password provided

4. **Change Password** (First Login):
   - You will be prompted to change your temporary password
   - New password must be at least 8 characters
   - Include uppercase, lowercase, numbers, and special characters

5. **Verify Profile**:
   - Review your profile information
   - Update contact details if needed

### Password Reset

**If You Forgot Your Password:**

1. Click "Forgot Password?" on the login page
2. Enter your registered email address
3. Check your email for a password reset link
4. Click the link (valid for 1 hour)
5. Enter and confirm your new password
6. Return to login page and sign in

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@, #, $, etc.)

### Navigation Overview

The main navigation menu (left sidebar) provides access to:

- **Dashboard**: Overview and quick actions
- **Patients**: Patient registry and search
- **Appointments**: Calendar and scheduling
- **EMR**: Clinical documentation
- **Billing**: Invoices and payments
- **Pharmacy**: Prescriptions and inventory
- **Reports**: Analytics and exports
- **Admin**: System settings (admin only)

---

## Dashboard

### Understanding the Dashboard

The dashboard provides an at-a-glance view of key metrics and quick access to common tasks.

**Key Metrics Displayed:**
- Today's appointments count
- Active patients
- Pending invoices
- Low stock alerts (pharmacy)
- Recent activities

**Quick Actions:**
- Register New Patient
- Schedule Appointment
- Create Invoice
- View Reports

**Widgets:**
- Appointment calendar (current week)
- Recent patient registrations
- Revenue chart (current month)
- Top services billed

### Customization

Users can customize their dashboard:
- Drag and drop widgets to reorder
- Show/hide specific widgets
- Set date ranges for charts
- Pin frequently used reports

---

## Patient Management

### Registering a New Patient

1. Navigate to **Patients > New Patient**
2. Complete required fields:
   - **Personal Information**:
     - First Name *
     - Last Name *
     - Date of Birth *
     - Gender *
   - **Identification**:
     - Document Type (Passport, ID Card, Driver's License) *
     - Document Number *
   - **Contact Information**:
     - Phone Number *
     - Email (optional)
     - Address *
     - City, State, Postal Code

3. Click "Save Patient"
4. System generates unique Medical Record Number (MRN) automatically
5. Patient profile is created and accessible immediately

**Note:** Fields marked with * are required.

### Searching for Patients

**Quick Search:**
- Use the search bar at the top of the Patients page
- Search by: Name, MRN, or Document Number
- Results appear as you type

**Advanced Search:**
1. Click "Advanced Search"
2. Filter by:
   - Document Type
   - Gender
   - Status (Active/Inactive)
   - Date Range (registration date)
3. Click "Apply Filters"

### Viewing Patient Records

Click on any patient in the search results to view:

- **Demographics Tab**: Personal and contact information
- **Medical History**: Encounters, diagnoses, allergies
- **Appointments**: Past and upcoming appointments
- **Prescriptions**: Active and historical prescriptions
- **Billing**: Invoices and payment history
- **Documents**: Uploaded files and images

### Updating Patient Information

1. Open patient profile
2. Click "Edit" button
3. Modify desired fields
4. Click "Save Changes"

**Note:** Medical Record Number (MRN) cannot be changed once assigned.

### Patient Insurance

**Adding Insurance Coverage:**

1. Open patient profile
2. Navigate to "Insurance" tab
3. Click "Add Insurance"
4. Enter:
   - Insurance Provider *
   - Policy Number *
   - Group Number
   - Effective Date *
   - Expiration Date
   - Primary/Secondary designation
5. Click "Save Insurance"

**Managing Multiple Insurance Plans:**
- Mark one policy as "Primary"
- Others are automatically marked as "Secondary"
- Claims are submitted to primary insurance first

---

## Appointments

### Scheduling an Appointment

1. Navigate to **Appointments > Schedule New**
2. Select or search for patient
3. Choose:
   - **Provider** (doctor/specialist) *
   - **Appointment Type** (consultation, follow-up, procedure) *
   - **Date** *
   - **Time Slot** * (only available slots shown)
4. Add notes (optional)
5. Click "Schedule Appointment"
6. Confirmation displayed with appointment details

### Viewing the Appointment Calendar

**Calendar Views:**
- **Day View**: Hourly schedule for one day
- **Week View**: 7-day overview
- **Month View**: Calendar month view

**Navigation:**
- Use arrow buttons to move between time periods
- Click "Today" to return to current date
- Click any appointment to view details

**Color Coding:**
- Green: Confirmed
- Blue: Scheduled (pending confirmation)
- Yellow: Checked In (patient arrived)
- Red: Cancelled
- Purple: Completed

### Checking In a Patient

1. Locate appointment in calendar
2. Click appointment
3. Click "Check In" button
4. Status changes to "Arrived"
5. Provider is notified patient is ready

### Rescheduling an Appointment

1. Open appointment details
2. Click "Reschedule"
3. Select new date and time
4. Click "Confirm Reschedule"
5. Patient receives notification (if email provided)

### Cancelling an Appointment

1. Open appointment details
2. Click "Cancel Appointment"
3. Provide cancellation reason
4. Click "Confirm Cancellation"
5. Time slot becomes available for other patients

### Waiting List

**Adding Patient to Waiting List:**

1. Navigate to **Appointments > Waiting List**
2. Click "Add to Waiting List"
3. Select:
   - Patient
   - Provider or Specialty
   - Priority (Low, Normal, High, Urgent)
   - Preferred dates
4. System notifies when slots become available

---

## Electronic Medical Records (EMR)

### Creating an Encounter

An encounter represents a patient visit or interaction.

1. Navigate to **EMR > New Encounter**
2. Select patient
3. Choose:
   - **Encounter Type** (outpatient, emergency, inpatient)
   - **Provider** (attending physician)
   - **Date/Time**
   - **Chief Complaint**
4. Click "Create Encounter"

### Recording Vital Signs

1. Open encounter
2. Navigate to "Vital Signs" section
3. Enter measurements:
   - Blood Pressure (systolic/diastolic)
   - Heart Rate (bpm)
   - Respiratory Rate
   - Temperature (°C or °F)
   - Oxygen Saturation (SpO2 %)
   - Height (cm)
   - Weight (kg)
4. System automatically calculates BMI
5. Click "Save Vital Signs"

### SOAP Notes

**Creating a SOAP Note:**

1. Within encounter, click "Add Clinical Note"
2. Select "SOAP Note" type
3. Complete sections:
   - **Subjective**: Patient's reported symptoms
   - **Objective**: Physical examination findings
   - **Assessment**: Diagnosis and clinical impression
   - **Plan**: Treatment plan and follow-up

4. Click "Save Note"

**Signing a Note:**
- Only physicians can sign notes
- Click "Sign Note" button
- Once signed, note becomes immutable
- Amendments require creating an addendum note

### Recording Diagnoses

1. Within encounter, navigate to "Diagnoses"
2. Click "Add Diagnosis"
3. Search for ICD-10 code or description
4. Select diagnosis from results
5. Specify:
   - **Status**: Active, Resolved, Chronic
   - **Type**: Primary, Secondary, Differential
6. Click "Save Diagnosis"

### Managing Allergies

**Recording a New Allergy:**

1. Open patient chart
2. Navigate to "Allergies" tab
3. Click "Add Allergy"
4. Enter:
   - **Allergen** (medication, food, environmental)
   - **Reaction** (rash, anaphylaxis, etc.)
   - **Severity** (Mild, Moderate, Severe)
   - **Onset Date**
5. Click "Save Allergy"

**Allergy Alerts:**
- System displays allergies prominently at top of chart
- Alerts trigger when prescribing contraindicated medications

### Problem List

The problem list maintains ongoing health issues.

1. Navigate to patient's "Problem List"
2. Click "Add Problem"
3. Enter problem description or ICD-10 code
4. Set:
   - **Status**: Active, Resolved, Inactive
   - **Onset Date**
   - **Priority**: High, Medium, Low
5. Click "Save"

### Medical Orders

**Creating Orders (Lab, Imaging, Procedures):**

1. Within encounter, click "Orders"
2. Click "New Order"
3. Select order type:
   - Laboratory
   - Radiology/Imaging
   - Procedure
   - Consultation
4. Choose specific test/procedure from catalog
5. Add clinical indication
6. Mark as STAT if urgent
7. Click "Submit Order"

**Tracking Order Status:**
- Pending: Order placed, awaiting processing
- In Progress: Test being performed
- Completed: Results available
- Cancelled: Order cancelled

---

## Prescriptions & Pharmacy

### Creating a Prescription

**Electronic Prescription Workflow:**

1. Navigate to **Pharmacy > New Prescription**
2. Select patient
3. Search for medication by name
4. Select medication from product catalog
5. Enter prescription details:
   - **Quantity**
   - **Dosage** (e.g., "1 tablet")
   - **Frequency** (e.g., "twice daily")
   - **Route** (oral, IV, topical, etc.)
   - **Duration** (number of days)
   - **Refills Allowed**
   - **Instructions for Patient**
6. Click "Save Prescription"

**Safety Checks:**
- System automatically checks for drug allergies
- Warns of potential drug interactions
- Alerts if patient currently taking similar medication

### Viewing Prescriptions

**Patient Prescription History:**
1. Open patient chart
2. Navigate to "Prescriptions" tab
3. View list of all prescriptions (active and historical)
4. Filter by status: Active, Completed, Cancelled

### Dispensing Medications

**Pharmacist Workflow:**

1. Navigate to **Pharmacy > Dispense**
2. Scan or enter prescription ID
3. System displays:
   - Patient information and allergies
   - Medication details
   - Prescriber information
4. Select lot number (FEFO - First Expired, First Out)
5. Verify expiration date
6. Enter quantity dispensed
7. Click "Dispense"
8. Print medication label with instructions
9. Prescription status updated to "Dispensed"

**Controlled Substances:**
- Requires additional verification
- Automatically logged in audit trail
- Balance tracked separately

### Inventory Management

**Checking Stock Levels:**

1. Navigate to **Pharmacy > Inventory**
2. View products with current quantities
3. Color indicators:
   - Green: Adequate stock
   - Yellow: Low stock (below reorder point)
   - Red: Out of stock

**Stock Movements:**
- Receive new shipment
- Transfer between warehouses
- Adjustment (count discrepancies)
- Return to supplier
- Wastage/expiry

**Expiring Medications:**
1. Navigate to **Pharmacy > Expiring Lots**
2. View list of products expiring within next 90 days
3. Sort by expiration date
4. Take action: Discount, donate, or dispose

---

## Billing & Insurance

### Generating an Invoice

1. Navigate to **Billing > New Invoice**
2. Select patient
3. Choose billing type:
   - Self-Pay (patient pays directly)
   - Insurance (claim to be submitted)
4. Add service lines:
   - Click "Add Service"
   - Select from service catalog
   - Adjust quantity and price if needed
   - Apply discounts if applicable
5. Review totals:
   - Subtotal
   - Discounts
   - Tax (ITBIS for Dominican Republic)
   - Grand Total
6. Click "Generate Invoice"
7. Invoice number assigned automatically (sequential)

**Fiscal Compliance:**
- System generates NCF (Fiscal Number) for Dominican Republic
- Supports multiple fiscal document types (B01, B02, B14, B15)
- Tax calculations comply with local regulations

### Viewing Invoices

**Invoice List:**
1. Navigate to **Billing > Invoices**
2. Filter by:
   - Patient
   - Status (Draft, Sent, Paid, Overdue, Cancelled)
   - Date range
3. Click invoice to view details

**Invoice Details Include:**
- Invoice number and fiscal number
- Patient information
- Line items with descriptions and amounts
- Payment history
- Outstanding balance
- PDF download option

### Recording Payments

**Manual Payment Entry:**

1. Open invoice
2. Click "Record Payment"
3. Enter:
   - **Payment Amount**
   - **Payment Method** (Cash, Card, Bank Transfer, Check)
   - **Reference Number** (for checks/transfers)
   - **Payment Date**
   - **Notes**
4. Click "Save Payment"
5. Invoice status updates automatically:
   - Partial: If payment less than total
   - Paid: If full amount received

**Stripe Online Payments:**
- Patients can pay via Patient Portal
- Credit/debit card processing
- PCI-compliant (Stripe handles card data)
- Automatic invoice update upon successful payment

### Insurance Claims

**Creating a Claim:**

1. Navigate to **Billing > Claims > New Claim**
2. Select patient and verify insurance on file
3. Link to invoice or select services
4. Enter clinical information:
   - Diagnosis codes (ICD-10)
   - Procedure codes (CPT)
   - Treatment dates
5. Click "Save Claim"

**Submitting to Insurance:**
1. Review claim details
2. Click "Submit Claim"
3. Status changes to "Submitted"
4. System generates claim file (ANSI X12 837 format)

**Claim Adjudication:**
1. Navigate to claim details
2. Click "Update Status"
3. Select outcome:
   - Approved: Enter approved amount
   - Partially Approved: Enter approved and denied amounts
   - Denied: Enter denial reason
4. System posts insurance payment to invoice
5. Patient balance updated with remaining amount

### Credit Notes

**Issuing a Credit Note:**

1. Navigate to invoice to be credited
2. Click "Issue Credit Note"
3. Specify:
   - Reason for credit
   - Full or partial credit
   - Line items to credit (if partial)
4. Click "Generate Credit Note"
5. Credit note receives unique number
6. Original invoice balance reduced

### Financial Reports

**Accounts Receivable Aging:**
- Shows outstanding invoices grouped by age
- Categories: Current, 30 days, 60 days, 90+ days
- Navigate to **Billing > Reports > AR Aging**

**DGII Reports (Dominican Republic):**
- Form 607: Sales report
- Form 608: Purchases report
- Form 609: Cancellations report
- Generated monthly for tax filing

---

## Reports

### Predefined Reports

The system includes built-in reports for common needs:

**Clinical Reports:**
- Patient Demographics
- Diagnosis Frequency
- Procedure Volume
- Provider Productivity
- Medication Dispensing Log
- Controlled Substances Audit

**Financial Reports:**
- Revenue by Service
- Revenue by Provider
- Payment Collections
- Outstanding Balances
- Insurance Claims Summary
- Tax Summary

**Operational Reports:**
- Appointment Statistics
- No-Show Rate
- Average Wait Time
- Bed Occupancy (for inpatient)
- Inventory Valuation
- Stock Movement Summary

### Running a Report

1. Navigate to **Reports**
2. Select report from list
3. Set parameters:
   - Date range
   - Provider/Department filter
   - Patient status
   - Other relevant filters
4. Choose output format:
   - View on Screen
   - Export to PDF
   - Export to Excel
   - Export to CSV
5. Click "Run Report"
6. View or download results

### Creating Custom Reports

**Report Builder:**

1. Navigate to **Reports > Custom Reports**
2. Click "New Report"
3. Configure:
   - **Report Name**
   - **Report Type** (Clinical, Financial, Operational)
   - **Data Source** (Patients, Appointments, Invoices, etc.)
   - **Columns to Include**
   - **Filters** (date range, status, etc.)
   - **Grouping** (by provider, date, etc.)
   - **Sorting**
4. Preview report
5. Click "Save Report Definition"

**Running Custom Reports:**
- Saved reports appear in "My Reports" section
- Can be scheduled for automatic generation

### Scheduling Reports

**Automated Report Delivery:**

1. Open saved report
2. Click "Schedule"
3. Configure:
   - **Frequency** (Daily, Weekly, Monthly)
   - **Day/Time** to run
   - **Email Recipients**
   - **Format** (PDF, Excel)
4. Click "Save Schedule"
5. Reports generated and emailed automatically

---

## Patient Portal

**For Patients:** The patient portal provides self-service access to health information.

### Patient Registration

1. Visit patient portal URL (provided by hospital)
2. Click "Register"
3. Enter:
   - Email address
   - Create password
   - Personal information (name, DOB, ID)
   - Contact information
4. Verify email address (click link in email)
5. Login with credentials

### Viewing Appointments

**Upcoming Appointments:**
- Dashboard shows next scheduled appointment
- List view shows all future appointments
- Details include: date, time, provider, location

**Past Appointments:**
- View history of completed appointments
- Access visit summaries if provided by doctor

### Booking Appointments

1. Click "Book Appointment"
2. Select:
   - Provider or specialty
   - Preferred date
3. View available time slots
4. Choose time
5. Add reason for visit (optional)
6. Confirm booking
7. Receive confirmation email

### Cancelling Appointments

1. Navigate to appointment details
2. Click "Cancel Appointment"
3. Confirm cancellation
4. Appointment removed from calendar

### Viewing Medical Records

**Access to:**
- Allergies and health conditions
- Medications (current prescriptions)
- Immunization history
- Recent lab results (if released by provider)
- Visit summaries

**Note:** Some information may be restricted until reviewed by physician.

### Viewing Prescriptions

**Active Prescriptions:**
- Medication name and strength
- Dosage instructions
- Refills remaining
- Prescribing doctor
- Expiration date

**Requesting Refills:**
1. Select prescription
2. Click "Request Refill"
3. Add notes if needed
4. Submit request
5. Pharmacy staff reviews and approves

### Viewing and Paying Invoices

**Outstanding Balances:**
- Dashboard shows total balance due
- List of unpaid invoices

**Making a Payment:**
1. Select invoice
2. Click "Pay Now"
3. Enter payment amount (full or partial)
4. Choose payment method:
   - Credit/Debit Card (Stripe)
   - Bank Account (if enabled)
5. Review payment details
6. Click "Submit Payment"
7. Receive payment confirmation

**Payment History:**
- View all past payments
- Download receipts

### Updating Profile

1. Click profile icon
2. Select "My Profile"
3. Update:
   - Contact information (phone, email)
   - Address
   - Emergency contact
4. Click "Save Changes"

**Note:** Patients cannot change medical information (allergies, conditions). Contact hospital to update.

---

## Admin Functions

**For System Administrators Only**

### User Management

**Creating Users:**

1. Navigate to **Admin > Users**
2. Click "New User"
3. Enter:
   - Email (username)
   - First and Last Name
   - Temporary Password
   - Role (Doctor, Nurse, Pharmacist, Billing Staff, Admin)
4. Assign permissions
5. Click "Create User"
6. User receives welcome email with login instructions

**Managing Roles:**
- **Admin**: Full system access
- **Doctor**: Clinical modules, EMR, prescriptions
- **Nurse**: Patient care, vital signs, basic EMR
- **Pharmacist**: Pharmacy, inventory, dispensing
- **Billing Staff**: Invoicing, payments, claims
- **Receptionist**: Appointments, patient registration

### Permission Management

Granular permissions can be assigned:
- `patients:read` - View patient information
- `patients:write` - Edit patient information
- `appointments:read` - View appointments
- `appointments:write` - Schedule/modify appointments
- `emr:read` - View medical records
- `emr:write` - Document in medical records
- `billing:read` - View invoices
- `billing:write` - Create/edit invoices
- `pharmacy:read` - View pharmacy data
- `pharmacy:write` - Dispense medications
- `reports:read` - View reports
- `reports:create` - Create custom reports

### Tenant Settings

**Hospital Configuration:**
1. Navigate to **Admin > Settings**
2. Update:
   - Hospital Name
   - Address and Contact Information
   - Tax ID (RNC for Dominican Republic)
   - Logo (upload image)
   - Fiscal Configuration
3. Click "Save Settings"

**Fiscal Configuration:**
- Country (DO, PR, etc.)
- Tax rates (ITBIS, sales tax)
- Fiscal sequence ranges
- Certificate upload (for electronic invoicing)

### Seeding Initial Data

**Create Default Roles:**
- Navigate to **Admin > Roles**
- Click "Seed Default Roles"
- System creates standard roles with permissions

**Initialize Chart of Accounts:**
- Navigate to **Billing > Accounts**
- Click "Seed Chart of Accounts"
- Creates standard GL accounts for healthcare

**Load Service Catalog:**
- Navigate to **Billing > Services**
- Import CSV with services and prices
- Or manually add services one by one

---

## Troubleshooting

### Common Issues and Solutions

#### Cannot Login

**Problem:** Login fails with "Invalid credentials"

**Solutions:**
- Verify you're using the correct email address (check for typos)
- Ensure password is entered correctly (check Caps Lock)
- Use "Forgot Password" to reset
- Contact system administrator if account may be deactivated

---

#### Page Loads Slowly

**Problem:** System responds slowly or pages don't load

**Solutions:**
- Check internet connection speed
- Clear browser cache and cookies
- Try different browser
- Disable browser extensions temporarily
- Contact IT if issue persists (may be server-side)

---

#### Cannot Find Patient

**Problem:** Search returns no results for known patient

**Solutions:**
- Check spelling of name
- Try searching by MRN or document number instead
- Use Advanced Search with filters
- Patient may be marked inactive (adjust status filter)
- Contact administrator if patient truly missing

---

#### Prescription Won't Save

**Problem:** Error when creating prescription

**Solutions:**
- Verify all required fields are completed
- Check for drug allergy conflicts (may block save)
- Ensure medication exists in product catalog
- Verify patient has active status
- Check browser console for specific error message

---

#### Invoice Won't Generate

**Problem:** Error when creating invoice

**Solutions:**
- Ensure patient has complete billing information
- Verify at least one service line is added
- Check fiscal configuration is complete
- Verify invoice sequence not exhausted
- Contact administrator for fiscal number issues

---

#### Payment Not Applied

**Problem:** Recorded payment doesn't update invoice

**Solutions:**
- Verify payment amount was entered correctly
- Check payment wasn't accidentally posted to different invoice
- Refresh page to see updated balance
- Contact administrator if payment journal entry failed

---

#### Report Shows No Data

**Problem:** Report runs but returns empty results

**Solutions:**
- Verify date range includes relevant data
- Check filters aren't too restrictive
- Ensure you have permission to view the data
- Try different report parameters
- Contact administrator if data should exist

---

### Error Messages

#### "Permission Denied"

**Meaning:** Your user account lacks required permissions for this action

**Resolution:** Contact system administrator to request appropriate permissions

---

#### "Session Expired"

**Meaning:** You've been logged out due to inactivity (30 minutes)

**Resolution:** Login again. Your work in progress may be lost.

---

#### "Record Locked"

**Meaning:** Another user is currently editing this record

**Resolution:** Wait for other user to finish, then try again. Or contact them to coordinate.

---

#### "Invalid Fiscal Number"

**Meaning:** Fiscal sequence exhausted or configuration incorrect

**Resolution:** Contact administrator to configure new fiscal sequence range.

---

### Getting Help

**In-System Help:**
- Click "?" icon in top navigation
- Hover over field labels for tooltips
- Click "Help" link in error messages

**Contact Support:**
- Email: support@hmis.example.com
- Phone: +1-809-XXX-XXXX
- Support Hours: Monday-Friday, 8am-6pm

**Submit Feedback:**
- Navigate to **Help > Feedback**
- Describe issue or suggestion
- Attach screenshots if applicable
- Submit form

---

## Glossary

**BMI (Body Mass Index):** Measure of body fat based on height and weight

**Chart:** Complete medical record for a patient

**Claim:** Request submitted to insurance for payment of services

**CPT Code:** Current Procedural Terminology, standardized codes for medical procedures

**Credit Note:** Document reducing amount owed on an invoice

**DGII:** Dirección General de Impuestos Internos (Dominican tax authority)

**EHR/EMR:** Electronic Health/Medical Record

**Encounter:** A single episode of care (visit, admission, etc.)

**FEFO:** First Expired, First Out (inventory management strategy)

**Fiscal Number (NCF):** Tax-compliant invoice number (Dominican Republic)

**ICD-10:** International Classification of Diseases, 10th revision (diagnosis codes)

**Invoice:** Bill for services rendered

**ITBIS:** Impuesto sobre Transferencias de Bienes Industrializados y Servicios (Dominican sales tax)

**MRN:** Medical Record Number (unique patient identifier)

**Problem List:** Ongoing list of patient's active health issues

**Provider:** Healthcare professional (doctor, nurse practitioner, etc.)

**RNC:** Registro Nacional de Contribuyentes (Dominican tax ID)

**SOAP Note:** Subjective, Objective, Assessment, Plan (clinical note format)

**Tenant:** Individual hospital or organization using the system

**Vital Signs:** Basic health measurements (blood pressure, temperature, etc.)

---

**End of User Manual**

For technical documentation, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
For deployment information, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
For API reference, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
