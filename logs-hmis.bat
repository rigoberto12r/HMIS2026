@echo off
REM ============================================
REM HMIS 2026 - Ver Logs
REM ============================================

echo.
echo ================================================
echo   HMIS 2026 - Logs del Sistema
echo ================================================
echo.
echo Mostrando logs en tiempo real...
echo Presiona Ctrl+C para salir
echo.
echo ================================================
echo.

cd /d "%~dp0"

docker-compose logs -f --tail=100
