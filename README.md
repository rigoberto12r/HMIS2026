# HMIS SaaS - Hospital Management Information System

Cloud-native hospital management platform designed for Latin America.

## Stack

- **Backend**: Python 3.12+ (FastAPI + Django ORM)
- **Frontend**: Next.js 14+ (React, TypeScript, Tailwind CSS)
- **Database**: PostgreSQL 16+ (multi-schema tenancy)
- **Cache**: Redis 7+
- **Search**: Meilisearch
- **Infrastructure**: Docker, Kubernetes, Terraform

## Project Structure

```
HMIS2026/
├── hmis-backend/       # FastAPI + Django backend
├── hmis-frontend/      # Next.js frontend
├── hmis-infra/         # Infrastructure as Code
└── docs/               # Documentation
```

## Quick Start

### Backend

```bash
cd hmis-backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd hmis-frontend
npm install
npm run dev
```

### Docker (Full Stack)

```bash
docker compose up -d
```

## MVP Modules

1. **Patient Management & Scheduling** - Patient registry, appointments, check-in
2. **Electronic Medical Records (EMR)** - Clinical notes, diagnoses, orders
3. **Billing & Insurance** - Invoicing, fiscal compliance, insurance claims
4. **Pharmacy & Inventory** - Prescriptions, dispensation, stock management

## Target Markets

- Dominican Republic, Colombia, Mexico, Chile, Peru

## License

Proprietary - All rights reserved
