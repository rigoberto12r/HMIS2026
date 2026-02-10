# Docker Setup - Guía de Solución de Problemas

## Problema Resuelto: Build se Congelaba

### Causa
El proceso de `docker compose up` se congelaba durante `npm install` porque:
1. **No existía `package-lock.json`** en el frontend
2. **Docker copiaba 417MB de `node_modules`** al contexto de build (sin `.dockerignore`)
3. El Dockerfile de producción era innecesariamente complejo para desarrollo

### Solución Implementada

#### 1. Generado `package-lock.json`
```bash
cd hmis-frontend && npm install --package-lock-only
```

#### 2. Creado `.dockerignore` para Frontend y Backend
**hmis-frontend/.dockerignore**: Excluye `node_modules`, `.next`, etc.
**hmis-backend/.dockerignore**: Excluye `.venv`, `__pycache__`, etc.

**Resultado**: El contexto de build bajó de **220MB+ a 2.8kB** ✅

#### 3. Creado `Dockerfile.dev` Simplificado
**hmis-frontend/Dockerfile.dev**:
- Dockerfile más simple y rápido para desarrollo
- Configuración de npm con timeouts más largos
- Sin multi-stage build innecesario

#### 4. Creado `.npmrc` con Timeouts
**hmis-frontend/.npmrc**: Configuración para evitar timeouts en Docker

#### 5. Corregidas Migraciones de Alembic
- 54 correcciones en archivos de migración
- Sintaxis incorrecta de `server_default` corregida:
  - `server_default="true"` → `server_default=sa.text("true")`
  - `server_default="'{}'` → `server_default=sa.text("'{}'::jsonb")`

## Estado Actual

### Servicios Corriendo ✅
```
hmis-backend       ✅ HEALTHY   http://localhost:8000
hmis-frontend      ✅ RUNNING   http://localhost:3000
hmis-postgres      ✅ HEALTHY   localhost:5432
hmis-redis         ✅ HEALTHY   localhost:6379
hmis-meilisearch   ✅ RUNNING   http://localhost:7700
hmis-minio         ✅ RUNNING   http://localhost:9000
```

### Tiempos de Build
- **Antes**: Congelado/Timeout después de 5+ minutos
- **Ahora**: ~51 segundos para frontend, ~30 segundos para backend ✅

## Uso

### Levantar el Stack
```bash
docker compose up -d
```

### Ver Logs
```bash
docker compose logs -f backend    # Backend logs
docker compose logs -f frontend   # Frontend logs
docker compose logs -f            # Todos los logs
```

### Ejecutar Migraciones
```bash
docker compose exec backend alembic upgrade head
```

### Seed Data (Datos Iniciales)
```bash
docker compose exec backend python -m scripts.seed_data
```

### Detener el Stack
```bash
docker compose down
```

### Reconstruir Imágenes
```bash
docker compose build --no-cache
docker compose up -d
```

## Acceso

- **Frontend**: http://localhost:3000
- **Backend API Docs**: http://localhost:8000/api/docs
- **Backend Health**: http://localhost:8000/health
- **Meilisearch**: http://localhost:7700
- **MinIO Console**: http://localhost:9001

## Próximos Pasos

1. Ejecutar seed data para crear usuario admin
2. Acceder al frontend y hacer login
3. Explorar la API en http://localhost:8000/api/docs

## Archivos Creados/Modificados

### Nuevos Archivos
- `hmis-frontend/Dockerfile.dev` - Dockerfile optimizado para desarrollo
- `hmis-frontend/.dockerignore` - Excluye archivos del contexto de build
- `hmis-frontend/.npmrc` - Configuración npm con timeouts
- `hmis-frontend/package-lock.json` - Lockfile de dependencias
- `hmis-backend/.dockerignore` - Excluye archivos del contexto de build
- `DOCKER_SETUP.md` - Esta guía

### Archivos Modificados
- `docker-compose.yml` - Cambiado a `Dockerfile.dev`, removido `version`, healthcheck mejorado
- `hmis-backend/migrations/versions/001_initial_schema.py` - 50 correcciones de sintaxis
- `hmis-backend/migrations/versions/002_accounting_tables.py` - 4 correcciones de sintaxis

## Troubleshooting

### Si el build sigue congelándose
```bash
# Limpiar todo y reconstruir
docker compose down -v
docker system prune -a
docker compose build --no-cache
docker compose up -d
```

### Si faltan node_modules localmente
```bash
cd hmis-frontend
npm ci
```

### Si hay problemas con la base de datos
```bash
# Resetear base de datos
docker compose down -v
docker compose up -d postgres redis
docker compose exec backend alembic upgrade head
```
