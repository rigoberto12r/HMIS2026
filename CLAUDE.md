# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HMIS SaaS is a cloud-native Hospital Management Information System designed for Latin American markets. It's a full-stack monorepo with:

- **Backend**: FastAPI + SQLAlchemy async (Python 3.12+)
- **Frontend**: Next.js 14 with App Router (TypeScript, React)
- **Database**: PostgreSQL 16+ with multi-schema tenancy
- **Cache**: Redis 7+
- **Search**: Meilisearch

## Commands

### Backend Development

```bash
cd hmis-backend

# Setup (first time)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# Run development server
uvicorn app.main:app --reload

# Database migrations
alembic upgrade head                    # Apply migrations
alembic revision --autogenerate -m ""   # Create new migration
alembic downgrade -1                    # Rollback one migration

# Testing
pytest                                  # Run all tests
pytest tests/unit                       # Unit tests only
pytest tests/integration                # Integration tests only
pytest -k test_name                     # Run specific test
pytest --cov=app --cov-report=html      # With coverage

# Code quality
ruff check .                            # Lint
ruff format .                           # Format
mypy app                                # Type checking
```

### Frontend Development

```bash
cd hmis-frontend

# Setup (first time)
npm install

# Run development server
npm run dev

# Build & production
npm run build
npm start

# Code quality
npm run lint
npm run type-check

# Testing
npm test                                # Jest tests
npm run test:watch                      # Jest watch mode
npm run test:coverage                   # Jest with coverage
npm run build:analyze                   # Bundle analyzer
```

### Docker (Full Stack)

```bash
# Development
docker compose up -d                              # Start all services
docker compose exec backend alembic upgrade head   # Run migrations
docker compose exec backend python -m scripts.seed_data  # Seed initial data
docker compose logs -f backend                     # Follow backend logs
docker compose logs -f frontend                    # Follow frontend logs
docker compose ps                                  # Check services status
docker compose down                                # Stop all services
docker compose down -v                             # Stop and remove volumes

# Rebuild after Dockerfile changes
docker compose build --no-cache
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d
```

**Note**: The frontend uses `Dockerfile.dev` for development (faster builds). Both frontend and backend have `.dockerignore` files to exclude large directories from build context.

**Docker services**: postgres, redis, meilisearch, jaeger (tracing UI at :16686), minio (S3-compatible at :9000), backend, frontend.

## Architecture

### Multi-Tenancy Pattern

The system uses **schema-per-tenant** isolation in PostgreSQL:

- Each hospital/clinic gets a separate schema (e.g., `tenant_hospital_a`, `tenant_hospital_b`)
- The `TenantMiddleware` (app/core/middleware.py) extracts tenant from `X-Tenant-ID` header or subdomain (`TENANT_SUBDOMAIN_ENABLED=true`)
- Database sessions automatically set `search_path` to the tenant schema via `current_tenant` ContextVar
- All models inherit from `BaseEntity` which includes UUID PKs, soft deletes, timestamps, and audit fields

**Key files**:
- app/core/database.py - Database setup with `current_tenant` ContextVar
- app/core/middleware.py - `TenantMiddleware` + `AuditMiddleware`
- app/shared/base_models.py - Reusable model mixins

### Backend Module Structure

Each module follows a consistent pattern:

```
app/modules/{module_name}/
  ├── models.py       # SQLAlchemy models (inherit from BaseEntity)
  ├── schemas.py      # Pydantic schemas for request/response validation
  ├── routes.py       # FastAPI router with endpoint definitions
  ├── service.py      # Business logic (optional, for complex modules)
  └── repository.py   # Data access layer (patients, pharmacy, emr, cds)
```

**Modules** (14 total):
- `auth` - Authentication, JWT tokens, user management
- `patients` - Patient registry, demographics
- `appointments` - Scheduling, check-in/out
- `emr` - Electronic Medical Records (encounters, diagnoses, orders, clinical notes)
- `billing` - Invoicing, payments, insurance claims, fiscal compliance
- `pharmacy` - Prescriptions, dispensation, inventory, medication reconciliation (`med_rec_*.py`)
- `admin` - Tenant management, system configuration
- `fhir` - FHIR R4 interoperability API (Patient, Encounter, Condition, Observation)
- `ccda` - C-CDA R2.1 export for clinical document exchange
- `smart` - SMART on FHIR OAuth2 (RS256 JWKS, PKCE, client management)
- `cds` - Clinical Decision Support (drug interactions, allergy alerts)
- `portal` - Patient portal (self-service)
- `reports` - Custom reporting with CQRS (`cqrs_routes.py`)

**Shared layers**:
- `app/core/` - Config, database, cache, security, middleware, metrics, rate limiting, tracing, secrets
- `app/shared/` - Base models, event system, domain exceptions, repository base class
- `app/cqrs/` - CQRS implementation (queries, commands, projections for AR aging/diagnosis trends/revenue)
- `app/tasks/` - Background task scheduler (registered in app lifespan)
- `app/integrations/` - Email (SendGrid), payments (Stripe), fiscal (NCF/CFDI/DGII), PDF, FHIR mapper

### Key Backend Patterns

**Repository pattern** — Services use repositories, not raw SQLAlchemy:
```python
# app/shared/repository.py (base class)
# Implemented in: patients, pharmacy, emr, cds
class PatientService:
    def __init__(self, db: AsyncSession):
        self.repo = PatientRepository(Patient, db)
    async def get_patient(self, id):
        return await self.repo.get_with_insurance(id)
```

**Domain exceptions** — Use `app/shared/exceptions.py`, not `ValueError`:
```python
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError
# Global handler in app/main.py maps these to HTTP status codes automatically
raise ConflictError("Patient already exists", details={"document": doc})
```

**Event system with DLQ** — `app/shared/events.py`:
- Redis Streams for event persistence
- 3 retry attempts with exponential backoff
- Failed events go to Dead Letter Queue (`events:dlq`)

**Dual authentication**:
- Internal auth: HS256 JWT (`app/core/security.py`)
- SMART on FHIR: RS256 JWT with JWKS (`app/modules/smart/`)
- FHIR routes accept both via `get_fhir_auth()` dependency, returning `FHIRAuthContext`

**CQRS projections** (`app/cqrs/`):
- AR Aging, Diagnosis Trends, Revenue metrics
- Cached in Redis with tenant-scoped keys
- Read replica support via `READ_DATABASE_URL`

### Frontend Architecture

Next.js 14 App Router with:

```
src/
  ├── app/
  │   ├── (app)/              # Protected routes (requires auth)
  │   │   ├── dashboard/
  │   │   ├── patients/
  │   │   ├── appointments/
  │   │   ├── emr/
  │   │   ├── billing/
  │   │   ├── pharmacy/
  │   │   └── settings/
  │   └── auth/               # Public auth routes (login)
  ├── components/
  │   ├── ui/                 # Reusable UI components
  │   ├── clinical/           # Domain-specific (CDS alerts, prescription form)
  │   ├── reports/            # Report builder, viewer, templates
  │   ├── payments/           # Payment form, success/error
  │   └── settings/           # SMART apps modal
  ├── hooks/                  # React Query hooks (12+: usePatients, useAppointments, useEncounters, useInvoices, useDashboard, useCDS, useMedRec, useSmartApps, etc.)
  └── lib/
      ├── api.ts              # Main API client (auth + tenant headers, token refresh)
      ├── portal-api.ts       # Patient portal API client
      ├── auth.ts             # Auth utilities
      ├── i18n.ts             # Internationalization
      ├── prefetch.ts         # Data prefetching
      └── performance.ts      # Performance monitoring
```

**State management**:
- `@tanstack/react-query` for server state (fetching, caching) — always use hooks, never manual useEffect
- `zustand` for global client state (user session, UI state)

**Performance**: Dynamic imports for heavy components (`soap-note-editor.dynamic.tsx`, `report-viewer.dynamic.tsx`, `payment-form.dynamic.tsx`). Next.js config enables `optimizePackageImports`, `serverActions`, `optimizeCss`, SWC minification, image optimization (AVIF/WebP).

### Testing Strategy

**Backend** (hmis-backend/tests/):
- SQLite async in-memory DB (`sqlite+aiosqlite`) — JSONB compiled as JSON for compatibility
- Redis mocked with `AsyncMock`
- FastAPI lifespan replaced with no-op (no real PostgreSQL/Redis)
- Fixtures: `db_session`, `client`, `auth_headers`, `admin_user`, `medico_user`, `sample_patient`, `sample_encounter`, `sample_vital_signs`
- Coverage threshold: 70% (enforced in CI)

**Frontend** (Jest 29.7 + React Testing Library):
- Tests in `src/lib/__tests__/`, `src/components/__tests__/`
- Coverage threshold: 70%
- Cypress config exists for E2E (`cypress.config.ts`)

### Authentication Flow

1. User logs in via `/api/v1/auth/login` (POST email/password)
2. Backend returns `access_token` (30min) + `refresh_token` (7 days)
3. Frontend stores in localStorage: `hmis_access_token`, `hmis_refresh_token`, `hmis_tenant_id`
4. All API requests include `Authorization: Bearer {access_token}` + `X-Tenant-ID: {tenant_id}`
5. On 401, frontend calls `/api/v1/auth/refresh` with refresh token
6. JWT payload includes: `user_id`, `tenant_id`, `role`, `exp`

### Database Models Convention

All models inherit from `BaseEntity` which provides:
- `id: UUID` (primary key)
- `created_at`, `updated_at` (automatic timestamps)
- `is_active`, `deleted_at` (soft delete support)
- `created_by`, `updated_by` (audit trail)

Use `SoftDeleteMixin` methods for deletes instead of actual deletion.

### API Response Format

**Success** (200/201):
```json
{ "id": "uuid", "field": "value" }
```

**List** (200):
```json
{ "items": [...], "total": 100, "page": 1, "page_size": 20 }
```

**Error** (4xx/5xx):
```json
{ "detail": "Error message" }
```

### Observability

**OpenTelemetry** (`app/core/tracing.py`):
- Instruments FastAPI, SQLAlchemy, Redis
- OTLP exporter to Jaeger/Tempo (UI at localhost:16686)
- Disabled in dev/test, enabled in staging/production
- Config: `OTLP_ENDPOINT`, `OTLP_INSECURE`, `TRACING_EXCLUDED_URLS`

**Rate limiting** (`app/core/rate_limit.py`):
- Redis ZSET sliding window (distributed, cluster-safe)
- General: 100 req/min, Login: 5 req/min
- Falls back to allowing requests if Redis is down

**Health checks**: `/health`, `/health/live`, `/health/ready`, `/metrics` (Prometheus)

### Environment Variables

Critical variables (see .env.example):
- `SECRET_KEY`, `JWT_SECRET_KEY` - Must be changed in production
- `DATABASE_URL`, `READ_DATABASE_URL` (optional CQRS read replica)
- `REDIS_URL` - Redis connection string
- `ENVIRONMENT` - `development` | `staging` | `production`
- `CORS_ORIGINS` - Comma-separated allowed origins
- `TENANT_HEADER` - Header name for tenant ID (default: `X-Tenant-ID`)
- `USE_SECRETS_MANAGER` - Enable AWS Secrets Manager in production (`app/core/secrets.py`)
- `SMART_RSA_PRIVATE_KEY_PATH` - RSA key for SMART on FHIR (auto-generates if missing)
- `DRUGBANK_API_URL`, `DRUGBANK_API_KEY`, `CDS_USE_EXTERNAL_API` - CDS drug interaction source

### Quick Local Start

```bash
docker compose up -d
docker compose exec backend alembic upgrade head
docker compose exec backend python -m scripts.seed_data
# Frontend: http://localhost:3000 | API docs: http://localhost:8000/api/docs
# Default admin: admin@hmis.app / Admin2026!
# Seed creates 6 roles: admin, medico, enfermera, recepcion, farmaceutico, facturacion
```

### CI/CD

**CI** (`.github/workflows/ci.yml`): backend-lint, backend-test (PostgreSQL+Redis services), backend-build, frontend-lint, frontend-test, frontend-build, security-scan (pip-audit, Trivy, CodeQL, Gitleaks), infra-validate (Terraform, Kubeval, Checkov).

**Deploy** (`.github/workflows/deploy.yml`): OIDC auth to AWS, multi-stage Docker → ECR, EKS deployment with kubectl, Alembic migration job, Slack notification, Git release tags.

### Infrastructure

- `hmis-infra/terraform/` - AWS infrastructure (EKS, ECR, RDS, ElastiCache)
- `hmis-infra/kubernetes/` - K8s base manifests + monitoring (ServiceMonitor)
- `k8s/` - Standalone K8s manifests (deployments, HPA, StatefulSets, backup CronJob)

### Fiscal Compliance

For Latin American markets, the billing module includes:
- NCFE (Comprobantes Fiscales Electronicos) for Dominican Republic
- DGII reports (607, 608, 609)
- Electronic invoicing with XML signatures
- Tax calculations per jurisdiction
