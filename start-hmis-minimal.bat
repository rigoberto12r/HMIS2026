@echo off
REM ============================================
REM HMIS 2026 - Inicio Minimo (Sin Jaeger)
REM ============================================
REM
REM Inicia solo los servicios esenciales
REM (sin Jaeger que requiere conexion a Internet)
REM
REM ============================================

echo.
echo ================================================
echo   HMIS 2026 - Iniciando Sistema (Minimo)
echo ================================================
echo.

cd /d "%~dp0"

echo [1/4] Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker no esta instalado o no esta corriendo
    pause
    exit /b 1
)
echo OK - Docker disponible

echo.
echo [2/4] Deteniendo contenedores anteriores...
docker-compose down

echo.
echo [3/4] Iniciando servicios esenciales (PostgreSQL, Redis, Backend, Frontend)...
docker-compose up -d postgres redis backend frontend

echo.
echo [4/4] Esperando a que los servicios esten listos...
timeout /t 15 /nobreak >nul

echo.
echo ================================================
echo   Verificando Estado
echo ================================================
echo.
docker-compose ps

echo.
echo ================================================
echo   HMIS 2026 - Sistema Iniciado (Modo Minimo)
echo ================================================
echo.
echo Servicios disponibles:
echo.
echo   - Frontend:        http://localhost:3000
echo   - Backend API:     http://localhost:8000
echo   - API Docs:        http://localhost:8000/api/docs
echo.
echo NOTA: Jaeger (tracing) no esta disponible
echo       El sistema funciona perfectamente sin el.
echo.
echo Credenciales:
echo   Email:    admin@hmis.app
echo   Password: Admin2026!
echo.
echo ================================================
echo.

set /p OPEN_BROWSER="Abrir navegador? (S/N): "
if /i "%OPEN_BROWSER%"=="S" (
    start http://localhost:3000
    start http://localhost:8000/api/docs
)

echo.
echo Presiona cualquier tecla para salir...
pause >nul
