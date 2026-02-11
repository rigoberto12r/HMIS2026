# HMIS SaaS - Hospital Management Information System

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node](https://img.shields.io/badge/node-18.0+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16+-blue.svg)](https://www.postgresql.org/)

> **Cloud-native Hospital Management Information System designed for Latin America**

HMIS SaaS is a comprehensive, multi-tenant healthcare platform providing integrated management of patients, appointments, electronic medical records, billing, pharmacy, and more. Built with modern technologies and designed for scalability, security, and regulatory compliance.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

---

## Features

### Core Modules

#### 🏥 Patient Management
- Patient registration with unique Medical Record Number (MRN)
- Comprehensive demographics and contact information
- Multi-insurance policy support
- Advanced search with filters
- Patient portal for self-service

#### 📅 Appointment Scheduling
- Provider management with specialties
- Availability calendar with conflict detection
- Multi-status appointment workflow
- Rescheduling and cancellation
- Waiting list with priorities
- Patient check-in

#### 📋 Electronic Medical Records (EMR)
- Clinical encounters (outpatient, emergency, inpatient)
- SOAP notes with digital signatures
- Vital signs tracking with BMI calculation
- ICD-10 coded diagnoses
- Allergy management with alerts
- Medical orders (lab, imaging, procedures)
- Problem list
- Clinical templates

#### 💊 Pharmacy & Inventory
- Electronic prescriptions
- Drug allergy and interaction checking
- Lot-based dispensation (FEFO)
- Multi-warehouse inventory management
- Reorder point alerts
- Expiring medication tracking
- Controlled substance logging
- Purchase order management

#### 💰 Billing & Financial Management
- Invoice generation with tax calculation
- Fiscal compliance (NCF for Dominican Republic)
- Payment processing (cash, card, bank transfer)
- Insurance claim management
- Credit notes
- General ledger accounting
- Accounts receivable aging
- DGII reports (607, 608, 609)
- PDF invoice generation

#### 💳 Payment Gateway (Stripe)
- Online payment processing
- Saved payment methods
- 3D Secure support
- Refunds (full and partial)
- PCI-compliant (no card data stored)
- Webhook integration

#### 🔐 Patient Portal
- Self-service registration
- View appointments and medical records
- Book and cancel appointments
- View prescriptions and request refills
- Pay invoices online
- Download receipts and documents

#### 📊 Custom Reporting
- Report builder with visual query designer
- Predefined clinical and financial reports
- Multiple export formats (PDF, Excel, CSV)
- Scheduled report delivery
- Real-time data access

### Platform Features

#### 🔒 Security & Compliance
- HIPAA-compliant technical safeguards
- Multi-tenant data isolation (schema-per-tenant)
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Comprehensive audit logging
- Encryption at rest and in transit
- PCI-DSS compliant payments via Stripe

#### 🌐 Multi-Tenancy
- Schema-per-tenant architecture
- Complete data isolation
- Separate databases per hospital
- Tenant-specific configurations
- No cross-tenant data leakage

#### 📧 Notifications
- Email notifications via SendGrid
- Appointment reminders
- Payment receipts
- Password reset emails
- Customizable templates

#### 📈 Monitoring & Observability
- Prometheus metrics
- Sentry error tracking
- Structured JSON logging
- Health checks and probes
- Performance monitoring

#### 🎨 Modern UI/UX
- Responsive design (mobile, tablet, desktop)
- Tailwind CSS styling
- Intuitive navigation
- Error boundaries
- Loading states
- Toast notifications

---

## Tech Stack

### Backend
- **Framework:** FastAPI 0.109+
- **Language:** Python 3.11+
- **Database:** PostgreSQL 16 with async support
- **ORM:** SQLAlchemy 2.0 (async)
- **Migrations:** Alembic 1.13
- **Validation:** Pydantic 2.6
- **Cache:** Redis 7
- **Search:** Meilisearch 0.31
- **Testing:** pytest
- **Authentication:** python-jose (JWT)
- **Password Hashing:** passlib with Argon2

### Frontend
- **Framework:** Next.js 14.1 (App Router)
- **Language:** TypeScript 5.3
- **UI Library:** React 18.2
- **Styling:** Tailwind CSS 3.4
- **State Management:** Zustand 4.4
- **Data Fetching:** TanStack Query 5.17
- **Forms:** React Hook Form 7.49 + Zod
- **Charts:** Recharts 2.10
- **Testing:** Jest 29.7 + React Testing Library

### Infrastructure
- **Containerization:** Docker, Docker Compose
- **Orchestration:** Kubernetes (optional)
- **Reverse Proxy:** Nginx
- **Metrics:** Prometheus, Grafana
- **Error Tracking:** Sentry
- **CI/CD:** GitHub Actions

### External Services
- **Payments:** Stripe
- **Email:** SendGrid
- **Storage:** MinIO / AWS S3
- **Monitoring:** Sentry

---

## Quick Start

### Prerequisites

- Docker 24.0+ and Docker Compose 2.20+
- OR Python 3.11+ and Node.js 18+
- PostgreSQL 16+ (if not using Docker)
- Redis 7+ (if not using Docker)

### Option 1: Docker Compose (Recommended)

Get the entire stack running in 5 minutes:

```bash
# Clone repository
git clone https://github.com/yourhospital/hmis-saas.git
cd hmis-saas

# Copy environment file
cp .env.example .env

# Edit .env with your settings (optional for local dev)
nano .env

# Start all services
docker compose up -d

# Wait for services to be healthy (~30 seconds)
docker compose ps

# Run database migrations
docker compose exec backend alembic upgrade head

# Create admin user
docker compose exec backend python -m scripts.create_admin \
  --email admin@hospital.com \
  --password AdminPass123! \
  --tenant-id demo_hospital

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/api/docs
```

**Login:**
- Email: `admin@hospital.com`
- Password: `AdminPass123!`

### Option 2: Manual Setup

**Backend:**

```bash
cd hmis-backend

# Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/hmis"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY="your-secret-key"

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd hmis-frontend

# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"

# Start development server
npm run dev
```

### Seed Demo Data (Optional)

```bash
docker compose exec backend python scripts/seed_demo_data.py
```

This creates:
- 10 sample patients
- 5 providers
- 20 appointments
- Sample encounters with notes
- Sample invoices

---

## Documentation

### For Users
- **[User Manual](./USER_MANUAL.md)** - Complete guide for end users
  - Patient management
  - Appointment scheduling
  - EMR documentation
  - Billing and payments
  - Pharmacy operations
  - Patient portal usage

### For Administrators
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment
  - System requirements
  - Docker/Kubernetes deployment
  - Cloud deployment (AWS, GCP, Azure)
  - SSL/TLS configuration
  - Monitoring and logging
  - Backup and disaster recovery
  - Security hardening

### For Developers
- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Development setup and contribution
  - Local development setup
  - Architecture overview
  - Code organization
  - Creating new modules
  - Testing strategy
  - Code style guide
  - Contributing guidelines

### API Reference
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
  - Authentication
  - All endpoints with examples
  - Request/response formats
  - Error handling
  - Rate limiting
  - SDK examples (Python, JavaScript)

### Security
- **[Security Policy](./SECURITY.md)** - Security and compliance
  - HIPAA compliance
  - Data encryption
  - Multi-tenancy isolation
  - Audit logging
  - PCI compliance
  - Vulnerability reporting

### Release Notes
- **[Changelog](./CHANGELOG.md)** - Version history and changes

---

## Project Structure

```
HMIS2026/
├── hmis-backend/              # FastAPI backend
│   ├── alembic/               # Database migrations
│   ├── app/
│   │   ├── core/              # Core functionality
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication
│   │   │   ├── patients/      # Patient management
│   │   │   ├── appointments/  # Scheduling
│   │   │   ├── emr/           # Medical records
│   │   │   ├── billing/       # Billing & accounting
│   │   │   ├── pharmacy/      # Pharmacy & inventory
│   │   │   ├── portal/        # Patient portal
│   │   │   ├── reports/       # Custom reporting
│   │   │   └── admin/         # Administration
│   │   ├── integrations/      # External integrations
│   │   ├── shared/            # Shared utilities
│   │   └── tasks/             # Background tasks
│   ├── tests/                 # Test suite
│   └── scripts/               # Utility scripts
│
├── hmis-frontend/             # Next.js frontend
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── (app)/         # Main application
│   │   │   ├── auth/          # Authentication pages
│   │   │   └── portal/        # Patient portal
│   │   ├── components/        # React components
│   │   ├── lib/               # Utilities
│   │   ├── stores/            # Zustand stores
│   │   └── types/             # TypeScript types
│   └── __tests__/             # Frontend tests
│
├── hmis-infra/                # Infrastructure as Code
│   ├── terraform/             # Terraform configs
│   ├── k8s/                   # Kubernetes manifests
│   └── helm/                  # Helm charts
│
├── docs/                      # Additional documentation
├── scripts/                   # Deployment scripts
│
├── docker-compose.yml         # Development stack
├── docker-compose.prod.yml    # Production stack
├── .env.example               # Environment variables template
│
├── USER_MANUAL.md             # User guide
├── DEPLOYMENT_GUIDE.md        # Deployment guide
├── API_DOCUMENTATION.md       # API reference
├── DEVELOPER_GUIDE.md         # Developer guide
├── SECURITY.md                # Security policy
├── CHANGELOG.md               # Version history
└── README.md                  # This file
```

---

## Screenshots

### Dashboard
> Main dashboard with key metrics and quick actions

### Patient Management
> Patient search, registration, and profile view

### Appointment Calendar
> Weekly calendar view with color-coded appointments

### EMR - Clinical Notes
> SOAP note creation with clinical templates

### Billing
> Invoice generation with line items and tax calculation

### Pharmacy
> Prescription creation and medication dispensation

### Patient Portal
> Patient-facing interface for appointments and payments

### Reports
> Custom report builder with visual query designer

---

## Deployment

### Development

```bash
docker compose up -d
```

### Staging

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Production

**Docker Compose:**
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#option-1-docker-compose-single-server)

**Kubernetes:**
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#option-2-kubernetes-cloud-native)

**Cloud Platforms:**
- [AWS](./DEPLOYMENT_GUIDE.md#option-3-aws-deployment)
- [Google Cloud](./DEPLOYMENT_GUIDE.md#option-4-google-cloud-platform)
- [Azure](./DEPLOYMENT_GUIDE.md#option-5-azure-deployment)

### Environment Variables

Key environment variables to configure:

```bash
# Security (REQUIRED - Change these!)
SECRET_KEY=<generate-random-secret>
JWT_SECRET_KEY=<generate-random-secret>
POSTGRES_PASSWORD=<strong-password>

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/hmis

# Redis
REDIS_URL=redis://host:6379/0

# External Services
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG....
SENTRY_DSN=https://...

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourhospital.com/api/v1
```

See `.env.example` for complete list.

---

## Contributing

We welcome contributions from the community!

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   # Backend
   cd hmis-backend && pytest

   # Frontend
   cd hmis-frontend && npm test
   ```
5. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Write tests for new features
- Update documentation
- Code must pass linting (Black, ESLint)
- Follow the coding style of the project

See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md#contributing) for detailed guidelines.

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on what is best for the project

---

## Support

### Getting Help

- **Documentation:** Check the docs in this repository
- **Issues:** [GitHub Issues](https://github.com/yourhospital/hmis-saas/issues)
- **Email:** support@hmis.example.com
- **Community:** [Discord Server](#) (coming soon)

### Reporting Bugs

Please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, versions)
- Screenshots if applicable

### Feature Requests

- Check existing issues first
- Describe the problem it solves
- Propose a solution (if any)
- Discuss with maintainers before implementing

### Security Issues

For security vulnerabilities, please email security@hmis.example.com instead of using the public issue tracker. See [SECURITY.md](./SECURITY.md#vulnerability-reporting) for details.

---

## Roadmap

### Version 1.1 (Q2 2026)
- [ ] Two-factor authentication (2FA)
- [ ] Advanced analytics with charts
- [ ] Lab results module
- [ ] Radiology/imaging module
- [ ] Inpatient bed management

### Version 1.2 (Q3 2026)
- [ ] Mobile applications (iOS, Android)
- [ ] Offline mode support
- [ ] Voice dictation for notes
- [ ] Telemedicine (video consultations)
- [ ] HL7/FHIR API support

### Version 2.0 (Q4 2026)
- [ ] AI-powered clinical decision support
- [ ] Advanced medication interaction database
- [ ] Multi-facility support (hospital networks)
- [ ] Business intelligence dashboards

See [CHANGELOG.md](./CHANGELOG.md#unreleased) for complete roadmap.

---

## License

**MIT License**

Copyright (c) 2026 HMIS SaaS Development Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Acknowledgments

- Built with ❤️ by the HMIS development team
- Powered by open-source technologies
- AI assistance provided by Claude Sonnet 4.5
- Special thanks to all contributors

---

## Links

- **Repository:** https://github.com/yourhospital/hmis-saas
- **Documentation:** https://docs.hmis.example.com
- **Website:** https://hmis.example.com
- **Support:** support@hmis.example.com

---

**HMIS SaaS** - Transforming healthcare management for Latin America 🏥
