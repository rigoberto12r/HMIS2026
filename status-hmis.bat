@echo off
REM ============================================
REM HMIS 2026 - Verificar Estado
REM ============================================

echo.
echo ================================================
echo   HMIS 2026 - Estado del Sistema
echo ================================================
echo.

cd /d "%~dp0"

echo [1/4] Estado de los contenedores:
echo.
docker-compose ps

echo.
echo [2/4] Verificando salud del backend...
curl -s http://localhost:8000/health 2>nul
if %errorlevel% equ 0 (
    echo OK - Backend respondiendo
) else (
    echo ERROR - Backend no responde
)

echo.
echo [3/4] Verificando salud del frontend...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo OK - Frontend respondiendo
) else (
    echo ERROR - Frontend no responde
)

echo.
echo [4/4] Uso de recursos:
echo.
docker stats --no-stream

echo.
echo ================================================
echo   URLs de Acceso
echo ================================================
echo.
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:8000
echo   API Docs:     http://localhost:8000/api/docs
echo   Jaeger UI:    http://localhost:16686
echo   Metrics:      http://localhost:8000/metrics
echo.
echo ================================================
echo.

pause
