@echo off
REM ============================================
REM HMIS 2026 - Script de Detencion
REM ============================================

echo.
echo ================================================
echo   HMIS 2026 - Deteniendo Sistema
echo ================================================
echo.

cd /d "%~dp0"

echo Deteniendo todos los servicios...
docker-compose down

echo.
echo ================================================
echo   Sistema Detenido
echo ================================================
echo.
echo Los datos se han preservado en volumenes Docker.
echo.
echo Para eliminar tambien los datos, ejecuta:
echo   docker-compose down -v
echo.
echo ================================================
echo.

pause
