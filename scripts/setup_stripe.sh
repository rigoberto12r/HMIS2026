#!/bin/bash

###############################################################################
# Stripe Payment Gateway Setup Script for HMIS
# Automates the installation and configuration of Stripe integration
###############################################################################

set -e  # Exit on error

echo "========================================"
echo "HMIS Stripe Integration Setup"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

###############################################################################
# Step 1: Verify Prerequisites
###############################################################################

echo "Step 1: Verifying prerequisites..."
echo ""

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Python 3 found: $PYTHON_VERSION"
else
    print_error "Python 3 not found. Please install Python 3.9 or higher."
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18 or higher."
    exit 1
fi

# Check pip
if command -v pip3 &> /dev/null; then
    print_success "pip3 found"
else
    print_error "pip3 not found. Please install pip."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    print_success "npm found"
else
    print_error "npm not found. Please install npm."
    exit 1
fi

echo ""

###############################################################################
# Step 2: Get Stripe Keys
###############################################################################

echo "Step 2: Stripe API Keys Configuration"
echo ""

print_info "You'll need Stripe API keys. Get them from: https://dashboard.stripe.com/apikeys"
echo ""

# Prompt for keys
read -p "Enter your Stripe Secret Key (sk_test_...): " STRIPE_SECRET_KEY
read -p "Enter your Stripe Publishable Key (pk_test_...): " STRIPE_PUBLISHABLE_KEY

# Validate keys
if [[ ! $STRIPE_SECRET_KEY =~ ^sk_(test|live)_ ]]; then
    print_error "Invalid Stripe Secret Key format. Should start with sk_test_ or sk_live_"
    exit 1
fi

if [[ ! $STRIPE_PUBLISHABLE_KEY =~ ^pk_(test|live)_ ]]; then
    print_error "Invalid Stripe Publishable Key format. Should start with pk_test_ or pk_live_"
    exit 1
fi

print_success "Stripe keys validated"
echo ""

###############################################################################
# Step 3: Backend Setup
###############################################################################

echo "Step 3: Setting up backend..."
echo ""

cd "$PROJECT_ROOT/hmis-backend"

# Install Stripe package
print_info "Installing Stripe Python package..."
pip3 install stripe>=7.0.0
print_success "Stripe package installed"

# Update .env file
if [ -f ".env" ]; then
    print_info "Updating .env file..."

    # Remove old Stripe keys if they exist
    sed -i '/STRIPE_SECRET_KEY/d' .env
    sed -i '/STRIPE_PUBLISHABLE_KEY/d' .env
    sed -i '/STRIPE_WEBHOOK_SECRET/d' .env

    # Add new Stripe keys
    echo "" >> .env
    echo "# Stripe Payment Gateway" >> .env
    echo "STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY" >> .env
    echo "STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY" >> .env
    echo "STRIPE_WEBHOOK_SECRET=whsec_set_this_later" >> .env

    print_success ".env file updated"
else
    print_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env

    # Add Stripe keys
    echo "" >> .env
    echo "# Stripe Payment Gateway" >> .env
    echo "STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY" >> .env
    echo "STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY" >> .env
    echo "STRIPE_WEBHOOK_SECRET=whsec_set_this_later" >> .env

    print_success ".env file created"
fi

# Run database migration
print_info "Running database migration..."
if command -v alembic &> /dev/null; then
    alembic upgrade head
    print_success "Database migration completed"
else
    print_warning "Alembic not found. Skipping migration. Run manually: alembic upgrade head"
fi

echo ""

###############################################################################
# Step 4: Frontend Setup
###############################################################################

echo "Step 4: Setting up frontend..."
echo ""

cd "$PROJECT_ROOT/hmis-frontend"

# Install Stripe packages
print_info "Installing Stripe JavaScript packages..."
npm install @stripe/stripe-js @stripe/react-stripe-js
print_success "Stripe packages installed"

# Update .env.local file
if [ -f ".env.local" ]; then
    print_info "Updating .env.local file..."

    # Remove old Stripe keys if they exist
    sed -i '/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/d' .env.local

    # Add new key
    echo "" >> .env.local
    echo "# Stripe Configuration" >> .env.local
    echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY" >> .env.local

    print_success ".env.local file updated"
else
    print_warning ".env.local file not found. Creating..."

    # Create .env.local
    cat > .env.local << EOF
# HMIS Frontend Environment Variables

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY
EOF

    print_success ".env.local file created"
fi

echo ""

###############################################################################
# Step 5: Summary and Next Steps
###############################################################################

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""

print_success "Stripe integration installed successfully"
echo ""

echo "Configuration Summary:"
echo "  • Backend: Stripe Python package installed"
echo "  • Frontend: Stripe React packages installed"
echo "  • Environment variables configured"
echo "  • Database migration ready to run"
echo ""

echo "Next Steps:"
echo ""
echo "1. Start the backend server:"
echo "   cd $PROJECT_ROOT/hmis-backend"
echo "   uvicorn app.main:app --reload"
echo ""

echo "2. Start the frontend server:"
echo "   cd $PROJECT_ROOT/hmis-frontend"
echo "   npm run dev"
echo ""

echo "3. Test the payment flow:"
echo "   • Create a test invoice in the billing module"
echo "   • Click 'Pay with Stripe' button"
echo "   • Use test card: 4242 4242 4242 4242"
echo "   • Complete the payment"
echo ""

echo "4. Setup webhooks (optional but recommended):"
echo "   • Install Stripe CLI: https://stripe.com/docs/stripe-cli"
echo "   • Run: stripe listen --forward-to localhost:8000/api/v1/payments/stripe/webhooks"
echo "   • Copy the webhook secret and update .env"
echo ""

echo "5. Review documentation:"
echo "   • Quick Start: docs/STRIPE_QUICKSTART.md"
echo "   • Full Guide: docs/STRIPE_INTEGRATION.md"
echo "   • Files Summary: docs/STRIPE_FILES_SUMMARY.md"
echo ""

print_warning "Remember: You are using TEST keys. Switch to LIVE keys for production!"
echo ""

echo "Test Cards:"
echo "  Success:       4242 4242 4242 4242"
echo "  3D Secure:     4000 0027 6000 3184"
echo "  Declined:      4000 0000 0000 0002"
echo "  More: https://stripe.com/docs/testing"
echo ""

echo "Support:"
echo "  • Stripe Docs: https://stripe.com/docs"
echo "  • Stripe Support: https://support.stripe.com"
echo ""

print_success "You're all set! Happy payments processing! 💳"
