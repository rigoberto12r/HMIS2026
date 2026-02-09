@echo off
REM ============================================
REM HMIS 2026 - Script de Reinicio
REM ============================================

echo.
echo ================================================
echo   HMIS 2026 - Reiniciando Sistema
echo ================================================
echo.

cd /d "%~dp0"

echo [1/3] Deteniendo servicios...
docker-compose down

echo.
echo [2/3] Reconstruyendo imagenes...
docker-compose build --no-cache

echo.
echo [3/3] Iniciando servicios...
docker-compose up -d

echo.
echo ================================================
echo   Sistema Reiniciado
echo ================================================
echo.
echo Servicios disponibles en:
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:8000/api/docs
echo.
echo ================================================
echo.

pause
