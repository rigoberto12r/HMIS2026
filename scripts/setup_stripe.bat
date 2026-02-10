@echo off
REM ############################################################################
REM Stripe Payment Gateway Setup Script for HMIS (Windows)
REM Automates the installation and configuration of Stripe integration
REM ############################################################################

setlocal enabledelayedexpansion

echo ========================================
echo HMIS Stripe Integration Setup (Windows)
echo ========================================
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

REM ############################################################################
REM Step 1: Verify Prerequisites
REM ############################################################################

echo Step 1: Verifying prerequisites...
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python found
) else (
    echo [ERROR] Python not found. Please install Python 3.9 or higher.
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js found
) else (
    echo [ERROR] Node.js not found. Please install Node.js 18 or higher.
    exit /b 1
)

REM Check pip
pip --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] pip found
) else (
    echo [ERROR] pip not found. Please install pip.
    exit /b 1
)

REM Check npm
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] npm found
) else (
    echo [ERROR] npm not found. Please install npm.
    exit /b 1
)

echo.

REM ############################################################################
REM Step 2: Get Stripe Keys
REM ############################################################################

echo Step 2: Stripe API Keys Configuration
echo.
echo You'll need Stripe API keys. Get them from: https://dashboard.stripe.com/apikeys
echo.

set /p STRIPE_SECRET_KEY="Enter your Stripe Secret Key (sk_test_...): "
set /p STRIPE_PUBLISHABLE_KEY="Enter your Stripe Publishable Key (pk_test_...): "

REM Basic validation
echo %STRIPE_SECRET_KEY% | findstr /B "sk_test_ sk_live_" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Invalid Stripe Secret Key format. Should start with sk_test_ or sk_live_
    exit /b 1
)

echo %STRIPE_PUBLISHABLE_KEY% | findstr /B "pk_test_ pk_live_" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Invalid Stripe Publishable Key format. Should start with pk_test_ or pk_live_
    exit /b 1
)

echo [OK] Stripe keys validated
echo.

REM ############################################################################
REM Step 3: Backend Setup
REM ############################################################################

echo Step 3: Setting up backend...
echo.

cd "%PROJECT_ROOT%\hmis-backend"

REM Install Stripe package
echo Installing Stripe Python package...
pip install "stripe>=7.0.0"
if %errorlevel% equ 0 (
    echo [OK] Stripe package installed
) else (
    echo [ERROR] Failed to install Stripe package
    exit /b 1
)

REM Update .env file
if exist ".env" (
    echo Updating .env file...

    REM Create temporary file without Stripe keys
    findstr /V "STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET" .env > .env.tmp

    REM Add new Stripe keys
    echo. >> .env.tmp
    echo # Stripe Payment Gateway >> .env.tmp
    echo STRIPE_SECRET_KEY=%STRIPE_SECRET_KEY% >> .env.tmp
    echo STRIPE_PUBLISHABLE_KEY=%STRIPE_PUBLISHABLE_KEY% >> .env.tmp
    echo STRIPE_WEBHOOK_SECRET=whsec_set_this_later >> .env.tmp

    REM Replace old .env with new one
    move /y .env.tmp .env >nul

    echo [OK] .env file updated
) else (
    echo [WARNING] .env file not found. Creating from .env.example...

    if exist ".env.example" (
        copy .env.example .env >nul
    )

    REM Add Stripe keys
    echo. >> .env
    echo # Stripe Payment Gateway >> .env
    echo STRIPE_SECRET_KEY=%STRIPE_SECRET_KEY% >> .env
    echo STRIPE_PUBLISHABLE_KEY=%STRIPE_PUBLISHABLE_KEY% >> .env
    echo STRIPE_WEBHOOK_SECRET=whsec_set_this_later >> .env

    echo [OK] .env file created
)

REM Run database migration
echo Running database migration...
alembic upgrade head >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Database migration completed
) else (
    echo [WARNING] Alembic not found or migration failed. Run manually: alembic upgrade head
)

echo.

REM ############################################################################
REM Step 4: Frontend Setup
REM ############################################################################

echo Step 4: Setting up frontend...
echo.

cd "%PROJECT_ROOT%\hmis-frontend"

REM Install Stripe packages
echo Installing Stripe JavaScript packages...
call npm install @stripe/stripe-js @stripe/react-stripe-js
if %errorlevel% equ 0 (
    echo [OK] Stripe packages installed
) else (
    echo [ERROR] Failed to install Stripe packages
    exit /b 1
)

REM Update .env.local file
if exist ".env.local" (
    echo Updating .env.local file...

    REM Create temporary file without Stripe keys
    findstr /V "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" .env.local > .env.local.tmp

    REM Add new key
    echo. >> .env.local.tmp
    echo # Stripe Configuration >> .env.local.tmp
    echo NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=%STRIPE_PUBLISHABLE_KEY% >> .env.local.tmp

    REM Replace old .env.local with new one
    move /y .env.local.tmp .env.local >nul

    echo [OK] .env.local file updated
) else (
    echo [WARNING] .env.local file not found. Creating...

    REM Create .env.local
    (
        echo # HMIS Frontend Environment Variables
        echo.
        echo # API Configuration
        echo NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
        echo.
        echo # Stripe Configuration
        echo NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=%STRIPE_PUBLISHABLE_KEY%
    ) > .env.local

    echo [OK] .env.local file created
)

echo.

REM ############################################################################
REM Step 5: Summary and Next Steps
REM ############################################################################

echo ========================================
echo Setup Complete!
echo ========================================
echo.

echo [OK] Stripe integration installed successfully
echo.

echo Configuration Summary:
echo   - Backend: Stripe Python package installed
echo   - Frontend: Stripe React packages installed
echo   - Environment variables configured
echo   - Database migration ready to run
echo.

echo Next Steps:
echo.
echo 1. Start the backend server:
echo    cd "%PROJECT_ROOT%\hmis-backend"
echo    uvicorn app.main:app --reload
echo.

echo 2. Start the frontend server:
echo    cd "%PROJECT_ROOT%\hmis-frontend"
echo    npm run dev
echo.

echo 3. Test the payment flow:
echo    - Create a test invoice in the billing module
echo    - Click 'Pay with Stripe' button
echo    - Use test card: 4242 4242 4242 4242
echo    - Complete the payment
echo.

echo 4. Setup webhooks (optional but recommended):
echo    - Install Stripe CLI: https://stripe.com/docs/stripe-cli
echo    - Run: stripe listen --forward-to localhost:8000/api/v1/payments/stripe/webhooks
echo    - Copy the webhook secret and update .env
echo.

echo 5. Review documentation:
echo    - Quick Start: docs\STRIPE_QUICKSTART.md
echo    - Full Guide: docs\STRIPE_INTEGRATION.md
echo    - Files Summary: docs\STRIPE_FILES_SUMMARY.md
echo.

echo [WARNING] Remember: You are using TEST keys. Switch to LIVE keys for production!
echo.

echo Test Cards:
echo   Success:       4242 4242 4242 4242
echo   3D Secure:     4000 0027 6000 3184
echo   Declined:      4000 0000 0000 0002
echo   More: https://stripe.com/docs/testing
echo.

echo Support:
echo   - Stripe Docs: https://stripe.com/docs
echo   - Stripe Support: https://support.stripe.com
echo.

echo [OK] You're all set! Happy payments processing!
echo.

pause
