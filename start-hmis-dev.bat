@echo off
REM ============================================
REM HMIS 2026 - Script de Inicio para Desarrollo
REM ============================================
REM
REM Este script inicia el sistema en modo desarrollo:
REM - Servicios (PostgreSQL, Redis) en Docker
REM - Backend en modo desarrollo (hot reload)
REM - Frontend en modo desarrollo (fast refresh)
REM
REM Uso: Doble click o ejecutar: start-hmis-dev.bat
REM ============================================

echo.
echo ================================================
echo   HMIS 2026 - Modo Desarrollo
echo ================================================
echo.

cd /d "%~dp0"

echo [1/4] Iniciando servicios base (PostgreSQL, Redis, Jaeger)...
docker-compose up -d postgres redis jaeger

echo.
echo [2/4] Esperando a que PostgreSQL este listo...
timeout /t 5 /nobreak >nul

echo.
echo [3/4] Aplicando migraciones de base de datos...
cd hmis-backend
docker-compose exec -T postgres pg_isready -U hmis_admin -d hmis
if %errorlevel% equ 0 (
    if exist .venv\Scripts\activate.bat (
        call .venv\Scripts\activate.bat
        alembic upgrade head
    ) else (
        echo ADVERTENCIA: Entorno virtual no encontrado
        echo Ejecuta: python -m venv .venv
    )
)

cd ..

echo.
echo [4/4] Sistema listo para desarrollo!
echo.
echo ================================================
echo   Servicios Iniciados
echo ================================================
echo.
echo   - PostgreSQL:  localhost:5432
echo   - Redis:       localhost:6379
echo   - Jaeger UI:   http://localhost:16686
echo.
echo ================================================
echo   Proximos Pasos
echo ================================================
echo.
echo 1. Abre una terminal y ejecuta:
echo    cd hmis-backend
echo    .venv\Scripts\activate
echo    uvicorn app.main:app --reload
echo.
echo 2. Abre otra terminal y ejecuta:
echo    cd hmis-frontend
echo    npm run dev
echo.
echo 3. Accede a:
echo    - Frontend: http://localhost:3000
echo    - Backend:  http://localhost:8000
echo.
echo ================================================
echo.

pause
