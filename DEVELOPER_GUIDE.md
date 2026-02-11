# HMIS SaaS - Developer Guide

**Version:** 1.0.0
**Last Updated:** February 7, 2026
**Document Type:** Developer Onboarding & Contribution Guide

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Code Organization](#code-organization)
4. [Development Workflow](#development-workflow)
5. [Backend Development](#backend-development)
6. [Frontend Development](#frontend-development)
7. [Testing](#testing)
8. [Security Best Practices](#security-best-practices)
9. [Performance Optimization](#performance-optimization)
10. [Contributing](#contributing)

---

## Getting Started

### Prerequisites

**Required Software:**
- Git 2.40+
- Docker 24.0+ & Docker Compose 2.20+
- Python 3.11+ (for local backend development)
- Node.js 18 LTS+ (for local frontend development)
- PostgreSQL 16+ (if running without Docker)
- Redis 7+ (if running without Docker)

**Recommended Tools:**
- VS Code or PyCharm
- Postman or Insomnia (API testing)
- pgAdmin or DBeaver (database management)
- Redis Commander (Redis management)

### Clone Repository

```bash
git clone https://github.com/yourhospital/hmis-saas.git
cd hmis-saas
```

### Install Dependencies

**Backend:**

```bash
cd hmis-backend
python3.11 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies
```

**Frontend:**

```bash
cd hmis-frontend
npm install
```

### Environment Setup

**Copy environment files:**

```bash
cp .env.example .env
cd hmis-backend && cp .env.example .env
cd ../hmis-frontend && cp .env.example .env.local
```

**Configure .env:**

Edit `.env` in project root with your local settings. See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for details.

### First Run

**With Docker Compose (Recommended):**

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Run migrations
docker compose exec backend alembic upgrade head

# Create test data
docker compose exec backend python scripts/seed_demo_data.py
```

**Without Docker:**

```bash
# Terminal 1: Backend
cd hmis-backend
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd hmis-frontend
npm run dev

# Terminal 3: PostgreSQL (if not installed)
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=hmis \
  -e POSTGRES_USER=hmis_admin \
  -e POSTGRES_PASSWORD=password \
  postgres:16-alpine

# Terminal 4: Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### Access Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/api/docs
- **API ReDoc:** http://localhost:8000/api/redoc

### Default Login

```
Email: admin@hospital.com
Password: admin123  # Change in production!
```

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  Web Browser  │  │ Mobile App   │  │  Patient Portal │ │
│  └───────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
└──────────┼──────────────────┼──────────────────┼──────────┘
           │                  │                   │
           └──────────────────┼───────────────────┘
                              │
┌──────────────────────────────┼──────────────────────────────┐
│                    Presentation Layer                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Next.js 14 App (SSR + Client-Side Routing)             ││
│  │  - React 18 Components                                   ││
│  │  - Tailwind CSS Styling                                  ││
│  │  - Zustand State Management                              ││
│  │  - React Query (Data Fetching)                           ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────┼──────────────────────────────┘
                               │
                          HTTP/REST API
                               │
┌──────────────────────────────┼──────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  FastAPI Backend (Async Python)                          ││
│  │  ┌────────────┐ ┌──────────┐ ┌────────────────────────┐││
│  │  │ Middleware │ │  Routes  │ │  Services              │││
│  │  ├────────────┤ ├──────────┤ ├────────────────────────┤││
│  │  │ • Auth     │ │ • Auth   │ │ • Business Logic       │││
│  │  │ • Tenant   │ │ • Patients│ │ • Validation           │││
│  │  │ • Audit    │ │ • EMR    │ │ • External API Calls   │││
│  │  │ • Rate     │ │ • Billing│ │ • Background Tasks     │││
│  │  │   Limit    │ │ • Pharmacy│ │ • Email Notifications │││
│  │  └────────────┘ └──────────┘ └────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────┼──────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────┐
│                        Data Layer                            │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ PostgreSQL   │  │   Redis    │  │    Meilisearch     │  │
│  │ (Primary DB) │  │   (Cache)  │  │  (Full-text Search)│  │
│  │ • Multi-Schema│  │ • Sessions │  │ • Patient Search   │  │
│  │ • JSONB       │  │ • Rate Lmt │  │ • Medication Search│  │
│  └──────────────┘  └────────────┘  └────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MinIO / S3 (Object Storage)                         │   │
│  │  • Medical Images  • PDFs  • Reports                 │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   External Services                           │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Stripe   │  │  SendGrid   │  │      Sentry         │   │
│  │ (Payments) │  │   (Email)   │  │  (Monitoring/Errors)│   │
│  └────────────┘  └─────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- **Framework:** FastAPI 0.109+ (async Python)
- **ORM:** SQLAlchemy 2.0+ (async)
- **Migrations:** Alembic 1.13+
- **Validation:** Pydantic 2.6+
- **Authentication:** python-jose (JWT)
- **Password Hashing:** passlib with argon2
- **Cache:** redis-py 5.0+
- **Search:** meilisearch-python 0.31+
- **Background Jobs:** APScheduler 3.10+
- **HTTP Client:** httpx 0.26+
- **Payments:** stripe 7.0+
- **Email:** sendgrid 6.11+
- **PDF Generation:** reportlab 4.1+
- **Excel Export:** openpyxl 3.1+
- **Monitoring:** sentry-sdk 1.40+

**Frontend:**
- **Framework:** Next.js 14.1+ (App Router)
- **UI Library:** React 18.2+
- **Language:** TypeScript 5.3+
- **Styling:** Tailwind CSS 3.4+
- **State Management:** Zustand 4.4+
- **Data Fetching:** TanStack Query 5.17+
- **Forms:** React Hook Form 7.49+ with Zod validation
- **Charts:** Recharts 2.10+
- **Payments:** @stripe/react-stripe-js 2.4+
- **Icons:** Lucide React 0.309+
- **Testing:** Jest 29.7+ with React Testing Library 14.3+

**Database:**
- **Primary:** PostgreSQL 16
- **Extensions:** pg_trgm (fuzzy search), uuid-ossp, pgcrypto

**Infrastructure:**
- **Containerization:** Docker, Docker Compose
- **Orchestration:** Kubernetes (optional)
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus, Grafana
- **Logging:** Structured JSON logging

---

## Code Organization

### Backend Structure

```
hmis-backend/
├── alembic/                    # Database migrations
│   ├── versions/               # Migration files
│   └── env.py                  # Migration environment
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── core/                   # Core functionality
│   │   ├── config.py           # Configuration settings
│   │   ├── security.py         # JWT, password hashing
│   │   ├── database.py         # DB connection, session management
│   │   ├── cache.py            # Redis connection
│   │   ├── logging.py          # Structured logging
│   │   ├── middleware.py       # Custom middleware
│   │   ├── metrics.py          # Prometheus metrics
│   │   └── rate_limit.py       # Rate limiting
│   ├── modules/                # Feature modules
│   │   ├── auth/               # Authentication & authorization
│   │   │   ├── models.py       # User, Role models
│   │   │   ├── schemas.py      # Pydantic schemas
│   │   │   ├── routes.py       # API routes
│   │   │   ├── service.py      # Business logic
│   │   │   └── dependencies.py # Auth dependencies
│   │   ├── patients/           # Patient management
│   │   ├── appointments/       # Appointment scheduling
│   │   ├── emr/                # Electronic Medical Records
│   │   ├── billing/            # Billing & invoicing
│   │   ├── pharmacy/           # Pharmacy & inventory
│   │   ├── portal/             # Patient portal
│   │   ├── reports/            # Custom reporting
│   │   └── admin/              # Admin functions
│   ├── integrations/           # External integrations
│   │   ├── payments/           # Stripe integration
│   │   │   └── stripe_service.py
│   │   ├── email/              # SendGrid integration
│   │   │   └── email_service.py
│   │   ├── pdf/                # PDF generation
│   │   │   └── invoice_generator.py
│   │   └── fiscal/             # Fiscal compliance (DGII)
│   │       └── dgii_reports.py
│   ├── shared/                 # Shared utilities
│   │   ├── schemas.py          # Common schemas
│   │   └── utils.py            # Utility functions
│   └── tasks/                  # Background tasks
│       ├── __init__.py
│       └── scheduler.py        # APScheduler setup
├── tests/                      # Test suite
│   ├── conftest.py             # Pytest configuration
│   ├── test_auth.py
│   ├── test_patients.py
│   └── ...
├── scripts/                    # Utility scripts
│   ├── create_admin.py
│   └── seed_demo_data.py
├── requirements.txt            # Production dependencies
├── requirements-dev.txt        # Development dependencies
├── alembic.ini                 # Alembic configuration
└── pyproject.toml              # Project metadata
```

### Frontend Structure

```
hmis-frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Main application routes
│   │   │   ├── dashboard/
│   │   │   ├── patients/
│   │   │   ├── appointments/
│   │   │   ├── emr/
│   │   │   ├── billing/
│   │   │   ├── pharmacy/
│   │   │   ├── reports/
│   │   │   └── layout.tsx      # Main app layout
│   │   ├── auth/               # Authentication pages
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   ├── portal/             # Patient portal
│   │   │   ├── dashboard/
│   │   │   ├── appointments/
│   │   │   └── layout.tsx
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── ui/                 # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── ...
│   │   ├── forms/              # Form components
│   │   │   ├── PatientForm.tsx
│   │   │   └── ...
│   │   ├── layouts/            # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── ...
│   │   └── ErrorBoundary.tsx   # Error boundary
│   ├── lib/                    # Utilities
│   │   ├── api.ts              # API client
│   │   ├── auth.ts             # Auth utilities
│   │   └── utils.ts            # Helper functions
│   ├── stores/                 # Zustand stores
│   │   ├── authStore.ts        # Authentication state
│   │   └── patientStore.ts     # Patient state
│   ├── types/                  # TypeScript types
│   │   ├── api.ts              # API types
│   │   └── models.ts           # Domain models
│   └── hooks/                  # Custom React hooks
│       ├── useAuth.ts
│       └── usePatients.ts
├── public/                     # Static assets
│   ├── images/
│   └── favicon.ico
├── __tests__/                  # Tests
│   ├── components/
│   └── pages/
├── package.json
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── next.config.js              # Next.js configuration
└── jest.config.js              # Jest configuration
```

### Module Organization

Each backend module follows this pattern:

```
module_name/
├── __init__.py
├── models.py          # SQLAlchemy models
├── schemas.py         # Pydantic request/response schemas
├── routes.py          # FastAPI route handlers
├── service.py         # Business logic layer
└── dependencies.py    # Module-specific dependencies (optional)
```

**Separation of Concerns:**
- **models.py**: Database schema (SQLAlchemy ORM)
- **schemas.py**: API contracts (Pydantic validation)
- **routes.py**: HTTP endpoint handlers (thin layer)
- **service.py**: Business logic, database queries
- **dependencies.py**: Dependency injection helpers

---

## Development Workflow

### Git Workflow

**Branching Strategy:**

```
main              # Production-ready code
├── develop       # Integration branch
├── feature/*     # New features
├── bugfix/*      # Bug fixes
├── hotfix/*      # Production hotfixes
└── release/*     # Release preparation
```

**Creating a Feature Branch:**

```bash
# Pull latest changes
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/patient-allergies-ui

# Make changes and commit
git add .
git commit -m "feat: add patient allergies management UI"

# Push to remote
git push origin feature/patient-allergies-ui

# Create pull request on GitHub
```

### Commit Message Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process, tooling changes

**Examples:**

```bash
git commit -m "feat(patients): add insurance management"
git commit -m "fix(billing): correct tax calculation for ITBIS"
git commit -m "docs(api): update authentication endpoints"
git commit -m "refactor(emr): simplify diagnosis creation logic"
git commit -m "test(pharmacy): add dispensation service tests"
```

### Running Tests

**Backend (pytest):**

```bash
cd hmis-backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_patients.py

# Run tests matching pattern
pytest -k "test_create_patient"

# Run in watch mode
pytest-watch
```

**Frontend (Jest + RTL):**

```bash
cd hmis-frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- PatientForm.test.tsx
```

### Code Style

**Backend (Python):**

```bash
# Format code with Black
black app/ tests/

# Sort imports with isort
isort app/ tests/

# Lint with flake8
flake8 app/ tests/

# Type check with mypy
mypy app/

# Run all checks
black . && isort . && flake8 && mypy app
```

**Configuration (.flake8):**
```ini
[flake8]
max-line-length = 100
exclude = .git,__pycache__,.venv,alembic
ignore = E203, W503
```

**Frontend (ESLint + Prettier):**

```bash
# Lint
npm run lint

# Format
npm run format

# Fix auto-fixable issues
npm run lint -- --fix
```

### Pull Request Process

1. **Create PR on GitHub** with descriptive title and description
2. **Link related issues** using "Closes #123" in description
3. **Ensure CI passes** (tests, linting, type checks)
4. **Request review** from team members
5. **Address feedback** and push updates
6. **Squash and merge** once approved

**PR Template:**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
```

---

## Backend Development

### Creating a New Module

**Example: Creating a "Labs" module**

**1. Create module directory:**

```bash
mkdir -p hmis-backend/app/modules/labs
touch hmis-backend/app/modules/labs/{__init__.py,models.py,schemas.py,routes.py,service.py}
```

**2. Define models (models.py):**

```python
from sqlalchemy import Column, String, ForeignKey, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base

class LabOrder(Base):
    __tablename__ = "lab_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    encounter_id = Column(UUID(as_uuid=True), ForeignKey("encounters.id"))
    test_code = Column(String(50), nullable=False)
    test_name = Column(String(200), nullable=False)
    status = Column(String(50), default="pending")  # pending, collected, in_progress, completed
    ordered_at = Column(TIMESTAMP(timezone=True), nullable=False)
    ordered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    patient = relationship("Patient", back_populates="lab_orders")
    results = relationship("LabResult", back_populates="order", cascade="all, delete-orphan")

class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("lab_orders.id"), nullable=False)
    parameter_name = Column(String(200), nullable=False)
    value = Column(String(200))
    unit = Column(String(50))
    reference_range = Column(String(200))
    is_abnormal = Column(Boolean, default=False)
    notes = Column(Text)

    # Relationships
    order = relationship("LabOrder", back_populates="results")
```

**3. Define schemas (schemas.py):**

```python
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class LabOrderCreate(BaseModel):
    patient_id: uuid.UUID
    encounter_id: uuid.UUID | None = None
    test_code: str = Field(..., max_length=50)
    test_name: str = Field(..., max_length=200)

class LabOrderResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    test_code: str
    test_name: str
    status: str
    ordered_at: datetime
    ordered_by: uuid.UUID

    model_config = {"from_attributes": True}

class LabResultCreate(BaseModel):
    order_id: uuid.UUID
    parameter_name: str
    value: str
    unit: str | None = None
    reference_range: str | None = None
    is_abnormal: bool = False
    notes: str | None = None
```

**4. Implement service (service.py):**

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from datetime import datetime, timezone

from .models import LabOrder, LabResult
from .schemas import LabOrderCreate, LabResultCreate

class LabService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_order(
        self, data: LabOrderCreate, ordered_by: uuid.UUID
    ) -> LabOrder:
        order = LabOrder(
            **data.model_dump(),
            ordered_at=datetime.now(timezone.utc),
            ordered_by=ordered_by
        )
        self.db.add(order)
        await self.db.flush()
        await self.db.refresh(order)
        return order

    async def get_order(self, order_id: uuid.UUID) -> LabOrder | None:
        stmt = select(LabOrder).where(LabOrder.id == order_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def add_result(
        self, data: LabResultCreate
    ) -> LabResult:
        result = LabResult(**data.model_dump())
        self.db.add(result)
        await self.db.flush()

        # Update order status
        order = await self.get_order(data.order_id)
        if order:
            order.status = "completed"

        await self.db.refresh(result)
        return result
```

**5. Create routes (routes.py):**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_active_user, require_permissions
from app.modules.auth.models import User
from .schemas import LabOrderCreate, LabOrderResponse, LabResultCreate
from .service import LabService

router = APIRouter()

@router.post("/orders", response_model=LabOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_order(
    data: LabOrderCreate,
    current_user: User = Depends(require_permissions("labs:write")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new lab order."""
    service = LabService(db)
    order = await service.create_order(data, ordered_by=current_user.id)
    return LabOrderResponse.model_validate(order)

@router.get("/orders/{order_id}", response_model=LabOrderResponse)
async def get_lab_order(
    order_id: uuid.UUID,
    current_user: User = Depends(require_permissions("labs:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get lab order by ID."""
    service = LabService(db)
    order = await service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return LabOrderResponse.model_validate(order)
```

**6. Register routes in main.py:**

```python
from app.modules.labs.routes import router as labs_router

app.include_router(labs_router, prefix="/api/v1/labs", tags=["Laboratory"])
```

**7. Create migration:**

```bash
cd hmis-backend
alembic revision --autogenerate -m "Add labs module"
alembic upgrade head
```

### Database Migrations

**Creating a Migration:**

```bash
# Auto-generate from model changes
alembic revision --autogenerate -m "Description of change"

# Create empty migration
alembic revision -m "Description of change"
```

**Migration File Structure:**

```python
"""Add labs module

Revision ID: abc123
Revises: xyz789
Create Date: 2026-02-07 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'abc123'
down_revision = 'xyz789'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('lab_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('test_code', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('lab_orders')
```

**Running Migrations:**

```bash
# Upgrade to latest
alembic upgrade head

# Downgrade one version
alembic downgrade -1

# View current version
alembic current

# View history
alembic history
```

### Writing Tests

**Test Structure (tests/test_labs.py):**

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_create_lab_order(
    client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
    test_patient: dict
):
    """Test creating a lab order."""
    response = await client.post(
        "/api/v1/labs/orders",
        headers=auth_headers,
        json={
            "patient_id": test_patient["id"],
            "test_code": "CBC",
            "test_name": "Complete Blood Count"
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["test_code"] == "CBC"
    assert data["status"] == "pending"

@pytest.mark.asyncio
async def test_get_lab_order(
    client: AsyncClient,
    auth_headers: dict,
    test_lab_order: dict
):
    """Test retrieving a lab order."""
    response = await client.get(
        f"/api/v1/labs/orders/{test_lab_order['id']}",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_lab_order["id"]
```

---

## Frontend Development

### Creating a New Page

**Example: Creating a Lab Results page**

**1. Create page file:**

```bash
mkdir -p hmis-frontend/src/app/(app)/labs
touch hmis-frontend/src/app/(app)/labs/page.tsx
```

**2. Implement page (page.tsx):**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { LabOrderList } from '@/components/labs/LabOrderList';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

export default function LabsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['labOrders'],
    queryFn: () => api.get('/labs/orders').then(res => res.data)
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading lab orders</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Lab Orders</h1>
        <Button onClick={() => {/* open create modal */}}>
          Create Order
        </Button>
      </div>

      <LabOrderList orders={data.items} />
    </div>
  );
}
```

### Creating Components

**Component file (components/labs/LabOrderList.tsx):**

```tsx
import { LabOrder } from '@/types/models';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface LabOrderListProps {
  orders: LabOrder[];
}

export function LabOrderList({ orders }: LabOrderListProps) {
  return (
    <div className="space-y-4">
      {orders.map(order => (
        <Card key={order.id} className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{order.test_name}</h3>
              <p className="text-sm text-gray-600">{order.test_code}</p>
            </div>
            <Badge variant={getStatusVariant(order.status)}>
              {order.status}
            </Badge>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Ordered: {new Date(order.ordered_at).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
  );
}

function getStatusVariant(status: string) {
  const variants = {
    pending: 'yellow',
    collected: 'blue',
    in_progress: 'blue',
    completed: 'green'
  };
  return variants[status as keyof typeof variants] || 'gray';
}
```

### State Management (Zustand)

**Create store (stores/labStore.ts):**

```typescript
import { create } from 'zustand';
import { LabOrder } from '@/types/models';

interface LabStore {
  orders: LabOrder[];
  selectedOrder: LabOrder | null;
  setOrders: (orders: LabOrder[]) => void;
  selectOrder: (order: LabOrder) => void;
  clearSelection: () => void;
}

export const useLabStore = create<LabStore>((set) => ({
  orders: [],
  selectedOrder: null,
  setOrders: (orders) => set({ orders }),
  selectOrder: (order) => set({ selectedOrder: order }),
  clearSelection: () => set({ selectedOrder: null })
}));
```

**Use in component:**

```tsx
'use client';

import { useLabStore } from '@/stores/labStore';

export function LabOrderDetail() {
  const { selectedOrder, clearSelection } = useLabStore();

  if (!selectedOrder) return null;

  return (
    <Modal onClose={clearSelection}>
      <h2>{selectedOrder.test_name}</h2>
      {/* Order details */}
    </Modal>
  );
}
```

### Forms with React Hook Form

**Form component (components/forms/LabOrderForm.tsx):**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

const schema = z.object({
  patient_id: z.string().uuid(),
  test_code: z.string().min(1, 'Test code is required'),
  test_name: z.string().min(1, 'Test name is required')
});

type FormData = z.infer<typeof schema>;

export function LabOrderForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/labs/orders', data),
    onSuccess: () => {
      onSuccess();
      // Invalidate queries, show toast, etc.
    }
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="test_code">Test Code</label>
        <input
          {...register('test_code')}
          className="w-full border rounded px-3 py-2"
        />
        {errors.test_code && (
          <p className="text-red-500 text-sm">{errors.test_code.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="test_name">Test Name</label>
        <input
          {...register('test_name')}
          className="w-full border rounded px-3 py-2"
        />
        {errors.test_name && (
          <p className="text-red-500 text-sm">{errors.test_name.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {mutation.isPending ? 'Creating...' : 'Create Order'}
      </button>
    </form>
  );
}
```

### Testing Components

**Component test (__tests__/components/LabOrderList.test.tsx):**

```tsx
import { render, screen } from '@testing-library/react';
import { LabOrderList } from '@/components/labs/LabOrderList';

describe('LabOrderList', () => {
  const mockOrders = [
    {
      id: '123',
      test_code: 'CBC',
      test_name: 'Complete Blood Count',
      status: 'pending',
      ordered_at: '2026-02-07T10:00:00Z'
    }
  ];

  it('renders lab orders', () => {
    render(<LabOrderList orders={mockOrders} />);

    expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    expect(screen.getByText('CBC')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('displays empty state when no orders', () => {
    render(<LabOrderList orders={[]} />);

    expect(screen.queryByText('Complete Blood Count')).not.toBeInTheDocument();
  });
});
```

---

## Testing

### Backend Testing Strategy

**Test Pyramid:**
- Unit Tests (70%): Test individual functions/classes
- Integration Tests (20%): Test API endpoints
- E2E Tests (10%): Test full workflows

**Test Fixtures (conftest.py):**

```python
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token

# Test database URL
TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5432/hmis_test"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(engine):
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers():
    token = create_access_token(
        data={"sub": "test@example.com", "tenant_id": "test_tenant"}
    )
    return {"Authorization": f"Bearer {token}"}
```

### Frontend Testing Strategy

**Unit Tests:**
- Test individual components in isolation
- Mock external dependencies
- Focus on component logic and rendering

**Integration Tests:**
- Test component interactions
- Test form submissions
- Test state management

**Setup (jest.config.js):**

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}'
  ]
};
```

---

## Security Best Practices

### Input Validation

**Always validate user input:**

```python
# Backend: Use Pydantic schemas
from pydantic import BaseModel, Field, EmailStr, field_validator

class UserCreate(BaseModel):
    email: EmailStr  # Validates email format
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(max_length=100)

    @field_validator('password')
    def password_strength(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain digit')
        return v
```

```tsx
// Frontend: Use Zod schemas
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain digit')
});
```

### SQL Injection Prevention

**Always use parameterized queries:**

```python
# Good ✓ - SQLAlchemy with parameters
stmt = select(Patient).where(Patient.id == patient_id)
result = await db.execute(stmt)

# Bad ✗ - String concatenation
query = f"SELECT * FROM patients WHERE id = '{patient_id}'"  # NEVER DO THIS!
```

### XSS Prevention

**Frontend automatically escapes by default:**

```tsx
// React automatically escapes
<div>{userInput}</div>  // Safe

// Manual HTML requires sanitization
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
```

### Authentication Best Practices

```python
# Use secure password hashing
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### Environment Variables

**Never commit secrets:**

```python
# Use environment variables
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    secret_key: str
    database_url: str
    stripe_secret_key: str

    class Config:
        env_file = ".env"
```

---

## Performance Optimization

### Database Query Optimization

**Use select_related/joinedload:**

```python
# Eager loading to avoid N+1 queries
from sqlalchemy.orm import selectinload

stmt = (
    select(Patient)
    .options(selectinload(Patient.insurances))
    .where(Patient.id == patient_id)
)
```

**Add database indexes:**

```python
# In migration
op.create_index('idx_patients_mrn', 'patients', ['mrn'])
op.create_index('idx_patients_document', 'patients', ['document_number'])
```

### Caching

**Use Redis for expensive queries:**

```python
from app.core.cache import redis_client
import json

async def get_patient_with_cache(patient_id: str):
    # Try cache first
    cache_key = f"patient:{patient_id}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Query database
    patient = await service.get_patient(patient_id)

    # Store in cache (5 minutes)
    await redis_client.setex(
        cache_key,
        300,
        json.dumps(patient, default=str)
    )

    return patient
```

### Frontend Optimization

**Code splitting:**

```tsx
// Lazy load components
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

**Memoization:**

```tsx
import { useMemo, useCallback } from 'react';

function PatientList({ patients }) {
  // Memoize expensive calculations
  const sortedPatients = useMemo(
    () => patients.sort((a, b) => a.name.localeCompare(b.name)),
    [patients]
  );

  // Memoize callbacks
  const handleClick = useCallback((id) => {
    // Handle click
  }, []);

  return (
    <div>
      {sortedPatients.map(patient => (
        <PatientCard key={patient.id} onClick={handleClick} />
      ))}
    </div>
  );
}
```

---

## Contributing

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on what is best for the project

### How to Report Bugs

1. Check existing issues first
2. Create new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, browser, versions)
   - Screenshots if applicable

### Feature Requests

1. Open issue with "Feature Request" label
2. Describe the problem it solves
3. Propose solution (if any)
4. Discuss with maintainers before implementing

### Development Setup for Contributors

See [Getting Started](#getting-started) section above.

### Documentation

- Update documentation alongside code changes
- Add JSDoc comments for functions
- Update API documentation for endpoint changes
- Add inline comments for complex logic

---

**End of Developer Guide**

For deployment information, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
For API reference, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
For user guide, see [USER_MANUAL.md](./USER_MANUAL.md)
