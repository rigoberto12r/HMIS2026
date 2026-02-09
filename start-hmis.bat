@echo off
REM ============================================
REM HMIS 2026 - Script de Inicio Automatico
REM ============================================
REM
REM Este script inicia todo el sistema HMIS
REM con Docker Compose
REM
REM Uso: Doble click o ejecutar: start-hmis.bat
REM ============================================

echo.
echo ================================================
echo   HMIS 2026 - Iniciando Sistema
echo ================================================
echo.

REM Cambiar al directorio del proyecto
cd /d "%~dp0"

echo [1/5] Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker no esta instalado o no esta corriendo
    echo Por favor inicia Docker Desktop primero
    pause
    exit /b 1
)
echo OK - Docker esta disponible

echo.
echo [2/5] Deteniendo contenedores anteriores...
docker-compose down

echo.
echo [3/5] Iniciando servicios con Docker Compose...
docker-compose up -d

echo.
echo [4/5] Esperando a que los servicios esten listos...
timeout /t 10 /nobreak >nul

echo.
echo [5/5] Verificando estado de los servicios...
docker-compose ps

echo.
echo ================================================
echo   HMIS 2026 - Sistema Iniciado!
echo ================================================
echo.
echo Servicios disponibles:
echo.
echo   - Frontend:        http://localhost:3000
echo   - Backend API:     http://localhost:8000
echo   - API Docs:        http://localhost:8000/api/docs
echo   - Jaeger UI:       http://localhost:16686
echo.
echo Credenciales por defecto:
echo   Email:    admin@hmis.app
echo   Password: Admin2026!
echo.
echo ================================================
echo.
echo Para ver logs en tiempo real:
echo   docker-compose logs -f
echo.
echo Para detener el sistema:
echo   docker-compose down
echo.
echo ================================================
echo.

REM Preguntar si quiere abrir el navegador
set /p OPEN_BROWSER="Deseas abrir el navegador automaticamente? (S/N): "
if /i "%OPEN_BROWSER%"=="S" (
    start http://localhost:3000
    start http://localhost:8000/api/docs
)

echo.
echo Presiona cualquier tecla para ver los logs...
pause >nul

REM Mostrar logs
docker-compose logs -f
