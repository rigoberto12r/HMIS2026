# HMIS SaaS - Deployment Guide

**Version:** 1.0.0
**Last Updated:** February 7, 2026
**Document Type:** Operations & Deployment

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Architecture Overview](#architecture-overview)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment](#production-deployment)
5. [Database Migrations](#database-migrations)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Disaster Recovery](#backup--disaster-recovery)
9. [Scaling](#scaling)
10. [Security Hardening](#security-hardening)
11. [Maintenance](#maintenance)

---

## System Requirements

### Hardware Requirements

**Minimum (Small Clinic - up to 50 users):**
- CPU: 2 cores (2.0 GHz)
- RAM: 4 GB
- Storage: 50 GB SSD
- Network: 10 Mbps

**Recommended (Medium Hospital - up to 500 users):**
- CPU: 4 cores (2.5 GHz)
- RAM: 16 GB
- Storage: 200 GB SSD
- Network: 100 Mbps

**Enterprise (Large Hospital - 500+ users):**
- CPU: 8+ cores (3.0 GHz)
- RAM: 32+ GB
- Storage: 500+ GB SSD (or distributed storage)
- Network: 1 Gbps

### Software Requirements

**Operating System:**
- Linux (Ubuntu 22.04 LTS recommended)
- Windows Server 2019+ (supported)
- macOS (development only)

**Container Runtime (Recommended):**
- Docker 24.0+
- Docker Compose 2.20+
- OR Kubernetes 1.28+

**Without Containers:**
- Python 3.11+
- Node.js 18 LTS+
- PostgreSQL 16+
- Redis 7+

**Additional Services:**
- Meilisearch 1.6+ (full-text search)
- MinIO or S3-compatible storage (file storage)

### Network Requirements

**Ports to Open:**
- 80 (HTTP - redirect to HTTPS)
- 443 (HTTPS - main application)
- 5432 (PostgreSQL - internal only)
- 6379 (Redis - internal only)
- 7700 (Meilisearch - internal only)
- 9000 (MinIO - internal only)

**Firewall Rules:**
- Allow inbound 80, 443 from internet
- Restrict database ports to application servers only
- Allow outbound HTTPS for external API calls (Stripe, SendGrid)

---

## Architecture Overview

### Multi-Tenant SaaS Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Device]
    end

    subgraph "Load Balancer Layer"
        LB[Nginx/Load Balancer]
        SSL[SSL Termination]
    end

    subgraph "Application Layer"
        FE1[Frontend - Next.js]
        FE2[Frontend - Next.js]
        BE1[Backend - FastAPI]
        BE2[Backend - FastAPI]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Multi-Schema)]
        Redis[(Redis Cache)]
        Meili[(Meilisearch)]
        S3[(Object Storage)]
    end

    subgraph "External Services"
        Stripe[Stripe Payments]
        SendGrid[SendGrid Email]
        Sentry[Sentry Monitoring]
    end

    Browser --> LB
    Mobile --> LB
    LB --> SSL
    SSL --> FE1
    SSL --> FE2
    FE1 --> BE1
    FE2 --> BE2
    BE1 --> PG
    BE1 --> Redis
    BE1 --> Meili
    BE1 --> S3
    BE2 --> PG
    BE2 --> Redis
    BE2 --> Meili
    BE2 --> S3
    BE1 --> Stripe
    BE1 --> SendGrid
    BE1 --> Sentry
```

### Component Descriptions

**Frontend (Next.js 14):**
- Server-side rendering (SSR)
- Static generation for public pages
- Client-side routing
- State management with Zustand
- Responsive UI with Tailwind CSS

**Backend (FastAPI):**
- RESTful API
- Async Python with asyncio
- JWT authentication
- Multi-tenant middleware
- Rate limiting
- Audit logging

**Database (PostgreSQL):**
- Schema-per-tenant for data isolation
- Shared public schema for system tables
- Full-text search with pg_trgm
- JSONB for flexible metadata
- Row-level security (RLS)

**Cache (Redis):**
- Session storage
- Rate limit counters
- Cached query results
- Real-time pub/sub
- Background job queue

**Search (Meilisearch):**
- Fast full-text search for patients, medications
- Typo-tolerant
- Faceted search
- Automatic indexing

**Storage (MinIO/S3):**
- Medical images
- PDF documents
- Report exports
- Invoice PDFs

---

## Local Development Setup

### Prerequisites Installation

**Install Docker & Docker Compose:**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# macOS (via Homebrew)
brew install --cask docker

# Windows
# Download Docker Desktop from https://www.docker.com/products/docker-desktop
```

**Verify Installation:**

```bash
docker --version  # Should show 24.0+
docker compose version  # Should show 2.20+
```

### Clone Repository

```bash
git clone https://github.com/yourhospital/hmis-saas.git
cd hmis-saas
```

### Environment Configuration

**Copy example environment file:**

```bash
cp .env.example .env
```

**Edit .env file:**

```bash
# Essential variables
POSTGRES_PASSWORD=secure_password_here
SECRET_KEY=generate_random_secret_key_here
JWT_SECRET_KEY=generate_random_jwt_key_here
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# Optional: External services (leave empty for development)
SENTRY_DSN=
STRIPE_SECRET_KEY=
SENDGRID_API_KEY=
```

**Generate Secrets:**

```bash
# Generate secure random secrets
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Use output for SECRET_KEY and JWT_SECRET_KEY
```

### Start with Docker Compose

**Start all services:**

```bash
docker compose up -d
```

**View logs:**

```bash
docker compose logs -f backend  # Backend logs
docker compose logs -f frontend  # Frontend logs
```

**Check service health:**

```bash
docker compose ps
```

Expected output:
```
NAME                STATUS
hmis-backend        Up (healthy)
hmis-frontend       Up (healthy)
hmis-postgres       Up (healthy)
hmis-redis          Up (healthy)
hmis-meilisearch    Up
hmis-minio          Up
```

### Run Database Migrations

```bash
docker compose exec backend alembic upgrade head
```

### Create Initial Admin User

```bash
docker compose exec backend python -m scripts.create_admin \
  --email admin@hospital.com \
  --password YourSecurePassword123! \
  --tenant-id demo_hospital
```

### Access the Application

- **Frontend:** http://localhost:3000
- **Backend API Docs:** http://localhost:8000/api/docs
- **Meilisearch Dashboard:** http://localhost:7700
- **MinIO Console:** http://localhost:9001

**Default Login:**
- Email: admin@hospital.com
- Password: (as set above)

### Running Without Docker

**Backend Setup:**

```bash
cd hmis-backend

# Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://hmis_admin:password@localhost:5432/hmis"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY="your-secret-key"

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Setup:**

```bash
cd hmis-frontend

# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"

# Start development server
npm run dev
```

**External Services:**

```bash
# Start PostgreSQL
docker run -d --name postgres \
  -e POSTGRES_DB=hmis \
  -e POSTGRES_USER=hmis_admin \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:16-alpine

# Start Redis
docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine

# Start Meilisearch
docker run -d --name meilisearch \
  -e MEILI_MASTER_KEY=masterKey \
  -p 7700:7700 \
  getmeili/meilisearch:v1.6

# Start MinIO
docker run -d --name minio \
  -e MINIO_ROOT_USER=minio \
  -e MINIO_ROOT_PASSWORD=minio123 \
  -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

---

## Production Deployment

### Option 1: Docker Compose (Single Server)

**Recommended for:** Small to medium deployments (up to 200 concurrent users)

**1. Prepare Production Environment:**

```bash
# Create deployment directory
sudo mkdir -p /opt/hmis
cd /opt/hmis

# Clone repository
git clone https://github.com/yourhospital/hmis-saas.git .

# Checkout stable version
git checkout v1.0.0
```

**2. Configure Production Environment:**

```bash
cp .env.example .env.prod
nano .env.prod
```

**Production .env.prod:**

```bash
# Environment
ENVIRONMENT=production

# Security - CHANGE THESE!
POSTGRES_PASSWORD=<strong-random-password>
SECRET_KEY=<generate-with-openssl-rand-base64-32>
JWT_SECRET_KEY=<generate-with-openssl-rand-base64-32>

# Database
DATABASE_URL=postgresql+asyncpg://hmis_admin:${POSTGRES_PASSWORD}@postgres:5432/hmis

# Redis
REDIS_URL=redis://redis:6379/0

# Meilisearch
MEILI_MASTER_KEY=<generate-random-key>
MEILISEARCH_URL=http://meilisearch:7700
MEILISEARCH_KEY=${MEILI_MASTER_KEY}

# MinIO
MINIO_ROOT_USER=hmis_minio
MINIO_ROOT_PASSWORD=<strong-random-password>
MINIO_ENDPOINT=http://minio:9000
MINIO_BUCKET=hmis-files

# CORS (your domain)
CORS_ORIGINS=https://hmis.yourhospital.com

# Frontend
NEXT_PUBLIC_API_URL=https://hmis.yourhospital.com/api/v1
NEXT_PUBLIC_APP_NAME=HMIS - Your Hospital Name

# External Services
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....

# Logging
LOG_LEVEL=INFO
```

**3. Use Production Docker Compose:**

```bash
docker compose -f docker-compose.prod.yml up -d
```

**docker-compose.prod.yml highlights:**

- Removes volume mounts (uses built images)
- Adds restart policies (unless-stopped)
- Enables healthchecks
- Configures resource limits
- Uses nginx reverse proxy

**4. Run Migrations:**

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

**5. Create Initial Tenant & Admin:**

```bash
docker compose -f docker-compose.prod.yml exec backend python -m scripts.setup_tenant \
  --tenant-id your_hospital \
  --name "Your Hospital Name" \
  --admin-email admin@yourhospital.com \
  --admin-password SecurePassword123!
```

### Option 2: Kubernetes (Cloud Native)

**Recommended for:** Large deployments, multi-region, high availability

**Prerequisites:**
- Kubernetes cluster (1.28+)
- kubectl configured
- Helm 3 installed
- External PostgreSQL (managed service recommended)
- External Redis (managed service recommended)

**1. Create Namespace:**

```bash
kubectl create namespace hmis-production
```

**2. Create Secrets:**

```bash
kubectl create secret generic hmis-secrets \
  --from-literal=secret-key=$(openssl rand -base64 32) \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --from-literal=postgres-password=$(openssl rand -base64 32) \
  --from-literal=stripe-secret-key=sk_live_... \
  --from-literal=sendgrid-api-key=SG.... \
  -n hmis-production
```

**3. Create ConfigMap:**

```bash
kubectl create configmap hmis-config \
  --from-literal=environment=production \
  --from-literal=database-url=postgresql+asyncpg://user:pass@db-host:5432/hmis \
  --from-literal=redis-url=redis://redis-host:6379/0 \
  --from-literal=cors-origins=https://hmis.yourhospital.com \
  -n hmis-production
```

**4. Deploy with Helm:**

```bash
helm install hmis ./hmis-infra/helm/hmis \
  --namespace hmis-production \
  --set image.repository=yourdockerhub/hmis-backend \
  --set image.tag=v1.0.0 \
  --set frontend.image.repository=yourdockerhub/hmis-frontend \
  --set frontend.image.tag=v1.0.0 \
  --set replicaCount=3 \
  --set autoscaling.enabled=true \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=hmis.yourhospital.com
```

**5. Verify Deployment:**

```bash
kubectl get pods -n hmis-production
kubectl get svc -n hmis-production
kubectl get ingress -n hmis-production
```

**6. Run Migrations (Job):**

```bash
kubectl apply -f hmis-infra/k8s/migration-job.yaml -n hmis-production
```

### Option 3: AWS Deployment

**Architecture:**
- **Compute:** ECS Fargate or EKS
- **Database:** RDS PostgreSQL (Multi-AZ)
- **Cache:** ElastiCache Redis
- **Storage:** S3
- **CDN:** CloudFront
- **Load Balancer:** ALB
- **Monitoring:** CloudWatch

**Terraform Deployment:**

```bash
cd hmis-infra/terraform/aws

# Initialize
terraform init

# Plan
terraform plan -out=tfplan

# Apply
terraform apply tfplan
```

**Variables to set (terraform.tfvars):**

```hcl
region = "us-east-1"
environment = "production"
vpc_cidr = "10.0.0.0/16"
db_instance_class = "db.t3.large"
redis_node_type = "cache.t3.medium"
ecs_task_cpu = 1024
ecs_task_memory = 2048
ecs_desired_count = 3
domain_name = "hmis.yourhospital.com"
certificate_arn = "arn:aws:acm:..."
```

### Option 4: Google Cloud Platform

**Architecture:**
- **Compute:** Cloud Run
- **Database:** Cloud SQL PostgreSQL
- **Cache:** Memorystore (Redis)
- **Storage:** Cloud Storage
- **CDN:** Cloud CDN
- **Load Balancer:** Cloud Load Balancing

**Deployment:**

```bash
# Set project
gcloud config set project your-project-id

# Deploy backend
gcloud run deploy hmis-backend \
  --source ./hmis-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="..." \
  --set-env-vars REDIS_URL="..." \
  --min-instances 1 \
  --max-instances 10

# Deploy frontend
gcloud run deploy hmis-frontend \
  --source ./hmis-frontend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL="..." \
  --min-instances 1 \
  --max-instances 10
```

### Option 5: Azure Deployment

**Architecture:**
- **Compute:** Azure Container Apps
- **Database:** Azure Database for PostgreSQL
- **Cache:** Azure Cache for Redis
- **Storage:** Azure Blob Storage
- **CDN:** Azure Front Door

**Deployment:**

```bash
# Create resource group
az group create --name hmis-rg --location eastus

# Deploy with Bicep
az deployment group create \
  --resource-group hmis-rg \
  --template-file hmis-infra/azure/main.bicep \
  --parameters environment=production \
  --parameters databasePassword=<secure-password>
```

---

## Database Migrations

### Overview

Migrations are managed using **Alembic** (Python database migration tool).

### Migration Files Location

```
hmis-backend/alembic/versions/
```

### Run Migrations

**Upgrade to latest:**

```bash
# Docker
docker compose exec backend alembic upgrade head

# Local
cd hmis-backend
alembic upgrade head
```

**Downgrade one version:**

```bash
alembic downgrade -1
```

**View current version:**

```bash
alembic current
```

**View migration history:**

```bash
alembic history
```

### Create New Migration

**Auto-generate from model changes:**

```bash
cd hmis-backend
alembic revision --autogenerate -m "Add new table for feature X"
```

**Review generated file** in `alembic/versions/` before running.

**Apply new migration:**

```bash
alembic upgrade head
```

### Migration Best Practices

1. **Always review auto-generated migrations** - Alembic may miss complex changes
2. **Test migrations on staging** before production
3. **Backup database** before running migrations in production
4. **Keep migrations small** - One logical change per migration
5. **Never edit applied migrations** - Create new migration to fix issues

---

## SSL/TLS Configuration

### Using Let's Encrypt (Free SSL)

**With Nginx Reverse Proxy:**

**1. Install Certbot:**

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

**2. Generate Certificate:**

```bash
sudo certbot --nginx -d hmis.yourhospital.com
```

**3. Auto-Renewal:**

Certbot installs cron job automatically. Verify:

```bash
sudo certbot renew --dry-run
```

**4. Nginx Configuration:**

```nginx
server {
    listen 443 ssl http2;
    server_name hmis.yourhospital.com;

    ssl_certificate /etc/letsencrypt/live/hmis.yourhospital.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hmis.yourhospital.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name hmis.yourhospital.com;
    return 301 https://$server_name$request_uri;
}
```

### Using CloudFlare (CDN + SSL)

1. Add domain to CloudFlare
2. Update nameservers at domain registrar
3. Enable "Full (Strict)" SSL mode
4. Turn on "Always Use HTTPS"
5. Configure origin server to accept CloudFlare IPs

---

## Monitoring & Logging

### Prometheus Metrics

**Exposed at:** `/metrics` endpoint

**Metrics Collected:**
- HTTP request count
- Request duration
- Active connections
- Database query count
- Redis operations
- Error rates

**Prometheus Configuration:**

```yaml
scrape_configs:
  - job_name: 'hmis-backend'
    static_configs:
      - targets: ['localhost:8000']
    scrape_interval: 15s
```

### Grafana Dashboards

**Import Pre-built Dashboard:**

1. Access Grafana
2. Import dashboard using ID: `12345` (create custom)
3. Select Prometheus data source

**Key Metrics to Monitor:**
- Request rate (requests/sec)
- Error rate (%)
- Response time (p50, p95, p99)
- Database connection pool
- Redis hit rate
- Disk usage

### Sentry Integration

**Configure in .env:**

```bash
SENTRY_DSN=https://your-key@sentry.io/project-id
ENVIRONMENT=production
```

**Features:**
- Automatic error tracking
- Performance monitoring
- Release tracking
- User context
- Breadcrumb logging

### Centralized Logging

**Using ELK Stack (Elasticsearch, Logstash, Kibana):**

**Filebeat Configuration:**

```yaml
filebeat.inputs:
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'

output.elasticsearch:
  hosts: ["elasticsearch:9200"]

setup.kibana:
  host: "kibana:5601"
```

**Using Loki + Grafana:**

```yaml
# promtail-config.yaml
clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        target_label: 'container'
```

### Application Logs

**Log Levels:**
- ERROR: Critical errors requiring immediate attention
- WARNING: Important events to investigate
- INFO: General informational messages
- DEBUG: Detailed debugging information

**Log Format (JSON):**

```json
{
  "timestamp": "2026-02-07T10:30:00Z",
  "level": "INFO",
  "logger": "hmis.app",
  "message": "Patient created successfully",
  "user_id": "uuid",
  "tenant_id": "hospital_central",
  "request_id": "req-123",
  "duration_ms": 45
}
```

**View Logs:**

```bash
# Docker Compose
docker compose logs -f backend

# Kubernetes
kubectl logs -f deployment/hmis-backend -n hmis-production

# Tail production logs
tail -f /var/log/hmis/app.log
```

---

## Backup & Disaster Recovery

### Database Backups

**Automated Daily Backups (Cron):**

```bash
# Create backup script
sudo nano /usr/local/bin/backup-hmis-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/hmis/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
PGPASSWORD="your-password" pg_dump -h localhost -U hmis_admin -d hmis \
  | gzip > "$BACKUP_DIR/hmis_$DATE.sql.gz"

# Retain only last 30 days
find $BACKUP_DIR -name "hmis_*.sql.gz" -mtime +30 -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-hmis-db.sh

# Add to crontab
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-hmis-db.sh
```

**Manual Backup:**

```bash
# Full backup
docker compose exec postgres pg_dump -U hmis_admin hmis | gzip > backup.sql.gz

# Schema only
docker compose exec postgres pg_dump -U hmis_admin --schema-only hmis > schema.sql

# Data only
docker compose exec postgres pg_dump -U hmis_admin --data-only hmis > data.sql
```

**Restore from Backup:**

```bash
# Stop backend
docker compose stop backend

# Restore
gunzip < backup.sql.gz | docker compose exec -T postgres psql -U hmis_admin hmis

# Start backend
docker compose start backend
```

### File Storage Backups

**MinIO to S3 Replication:**

```bash
# Configure mc (MinIO Client)
mc alias set local http://localhost:9000 minio minio123
mc alias set s3backup https://s3.amazonaws.com access-key secret-key

# Setup mirroring
mc mirror --watch local/hmis-files s3backup/hmis-backup
```

**Periodic Snapshot:**

```bash
# Backup MinIO data
docker compose exec minio mc mirror /data/hmis-files /backup/hmis-files-$(date +%Y%m%d)
```

### Disaster Recovery Plan

**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 24 hours

**Recovery Steps:**

1. **Spin up new infrastructure** (Terraform/Kubernetes)
2. **Restore database** from latest backup
3. **Restore file storage** from S3/MinIO backup
4. **Deploy application** (same version as failed system)
5. **Verify data integrity** (run validation queries)
6. **Update DNS** to point to new infrastructure
7. **Test critical workflows** before announcing recovery

**Backup Verification:**

```bash
# Monthly: Restore backup to staging environment
./scripts/restore-to-staging.sh /var/backups/hmis/postgres/latest.sql.gz

# Verify patient count matches
psql -h staging-db -U hmis_admin -c "SELECT COUNT(*) FROM patients;"
```

---

## Scaling

### Horizontal Scaling (Multiple Instances)

**Load Balancer Configuration (Nginx):**

```nginx
upstream backend {
    least_conn;
    server backend1:8000 max_fails=3 fail_timeout=30s;
    server backend2:8000 max_fails=3 fail_timeout=30s;
    server backend3:8000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl;

    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Kubernetes Horizontal Pod Autoscaler:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hmis-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hmis-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Database Scaling

**Read Replicas:**

```yaml
# PostgreSQL replication
# Primary: Write operations
# Replicas: Read-only queries (reports, searches)

# Connection in application:
DATABASE_WRITE_URL=postgresql+asyncpg://user:pass@primary:5432/hmis
DATABASE_READ_URL=postgresql+asyncpg://user:pass@replica:5432/hmis
```

**Connection Pooling (PgBouncer):**

```ini
[databases]
hmis = host=postgres port=5432 dbname=hmis

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

**Partitioning (For Large Tables):**

```sql
-- Partition audit_logs by month
CREATE TABLE audit_logs (
    id UUID,
    tenant_id VARCHAR,
    created_at TIMESTAMP,
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### Caching Strategy

**Multi-Level Cache:**

1. **Browser Cache:** Static assets (CSS, JS, images)
2. **CDN Cache:** CloudFront/CloudFlare
3. **Application Cache (Redis):**
   - User sessions (TTL: 30 minutes)
   - API responses (TTL: 5 minutes)
   - Search results (TTL: 10 minutes)
4. **Database Cache:** Query result cache

**Redis Cluster:**

```yaml
# redis-cluster.yml
services:
  redis-master:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  redis-replica1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379

  redis-replica2:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379
```

---

## Security Hardening

### Application Security

**1. Environment Variables:**

```bash
# Never commit secrets to Git
# Use secret management tools
# Rotate secrets regularly

# AWS Secrets Manager
aws secretsmanager create-secret \
  --name hmis/production/database \
  --secret-string '{"password":"strong-password"}'

# Kubernetes Secrets
kubectl create secret generic db-credentials \
  --from-literal=password=strong-password
```

**2. HTTPS Enforcement:**

```python
# app/core/middleware.py
class HTTPSRedirectMiddleware:
    async def __call__(self, request, call_next):
        if request.url.scheme != "https" and settings.ENVIRONMENT == "production":
            url = request.url.replace(scheme="https")
            return RedirectResponse(url, status_code=301)
        return await call_next(request)
```

**3. Security Headers:**

```python
# app/core/middleware.py
response.headers["X-Content-Type-Options"] = "nosniff"
response.headers["X-Frame-Options"] = "DENY"
response.headers["X-XSS-Protection"] = "1; mode=block"
response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
response.headers["Content-Security-Policy"] = "default-src 'self'"
```

**4. Rate Limiting:**

Already implemented in `app/core/rate_limit.py`

```python
# 100 requests per minute per IP
# 1000 requests per hour per user
```

**5. SQL Injection Prevention:**

```python
# ALWAYS use parameterized queries (already implemented with SQLAlchemy)
# NEVER construct raw SQL with string concatenation

# Good ✓
stmt = select(Patient).where(Patient.id == patient_id)

# Bad ✗
query = f"SELECT * FROM patients WHERE id = '{patient_id}'"
```

**6. XSS Prevention:**

```tsx
// Frontend already escapes by default with React
// Manual HTML: Use DOMPurify library
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(dirty);
```

### Infrastructure Security

**1. Firewall Configuration (UFW):**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH (restrict to your IP)
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

**2. SSH Hardening:**

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no  # Use SSH keys only
PubkeyAuthentication yes
Port 2222  # Non-standard port
```

**3. Database Security:**

```sql
-- Create application user with limited permissions
CREATE USER hmis_app WITH PASSWORD 'strong-password';
GRANT CONNECT ON DATABASE hmis TO hmis_app;
GRANT USAGE ON SCHEMA tenant_* TO hmis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tenant_* TO hmis_app;

-- Revoke public access
REVOKE ALL ON DATABASE hmis FROM PUBLIC;
```

**4. Container Security:**

```dockerfile
# Use non-root user
FROM python:3.11-slim
RUN useradd -m -u 1000 appuser
USER appuser

# Minimal base image
FROM python:3.11-alpine  # Smaller attack surface

# Scan for vulnerabilities
docker scan yourdockerhub/hmis-backend:v1.0.0
```

**5. Secrets Management:**

```bash
# Vault (HashiCorp)
vault kv put secret/hmis/prod \
  database_password="..." \
  stripe_key="..."

# Application retrieves at runtime
vault kv get -field=database_password secret/hmis/prod
```

### Compliance

**HIPAA Considerations:**

- ✓ Encryption at rest (PostgreSQL + disk encryption)
- ✓ Encryption in transit (TLS 1.2+)
- ✓ Audit logging (all access logged)
- ✓ Access controls (RBAC)
- ✓ Automatic logout (30 min inactivity)
- ✓ Password requirements (8+ chars, complexity)
- ✓ Data backup and recovery procedures

**PCI DSS (Payments):**

- ✓ Stripe handles card data (no card data stored in HMIS)
- ✓ Webhook signature verification
- ✓ HTTPS only
- ✓ Logging of payment events

---

## Maintenance

### Updates and Patching

**Update Docker Images:**

```bash
# Pull latest images
docker compose pull

# Recreate containers
docker compose up -d

# View changes
docker compose ps
```

**Update Application Code:**

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose build

# Apply updates (zero-downtime)
docker compose up -d --no-deps backend
```

**Security Patches:**

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Python dependencies
cd hmis-backend
pip list --outdated
pip install --upgrade package-name

# Update Node dependencies
cd hmis-frontend
npm outdated
npm update
```

### Health Checks

**Liveness Probe:**

```
GET /health/live
```

Returns 200 if process is running.

**Readiness Probe:**

```
GET /health/ready
```

Returns 200 if database and Redis are accessible.

**Kubernetes Probes:**

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Rollback Procedures

**Docker Compose:**

```bash
# Revert to previous version
git checkout v0.9.0
docker compose down
docker compose up -d
```

**Kubernetes:**

```bash
# Rollback deployment
kubectl rollout undo deployment/hmis-backend -n hmis-production

# Rollback to specific revision
kubectl rollout undo deployment/hmis-backend --to-revision=3

# Check rollout status
kubectl rollout status deployment/hmis-backend
```

### Database Maintenance

**Vacuum (Reclaim Space):**

```sql
-- Analyze and optimize
VACUUM ANALYZE;

-- Full vacuum (requires downtime)
VACUUM FULL;
```

**Scheduled Maintenance:**

```bash
# /etc/cron.weekly/postgres-vacuum
#!/bin/bash
docker compose exec -T postgres psql -U hmis_admin -d hmis -c "VACUUM ANALYZE;"
```

**Index Maintenance:**

```sql
-- Rebuild fragmented indexes
REINDEX TABLE patients;

-- Identify missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
AND n_distinct > 100
ORDER BY n_distinct DESC;
```

### Monitoring Tasks

**Daily:**
- Check error logs for exceptions
- Review Sentry alerts
- Verify backups completed

**Weekly:**
- Review performance metrics
- Check disk space usage
- Update security patches

**Monthly:**
- Test backup restoration
- Review access logs
- Audit user permissions
- Update SSL certificates if needed

**Quarterly:**
- Disaster recovery drill
- Security vulnerability scan
- Database query optimization review
- Capacity planning assessment

---

## Support

For deployment assistance:

- **Documentation:** https://docs.hmis.example.com
- **Email:** devops@hmis.example.com
- **Slack:** #hmis-deployments

---

**End of Deployment Guide**
