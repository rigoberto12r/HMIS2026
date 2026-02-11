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

## Architecture

### Multi-Tenancy Pattern

The system uses **schema-per-tenant** isolation in PostgreSQL:

- Each hospital/clinic gets a separate schema (e.g., `tenant_hospital_a`, `tenant_hospital_b`)
- The `TenantMiddleware` (hmis-backend/app/core/middleware.py) extracts tenant from:
  - `X-Tenant-ID` header
  - Subdomain (if `TENANT_SUBDOMAIN_ENABLED=true`)
- Database sessions automatically set `search_path` to the tenant schema via `current_tenant` ContextVar
- All models inherit from `BaseEntity` which includes UUID PKs, soft deletes, timestamps, and audit fields

**Key files**:
- hmis-backend/app/core/database.py - Database setup with `current_tenant` ContextVar
- hmis-backend/app/core/middleware.py - Tenant extraction and context setting
- hmis-backend/app/shared/base_models.py - Reusable model mixins

### Backend Module Structure

Each module follows a consistent pattern:

```
app/modules/{module_name}/
  ├── models.py       # SQLAlchemy models (inherit from BaseEntity)
  ├── schemas.py      # Pydantic schemas for request/response validation
  ├── routes.py       # FastAPI router with endpoint definitions
  └── service.py      # Business logic (optional, for complex modules)
```

**Modules**:
- `auth` - Authentication, JWT tokens, user management
- `patients` - Patient registry, demographics
- `appointments` - Scheduling, check-in/out
- `emr` - Electronic Medical Records (encounters, diagnoses, orders, clinical notes)
- `billing` - Invoicing, payments, insurance claims, fiscal compliance
- `pharmacy` - Prescriptions, dispensation, inventory management
- `admin` - Tenant management, system configuration
- `fhir` - FHIR R4 interoperability API (Patient, Encounter, Condition, Observation)
- `ccda` - C-CDA R2.1 export for clinical document exchange (CCD generation)

**Shared utilities**:
- `app/core/` - Configuration, database, cache, security, middleware, metrics, rate limiting
- `app/shared/` - Base models, event system, common schemas
- `app/integrations/` - External service integrations

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
  │   ├── ui/                 # Reusable UI components (buttons, inputs, etc.)
  │   └── clinical/           # Domain-specific components
  └── lib/
      └── api.ts              # API client with auth, tenant headers, token refresh
```

**State management**:
- `@tanstack/react-query` for server state (fetching, caching)
- `zustand` for global client state (user session, UI state)

**API client** (src/lib/api.ts):
- Automatically adds `Authorization: Bearer {token}` header
- Automatically adds `X-Tenant-ID` header from localStorage
- Handles 401 responses with token refresh
- Type-safe wrapper around fetch

### Testing Strategy

**Backend**:
- Tests use SQLite in-memory database (hmis-backend/tests/conftest.py)
- Redis is mocked with AsyncMock
- FastAPI lifespan is replaced with no-op for tests
- Fixtures provide: `db_session`, `client`, `auth_token`, `test_user`, `test_tenant`

**Frontend**:
- No test setup currently (ready for Jest/Vitest + React Testing Library)

### Authentication Flow

1. User logs in via `/api/v1/auth/login` (POST email/password)
2. Backend returns `access_token` (30min) + `refresh_token` (7 days)
3. Frontend stores in localStorage: `hmis_access_token`, `hmis_refresh_token`, `hmis_tenant_id`
4. All API requests include `Authorization: Bearer {access_token}` + `X-Tenant-ID: {tenant_id}`
5. On 401, frontend calls `/api/v1/auth/refresh` with refresh token, gets new access token
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
{
  "id": "uuid",
  "field": "value",
  ...
}
```

**List** (200):
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

**Error** (4xx/5xx):
```json
{
  "detail": "Error message"
}
```

### Environment Variables

Critical variables (see .env.example):
- `SECRET_KEY`, `JWT_SECRET_KEY` - Must be changed in production
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ENVIRONMENT` - `development` | `staging` | `production`
- `CORS_ORIGINS` - Comma-separated allowed origins for CORS
- `TENANT_HEADER` - Header name for tenant ID (default: `X-Tenant-ID`)

### Deployment

See DEPLOYMENT.md for detailed instructions.

**Quick local start**:
```bash
docker compose up -d
docker compose exec backend alembic upgrade head
docker compose exec backend python -m scripts.seed_data
# Access: http://localhost:3000 (frontend), http://localhost:8000/api/docs (API docs)
# Default admin: admin@hmis.app / Admin2026!
```

### Health Checks

- `/health` - Basic health check
- `/health/live` - Liveness probe (process alive)
- `/health/ready` - Readiness probe (DB + Redis connected)
- `/metrics` - Prometheus metrics

### Rate Limiting

Applied via `RateLimitMiddleware` using Redis:
- General endpoints: 100 req/min
- Login endpoint: 5 req/min
- Configurable via `RATE_LIMIT_*` env vars

### Fiscal Compliance

For Latin American markets, the billing module includes:
- NCFE (Comprobantes Fiscales Electronicos) for Dominican Republic
- Electronic invoicing with XML signatures
- Tax calculations per jurisdiction
