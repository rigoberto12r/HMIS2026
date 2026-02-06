# HMIS SaaS - Guia de Despliegue

## Inicio Rapido (Desarrollo Local)

```bash
# 1. Clonar y configurar
git clone <repo-url>
cd HMIS2026
cp .env.example .env

# 2. Levantar servicios
docker compose up -d

# 3. Ejecutar migraciones
docker compose exec backend alembic upgrade head

# 4. Cargar datos iniciales
docker compose exec backend python -m scripts.seed_data

# 5. Acceder
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/api/docs
# Admin:    admin@hmis.app / Admin2026!
```

---

## Despliegue en Produccion (Docker Compose)

### Pre-requisitos
- Docker 24+ y Docker Compose v2
- Certificados TLS (Let's Encrypt o CA propia)
- Dominio configurado (ej: hmis.example.com)

### Pasos

```bash
# 1. Configurar variables de entorno
cp .env.example .env
nano .env  # Ajustar TODOS los valores para produccion

# Variables criticas a cambiar:
#   SECRET_KEY=<generar con: openssl rand -hex 32>
#   JWT_SECRET_KEY=<generar con: openssl rand -hex 32>
#   POSTGRES_PASSWORD=<contrasena segura>
#   ENVIRONMENT=production
#   CORS_ORIGINS=https://hmis.example.com
#   SENTRY_DSN=<tu DSN de Sentry>

# 2. Colocar certificados TLS
mkdir -p certs
cp /path/to/fullchain.pem certs/
cp /path/to/privkey.pem certs/

# 3. Actualizar dominio en Nginx
# Editar hmis-infra/nginx/conf.d/hmis.conf
# Reemplazar hmis.example.com por tu dominio

# 4. Levantar en modo produccion
docker compose -f docker-compose.prod.yml up -d

# 5. Ejecutar migraciones
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 6. Cargar datos iniciales
docker compose -f docker-compose.prod.yml exec backend python -m scripts.seed_data

# 7. Verificar salud
curl https://hmis.example.com/health
curl https://hmis.example.com/health/ready
```

---

## Despliegue en Kubernetes (AWS EKS)

### Pre-requisitos
- AWS CLI configurado
- kubectl y helm instalados
- Terraform 1.5+

### Infraestructura (Terraform)

```bash
cd hmis-infra/terraform

# Inicializar
terraform init

# Planificar
terraform plan -var-file=prod.tfvars

# Aplicar
terraform apply -var-file=prod.tfvars

# Configurar kubectl
aws eks update-kubeconfig --name hmis-cluster --region us-east-1
```

### Aplicacion (Kubernetes)

```bash
# 1. Crear namespace y recursos base
kubectl apply -f hmis-infra/kubernetes/base/namespace.yaml

# 2. Crear secrets
kubectl create secret generic hmis-secrets -n hmis \
  --from-literal=SECRET_KEY=$(openssl rand -hex 32) \
  --from-literal=JWT_SECRET_KEY=$(openssl rand -hex 32) \
  --from-literal=DATABASE_URL="postgresql+asyncpg://..." \
  --from-literal=REDIS_URL="redis://..."

# 3. Desplegar aplicacion
kubectl apply -f hmis-infra/kubernetes/base/backend-deployment.yaml
kubectl apply -f hmis-infra/kubernetes/base/frontend-deployment.yaml
kubectl apply -f hmis-infra/kubernetes/base/ingress.yaml

# 4. Instalar cert-manager (TLS automatico)
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 5. Instalar monitoring
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace
kubectl apply -f hmis-infra/kubernetes/monitoring/

# 6. Ejecutar migraciones
kubectl run hmis-migrate --rm -it --restart=Never -n hmis \
  --image=<ecr-url>/hmis-backend:latest \
  -- alembic upgrade head

# 7. Cargar datos iniciales
kubectl run hmis-seed --rm -it --restart=Never -n hmis \
  --image=<ecr-url>/hmis-backend:latest \
  -- python -m scripts.seed_data
```

---

## Gestion Multi-Tenant

### Crear nuevo tenant (hospital)

```bash
# Via API (requiere token de superadmin)
curl -X POST https://hmis.example.com/api/v1/admin/tenants \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "hospital_central",
    "hospital_name": "Hospital Central de Santo Domingo",
    "country": "DO",
    "admin_email": "admin@hospitalcentral.do",
    "admin_password": "AdminHC2026!",
    "admin_first_name": "Director",
    "admin_last_name": "Hospital"
  }'

# Via script (acceso directo a BD)
./hmis-infra/scripts/tenant-provision.sh hospital_central "Hospital Central"
```

### Migrar schemas de todos los tenants

```bash
# Migrar solo public
alembic upgrade head

# Migrar todos los tenant schemas
alembic -x tenant=all upgrade head

# Migrar un tenant especifico
alembic -x tenant=tenant_hospital_central upgrade head
```

---

## Backups

### Backup manual
```bash
./hmis-infra/scripts/backup.sh full
```

### Backup automatizado (cron)
```bash
# Agregar al crontab del servidor
# Backup completo diario a las 2:00 AM
0 2 * * * /opt/hmis/hmis-infra/scripts/backup.sh full >> /var/log/hmis-backup.log 2>&1

# Backup de globals cada 6 horas
0 */6 * * * /opt/hmis/hmis-infra/scripts/backup.sh globals >> /var/log/hmis-backup.log 2>&1
```

---

## Monitoreo

### Endpoints de salud
| Endpoint | Proposito | Uso |
|----------|-----------|-----|
| `/health` | Status basico | Load balancers |
| `/health/live` | Liveness probe | Kubernetes |
| `/health/ready` | Readiness probe (DB+Redis) | Kubernetes |
| `/metrics` | Prometheus metrics | Monitoring |

### Grafana Dashboard
Importar `hmis-infra/kubernetes/monitoring/grafana-dashboard.json` en Grafana.

### Alertas configuradas
- **HMISBackendDown**: Backend sin respuesta >2min (critical)
- **HMISHighErrorRate**: Errores 5xx >5% (warning)
- **HMISCriticalErrorRate**: Errores 5xx >15% (critical)
- **HMISHighLatencyP95**: Latencia P95 >2s (warning)
- **HMISLoginFailureSpike**: Pico de logins fallidos (security)

---

## CI/CD

El pipeline esta configurado en `.github/workflows/`:

| Pipeline | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | Push/PR | Lint, test, build, security scan |
| `deploy.yml` | Merge a main/develop | Build images, deploy K8s, migrations |

### Flujo de despliegue
1. Push a `develop` -> CI -> Deploy a **development**
2. PR a `main` -> CI completo + security scan
3. Merge a `main` -> CI -> Deploy a **staging** -> Manual approval -> **production**

---

## Estructura de Puertos

| Servicio | Puerto dev | Puerto prod |
|----------|-----------|-------------|
| Frontend | 3000 | 443 (via Nginx) |
| Backend API | 8000 | 443/api (via Nginx) |
| PostgreSQL | 5432 | 127.0.0.1:5432 |
| Redis | 6379 | 127.0.0.1:6379 |
| Meilisearch | 7700 | Interno |
| MinIO Console | 9001 | 127.0.0.1:9001 |
| Prometheus Metrics | 8000/metrics | Interno |
