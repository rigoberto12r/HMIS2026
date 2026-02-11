# Security Policy

**Version:** 1.0.0
**Last Updated:** February 7, 2026

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [HIPAA Compliance](#hipaa-compliance)
3. [Authentication & Authorization](#authentication--authorization)
4. [Data Encryption](#data-encryption)
5. [Multi-Tenancy Isolation](#multi-tenancy-isolation)
6. [Audit Logging](#audit-logging)
7. [PCI Compliance](#pci-compliance)
8. [Security Checklist](#security-checklist)
9. [Vulnerability Reporting](#vulnerability-reporting)

---

## Security Overview

HMIS SaaS implements defense-in-depth security measures to protect sensitive healthcare data. The application is designed with security as a core principle, following industry best practices and regulatory requirements.

### Security Layers

1. **Network Security**: Firewall rules, VPC isolation, HTTPS-only
2. **Application Security**: Input validation, CSRF protection, rate limiting
3. **Authentication**: Multi-factor authentication capable, strong password policies
4. **Authorization**: Role-based access control (RBAC), permission-level granularity
5. **Data Security**: Encryption at rest and in transit
6. **Audit**: Comprehensive logging of all access and changes
7. **Compliance**: HIPAA, PCI-DSS considerations

---

## HIPAA Compliance

### Overview

While HMIS SaaS implements technical safeguards aligned with HIPAA requirements, **full HIPAA compliance requires organizational policies and procedures** beyond software implementation.

**Important:** Deploying organizations must:
- Sign Business Associate Agreements (BAA)
- Implement administrative safeguards
- Train staff on HIPAA policies
- Conduct risk assessments
- Establish incident response procedures

### Technical Safeguards Implemented

#### Access Control (§ 164.312(a)(1))

✅ **Unique User Identification:**
- Each user has unique email-based account
- No shared credentials
- User actions tied to specific user ID

✅ **Emergency Access Procedure:**
- Admin users can reset passwords for locked accounts
- Audit log captures all emergency access

✅ **Automatic Logoff:**
- JWT tokens expire after 30 minutes of inactivity
- Refresh tokens expire after 7 days
- Frontend clears sensitive data on logout

✅ **Encryption and Decryption:**
- All passwords hashed with Argon2
- Database encryption at rest (PostgreSQL pgcrypto)
- TLS 1.2+ for data in transit

#### Audit Controls (§ 164.312(b))

✅ **Comprehensive Audit Logging:**
- All patient record access logged
- All modifications logged with before/after values
- Failed login attempts logged
- Permission changes logged

**Audit Log Fields:**
```json
{
  "timestamp": "2026-02-07T10:30:00Z",
  "user_id": "uuid",
  "tenant_id": "hospital_id",
  "action": "patient.read",
  "resource_type": "Patient",
  "resource_id": "patient-uuid",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "changes": {"field": "old -> new"}
}
```

**Audit Log Retention:**
- Minimum 6 years (HIPAA requirement)
- Partitioned by month for performance
- Archived to cold storage after 2 years

#### Integrity (§ 164.312(c)(1))

✅ **Data Integrity Controls:**
- Database constraints prevent invalid data
- Pydantic validation on all API inputs
- Checksums for file uploads
- Signed clinical notes (immutable after signature)

✅ **Mechanism to Authenticate ePHI:**
- Digital signatures for clinical documentation
- Audit trail prevents tampering
- Database triggers prevent unauthorized modifications

#### Transmission Security (§ 164.312(e)(1))

✅ **Encryption:**
- HTTPS/TLS 1.2+ required for all connections
- WebSocket connections use WSS (TLS)
- Email transmission encrypted (TLS to email servers)

✅ **Integrity Controls:**
- HTTPS prevents man-in-the-middle attacks
- Webhook signature verification (Stripe)

### Physical Safeguards

**Note:** Cloud deployment inherits physical safeguards from cloud provider (AWS, Google Cloud, Azure).

Required for on-premise deployments:
- Facility access controls
- Workstation security
- Device and media controls

### Administrative Safeguards

**Organization Responsibilities:**
- [ ] Appoint Security Officer
- [ ] Conduct Risk Assessment
- [ ] Develop Security Policies
- [ ] Train Workforce
- [ ] Implement Sanctions Policy
- [ ] Establish Contingency Plan
- [ ] Sign Business Associate Agreements

---

## Authentication & Authorization

### Authentication

**JWT (JSON Web Tokens):**
- Access token: 30-minute expiration
- Refresh token: 7-day expiration
- Tokens signed with HS256 (configurable to RS256)
- Secure secret key (minimum 32 bytes)

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character
- Passwords hashed with Argon2 (OWASP recommended)

**Account Security:**
- Failed login attempts logged
- Account lockout after 5 failed attempts (15-minute duration)
- Password reset requires email verification
- Password reset links expire after 1 hour

**Session Management:**
- Automatic logout after 30 minutes inactivity
- Single session per user (optional multi-session)
- Secure cookie flags: HttpOnly, Secure, SameSite

### Authorization

**Role-Based Access Control (RBAC):**

**Predefined Roles:**
- **Admin**: Full system access
- **Doctor** (Medico): Clinical access, prescriptions, EMR
- **Nurse**: Patient care, vital signs, basic EMR
- **Pharmacist** (Farmaceutico): Pharmacy, dispensation, inventory
- **Billing Staff**: Invoicing, payments, claims
- **Receptionist**: Appointments, patient registration

**Granular Permissions:**
```
patients:read       - View patient information
patients:write      - Create/edit patient information
encounters:read     - View medical records
encounters:write    - Document medical records
prescriptions:write - Create prescriptions
billing:read        - View invoices
billing:write       - Create/edit invoices
claims:write        - Submit insurance claims
inventory:read      - View pharmacy inventory
inventory:write     - Manage pharmacy inventory
reports:read        - Run reports
reports:create      - Create custom reports
users:read          - View users
users:write         - Manage users
```

**Permission Checks:**
```python
# Backend: Dependency injection
@router.post("/patients")
async def create_patient(
    current_user: User = Depends(require_permissions("patients:write"))
):
    # Only users with patients:write permission can execute
    pass
```

---

## Data Encryption

### Encryption at Rest

**Database:**
- **PostgreSQL**: pgcrypto extension for field-level encryption
- **Disk Encryption**: Full disk encryption (LUKS on Linux, BitLocker on Windows)
- **Backups**: Encrypted backups using AES-256

**Encrypted Fields:**
- Social Security Numbers (SSN)
- Credit card details (if stored - **not recommended, use Stripe**)
- Sensitive notes (optional)

**Implementation:**
```sql
-- Example: Encrypted SSN field
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE patients ADD COLUMN ssn_encrypted BYTEA;

-- Encrypt on insert
INSERT INTO patients (ssn_encrypted)
VALUES (pgp_sym_encrypt('123-45-6789', 'encryption-key'));

-- Decrypt on select (application only)
SELECT pgp_sym_decrypt(ssn_encrypted, 'encryption-key') FROM patients;
```

### Encryption in Transit

**HTTPS/TLS:**
- TLS 1.2 minimum, TLS 1.3 preferred
- Strong cipher suites only
- HSTS header enforced
- Certificate from trusted CA (Let's Encrypt or commercial)

**Nginx Configuration:**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256...';
ssl_prefer_server_ciphers on;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**Email:**
- STARTTLS to email servers
- SendGrid uses TLS by default
- No sensitive data in email body (use portal links)

**File Storage:**
- S3/MinIO connections use HTTPS
- Files encrypted with S3 server-side encryption (SSE-S3 or SSE-KMS)

---

## Multi-Tenancy Isolation

### Schema-Per-Tenant Architecture

Each hospital (tenant) has isolated PostgreSQL schema:

```
public                    # Shared system tables (tenants, migrations)
├── tenants
└── alembic_version

tenant_hospital_a        # Hospital A's data
├── patients
├── appointments
├── encounters
└── ...

tenant_hospital_b        # Hospital B's data
├── patients
├── appointments
├── encounters
└── ...
```

### Tenant Isolation Guarantees

**Automatic Tenant Resolution:**
```python
# Middleware sets tenant context from authenticated user
@app.middleware("http")
async def tenant_middleware(request, call_next):
    user = get_current_user(request)
    current_tenant.set(user.tenant_id)
    # All queries automatically scoped to tenant
    response = await call_next(request)
    return response
```

**Query-Level Isolation:**
```python
# SQLAlchemy automatically adds tenant filter
stmt = select(Patient)  # Automatically filtered by current tenant
# Equivalent to: WHERE tenant_id = 'current_tenant'
```

**Row-Level Security (PostgreSQL):**
```sql
-- Additional RLS policy (defense-in-depth)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON patients
    USING (tenant_id = current_setting('app.current_tenant'));
```

**No Cross-Tenant Queries:**
- Application code cannot access other tenants' data
- Even with SQL injection, RLS prevents cross-tenant access
- Superuser accounts explicitly bypass (for admin functions only)

### Tenant Data Separation

**File Storage:**
- Separate S3 buckets or bucket prefixes per tenant
- `s3://hmis-files/tenant_a/patient_123/file.pdf`

**Cache:**
- Redis keys prefixed with tenant ID
- `tenant_a:session:user_123`

**Search Index:**
- Meilisearch indexes per tenant
- `hmis_tenant_a_patients`

---

## Audit Logging

### What is Logged

**Patient Access:**
- ✅ Patient record viewed
- ✅ Patient created
- ✅ Patient updated
- ✅ Patient deactivated

**Clinical Actions:**
- ✅ Encounter created
- ✅ Clinical note added
- ✅ Clinical note signed
- ✅ Diagnosis added
- ✅ Prescription created
- ✅ Medication dispensed

**Billing Actions:**
- ✅ Invoice created
- ✅ Payment recorded
- ✅ Insurance claim submitted

**Administrative Actions:**
- ✅ User created
- ✅ User permissions changed
- ✅ User deactivated
- ✅ Role assigned/revoked

**Security Events:**
- ✅ Login successful
- ✅ Login failed
- ✅ Logout
- ✅ Password changed
- ✅ Unauthorized access attempt

### Audit Log Implementation

**Middleware-Based (Automatic):**
```python
@app.middleware("http")
async def audit_middleware(request, call_next):
    start_time = time.time()
    response = await call_next(request)

    # Log after request completes
    log_entry = {
        "timestamp": datetime.now(UTC),
        "user_id": current_user.id,
        "tenant_id": current_tenant.get(),
        "action": f"{request.method} {request.url.path}",
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "status_code": response.status_code,
        "duration_ms": (time.time() - start_time) * 1000
    }

    await audit_log_service.log(log_entry)
    return response
```

**Model-Level (Granular):**
```python
# Track changes to specific models
@event.listens_for(Patient, 'before_update')
def log_patient_update(mapper, connection, target):
    changes = {}
    for attr in inspect(target).attrs:
        hist = attr.load_history()
        if hist.has_changes():
            changes[attr.key] = {
                "old": hist.deleted[0] if hist.deleted else None,
                "new": hist.added[0] if hist.added else None
            }

    if changes:
        audit_log.create({
            "action": "patient.update",
            "resource_id": target.id,
            "changes": changes,
            "user_id": current_user.get()
        })
```

### Audit Log Retention

**Retention Policy:**
- **Active Storage**: 2 years (hot, indexed, searchable)
- **Archive Storage**: 2-6 years (cold, compressed, read-only)
- **Total Retention**: 6 years minimum (HIPAA requirement)

**Partitioning:**
```sql
-- Partition audit logs by month for performance
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

**Archival Process:**
```bash
# Monthly cron job
0 0 1 * * /scripts/archive_audit_logs.sh
```

### Audit Log Query

**Viewing Logs (Admin UI):**
- Filter by user, date range, action type
- Search by resource ID
- Export to CSV/Excel

**API Endpoint:**
```
GET /api/v1/admin/audit-logs?user_id=xxx&start_date=2026-02-01&end_date=2026-02-07
```

---

## PCI Compliance

### Payment Card Industry Data Security Standard (PCI-DSS)

**HMIS SaaS uses Stripe for payment processing to avoid PCI compliance burden.**

### Stripe Integration Security

**No Card Data Stored:**
- Card details **never** touch HMIS servers
- Stripe Elements (frontend) sends card data directly to Stripe
- HMIS only receives tokenized payment methods

**Secure Flow:**
```
1. Frontend: Stripe Elements collects card data
2. Frontend → Stripe: Card data sent via HTTPS
3. Stripe → Frontend: Returns PaymentMethod ID (token)
4. Frontend → HMIS Backend: Sends PaymentMethod ID
5. Backend → Stripe: Creates payment with token
6. Stripe → Backend: Returns payment status
7. Backend → Database: Stores payment status (NOT card data)
```

**Webhook Signature Verification:**
```python
# Verify Stripe webhook signatures
import stripe

def verify_webhook(payload: bytes, signature: str):
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, webhook_secret
        )
        return event
    except ValueError:
        # Invalid payload
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        # Invalid signature
        raise HTTPException(400, "Invalid signature")
```

**PCI Compliance via Stripe:**
- ✅ Stripe is PCI Level 1 certified
- ✅ HMIS inherits compliance by not handling card data
- ✅ Annual Self-Assessment Questionnaire (SAQ-A) required
- ✅ Quarterly network scans (if applicable)

### Best Practices

1. **Never log card data**
2. **Never store CVV**
3. **Use HTTPS everywhere**
4. **Verify webhook signatures**
5. **Use Stripe's official libraries**
6. **Monitor for suspicious activity**

---

## Security Checklist

### Pre-Deployment Security Checklist

**Infrastructure:**
- [ ] Firewall configured (ports 80, 443 only public)
- [ ] SSH key-based authentication (no passwords)
- [ ] Root login disabled
- [ ] Automatic security updates enabled
- [ ] Intrusion detection system (IDS) configured
- [ ] DDoS protection enabled (CloudFlare or similar)

**Application:**
- [ ] All secrets in environment variables (not code)
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] SSL certificate valid and auto-renewing
- [ ] HSTS header enabled
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output escaping)

**Database:**
- [ ] Database user has minimum required permissions
- [ ] Database accessible only from application servers
- [ ] Database backups encrypted
- [ ] Regular backup testing
- [ ] Row-level security enabled (if applicable)

**Authentication:**
- [ ] Strong password policy enforced
- [ ] JWT secret key is strong (32+ bytes)
- [ ] Token expiration configured
- [ ] Failed login attempt limiting
- [ ] Account lockout policy

**Monitoring:**
- [ ] Logging configured and centralized
- [ ] Alerts for failed logins
- [ ] Alerts for unusual activity
- [ ] Sentry error tracking configured
- [ ] Uptime monitoring (UptimeRobot, etc.)

**Compliance:**
- [ ] HIPAA policies documented
- [ ] BAA signed with cloud provider
- [ ] BAA signed with Stripe
- [ ] BAA signed with SendGrid
- [ ] Staff HIPAA training completed
- [ ] Incident response plan documented
- [ ] Data breach notification procedure

**Testing:**
- [ ] Security audit completed
- [ ] Penetration testing conducted
- [ ] Vulnerability scanning (OWASP ZAP, etc.)
- [ ] Dependency vulnerability check (npm audit, safety)

### Ongoing Security Maintenance

**Weekly:**
- [ ] Review failed login attempts
- [ ] Check for unusual activity in audit logs

**Monthly:**
- [ ] Review user permissions
- [ ] Update dependencies (npm update, pip upgrade)
- [ ] Review security alerts (GitHub Dependabot, etc.)

**Quarterly:**
- [ ] Change database passwords
- [ ] Rotate API keys
- [ ] Review access control policies
- [ ] Vulnerability scan

**Annually:**
- [ ] Security audit
- [ ] Penetration testing
- [ ] HIPAA risk assessment
- [ ] Review and update security policies
- [ ] Staff security training

---

## Vulnerability Reporting

### Responsible Disclosure

We take security seriously. If you discover a security vulnerability, please follow responsible disclosure:

**DO:**
- Report privately to security team
- Provide detailed steps to reproduce
- Allow reasonable time for fix (90 days)
- Keep vulnerability confidential until patched

**DON'T:**
- Publicly disclose before fix
- Exploit vulnerability
- Access data you don't own
- Perform DoS attacks

### How to Report

**Email:** security@hmis.example.com

**PGP Key:** [Provide PGP public key]

**Include:**
1. Vulnerability description
2. Steps to reproduce
3. Affected versions
4. Potential impact
5. Suggested fix (if any)
6. Your contact information

**Response Timeline:**
- Initial response: 24 hours
- Triage: 72 hours
- Fix timeline: Based on severity
  - Critical: 7 days
  - High: 30 days
  - Medium: 90 days
  - Low: Next release

**Severity Levels:**

**Critical:**
- Remote code execution
- Authentication bypass
- Mass data exposure

**High:**
- Privilege escalation
- SQL injection
- XSS allowing account takeover

**Medium:**
- Information disclosure
- CSRF
- Reflected XSS

**Low:**
- Non-sensitive information disclosure
- UI bugs with security implications

### Bug Bounty

**Rewards for valid vulnerabilities:**
- Critical: $500 - $2000
- High: $200 - $500
- Medium: $50 - $200
- Low: Recognition in Hall of Fame

**Out of Scope:**
- Social engineering
- Physical attacks
- DoS attacks
- Spam/phishing
- Issues in third-party services (report to them)

---

## Security Contacts

**Security Team:** security@hmis.example.com
**Privacy Officer:** privacy@hmis.example.com
**General Support:** support@hmis.example.com

---

**This security policy is subject to change. Last updated: February 7, 2026**
