# Scripts de Inicio Rápido - HMIS 2026

## 📋 Scripts Disponibles

He creado scripts automatizados para facilitarte el manejo del sistema HMIS:

### 🚀 `start-hmis.bat` - Inicio Completo
**Qué hace:**
- Inicia todo el sistema con Docker Compose
- Verifica que Docker esté corriendo
- Muestra el estado de todos los servicios
- Opción de abrir navegador automáticamente

**Cómo usar:**
```cmd
# Opción 1: Doble click en el archivo
start-hmis.bat

# Opción 2: Desde terminal
cd C:\Users\Cross\Downloads\HMIS\HMIS2026
start-hmis.bat
```

**Resultado:**
- ✅ Frontend en http://localhost:3000
- ✅ Backend en http://localhost:8000
- ✅ PostgreSQL, Redis, Jaeger corriendo

---

### 💻 `start-hmis-dev.bat` - Modo Desarrollo
**Qué hace:**
- Inicia solo servicios base (PostgreSQL, Redis, Jaeger)
- Aplica migraciones de base de datos
- Muestra instrucciones para iniciar backend/frontend manualmente

**Cómo usar:**
```cmd
start-hmis-dev.bat
```

**Después ejecuta en terminales separadas:**

Terminal 1 - Backend:
```cmd
cd hmis-backend
.venv\Scripts\activate
uvicorn app.main:app --reload
```

Terminal 2 - Frontend:
```cmd
cd hmis-frontend
npm run dev
```

**Ventajas:**
- 🔥 Hot reload en backend
- ⚡ Fast refresh en frontend
- 🐛 Mejor para debugging

---

### 🛑 `stop-hmis.bat` - Detener Sistema
**Qué hace:**
- Detiene todos los contenedores Docker
- Preserva los datos (volúmenes)

**Cómo usar:**
```cmd
stop-hmis.bat
```

---

### 🔄 `restart-hmis.bat` - Reiniciar Sistema
**Qué hace:**
- Detiene todos los servicios
- Reconstruye las imágenes Docker
- Inicia todo nuevamente

**Cómo usar:**
```cmd
restart-hmis.bat
```

**Cuándo usar:**
- Después de cambios en Dockerfile
- Después de cambios en requirements.txt
- Para limpiar caché de Docker

---

### 📜 `logs-hmis.bat` - Ver Logs
**Qué hace:**
- Muestra logs en tiempo real de todos los servicios
- Últimas 100 líneas

**Cómo usar:**
```cmd
logs-hmis.bat
```

**Presiona Ctrl+C para salir**

---

### ✅ `status-hmis.bat` - Verificar Estado
**Qué hace:**
- Muestra estado de contenedores
- Verifica salud de backend/frontend
- Muestra uso de recursos
- Lista URLs de acceso

**Cómo usar:**
```cmd
status-hmis.bat
```

---

## 🎯 Flujo de Trabajo Recomendado

### Primera Vez (Setup Inicial)

```cmd
# 1. Iniciar sistema completo
start-hmis.bat

# 2. Esperar 30-60 segundos

# 3. Verificar estado
status-hmis.bat

# 4. Abrir navegador
http://localhost:3000
```

### Desarrollo Diario

```cmd
# 1. Iniciar servicios base
start-hmis-dev.bat

# 2. Terminal 1 - Backend
cd hmis-backend
.venv\Scripts\activate
uvicorn app.main:app --reload

# 3. Terminal 2 - Frontend
cd hmis-frontend
npm run dev

# 4. Desarrollar con hot reload activo
```

### Después de Cambios Mayores

```cmd
# Reiniciar todo limpio
restart-hmis.bat
```

### Al Terminar el Día

```cmd
# Detener sistema
stop-hmis.bat
```

---

## 🔧 Solución de Problemas

### "Docker no está instalado o no está corriendo"

**Solución:**
1. Abre Docker Desktop
2. Espera a que inicie completamente
3. Ejecuta `start-hmis.bat` de nuevo

### "Puerto ya en uso"

**Solución:**
```cmd
# Ver qué está usando el puerto 8000
netstat -ano | findstr :8000

# Matar el proceso (reemplaza PID)
taskkill /PID <PID> /F

# O usar puerto diferente:
set PORT=8001
uvicorn app.main:app --reload --port %PORT%
```

### "Backend no responde"

**Solución:**
```cmd
# Ver logs del backend
docker-compose logs backend

# Reiniciar solo backend
docker-compose restart backend

# Verificar migraciones
docker-compose exec backend alembic current
```

### "Frontend no carga"

**Solución:**
```cmd
# Ver logs del frontend
docker-compose logs frontend

# Reinstalar dependencias
cd hmis-frontend
npm install

# Limpiar caché y reconstruir
npm run build
```

---

## 📊 Verificación Rápida

Después de iniciar, verifica que todo funciona:

```cmd
# 1. Ejecutar script de estado
status-hmis.bat

# 2. Verificar endpoints
curl http://localhost:8000/health
curl http://localhost:8000/health/ready

# 3. Abrir en navegador
start http://localhost:3000
start http://localhost:8000/api/docs
```

**Deberías ver:**
- ✅ Todos los contenedores "Up"
- ✅ Backend responde `{"status":"ok"}`
- ✅ Frontend carga página de login
- ✅ API Docs muestra Swagger UI

---

## 🎓 Credenciales por Defecto

```
Email:    admin@hmis.app
Password: Admin2026!
```

---

## 📁 URLs del Sistema

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:3000 | Interfaz principal |
| **Backend** | http://localhost:8000 | API REST |
| **Swagger UI** | http://localhost:8000/api/docs | Docs interactivas |
| **ReDoc** | http://localhost:8000/api/redoc | Docs alternativas |
| **Jaeger** | http://localhost:16686 | Tracing distribuido |
| **Prometheus** | http://localhost:8000/metrics | Métricas |

---

## 💡 Tips

**Para desarrollo:**
- Usa `start-hmis-dev.bat` para hot reload
- Abre 3 terminales: servicios, backend, frontend
- Usa VSCode con extensiones Python y ESLint

**Para testing:**
- Usa `start-hmis.bat` para ambiente completo
- Verifica con `status-hmis.bat`
- Monitorea con `logs-hmis.bat`

**Para demos:**
- Usa `restart-hmis.bat` para empezar limpio
- Carga datos de prueba si es necesario
- Usa `status-hmis.bat` para verificar antes de la demo

---

## 🆘 Ayuda

Si tienes problemas:

1. **Ver logs:** `logs-hmis.bat`
2. **Verificar estado:** `status-hmis.bat`
3. **Reiniciar limpio:** `restart-hmis.bat`
4. **Revisar documentación:** `README.md`, `DEPLOYMENT_GUIDE.md`

---

¡Listo para empezar! 🚀
