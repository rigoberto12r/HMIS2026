#!/bin/bash
# Phase 1 Verification Script
# Verifies all completed improvements are working correctly

set -e  # Exit on error

echo "=================================================="
echo "HMIS Phase 1 Verification Script"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $1"
        FAILED=$((FAILED + 1))
    fi
}

# ========================================
# BACKEND VERIFICATION
# ========================================
echo -e "${YELLOW}[Backend]${NC}"

# Check exception handlers exist
if [ -f "hmis-backend/app/shared/exceptions.py" ]; then
    echo -e "${GREEN}✓${NC} Exception handlers file exists"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Exception handlers file missing"
    FAILED=$((FAILED + 1))
fi

# Check repository pattern exists
if [ -f "hmis-backend/app/shared/repository.py" ]; then
    echo -e "${GREEN}✓${NC} Repository base class exists"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Repository base class missing"
    FAILED=$((FAILED + 1))
fi

if [ -f "hmis-backend/app/modules/patients/repository.py" ]; then
    echo -e "${GREEN}✓${NC} PatientRepository exists"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} PatientRepository missing"
    FAILED=$((FAILED + 1))
fi

# Check PatientService uses repository
if grep -q "self.repo = PatientRepository" hmis-backend/app/modules/patients/service.py; then
    echo -e "${GREEN}✓${NC} PatientService uses repository pattern"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} PatientService not using repository"
    FAILED=$((FAILED + 1))
fi

# Check rate limiting uses Redis
if grep -q "redis_client" hmis-backend/app/core/rate_limit.py; then
    echo -e "${GREEN}✓${NC} Rate limiting uses Redis"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Rate limiting not using Redis"
    FAILED=$((FAILED + 1))
fi

# Check multi-stage Dockerfile
if grep -q "FROM.*AS builder" hmis-backend/docker/Dockerfile; then
    echo -e "${GREEN}✓${NC} Multi-stage Dockerfile implemented"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Multi-stage Dockerfile missing"
    FAILED=$((FAILED + 1))
fi

# Check non-root user in Dockerfile
if grep -q "USER appuser" hmis-backend/docker/Dockerfile; then
    echo -e "${GREEN}✓${NC} Non-root user configured"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Non-root user not configured"
    FAILED=$((FAILED + 1))
fi

echo ""

# ========================================
# FRONTEND VERIFICATION
# ========================================
echo -e "${YELLOW}[Frontend]${NC}"

# Check QueryProvider exists
if [ -f "hmis-frontend/src/app/(app)/providers.tsx" ]; then
    echo -e "${GREEN}✓${NC} QueryProvider exists"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} QueryProvider missing"
    FAILED=$((FAILED + 1))
fi

# Check layout uses QueryProvider
if grep -q "QueryProvider" hmis-frontend/src/app/\(app\)/layout.tsx; then
    echo -e "${GREEN}✓${NC} Layout wrapped with QueryProvider"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Layout not using QueryProvider"
    FAILED=$((FAILED + 1))
fi

# Check hooks exist
HOOKS_COUNT=0
[ -f "hmis-frontend/src/hooks/usePatients.ts" ] && HOOKS_COUNT=$((HOOKS_COUNT + 1))
[ -f "hmis-frontend/src/hooks/useAppointments.ts" ] && HOOKS_COUNT=$((HOOKS_COUNT + 1))
[ -f "hmis-frontend/src/hooks/useInvoices.ts" ] && HOOKS_COUNT=$((HOOKS_COUNT + 1))
[ -f "hmis-frontend/src/hooks/useEncounters.ts" ] && HOOKS_COUNT=$((HOOKS_COUNT + 1))

if [ $HOOKS_COUNT -eq 4 ]; then
    echo -e "${GREEN}✓${NC} All 4 React Query hooks exist"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Missing React Query hooks ($HOOKS_COUNT/4)"
    FAILED=$((FAILED + 1))
fi

echo ""

# ========================================
# CI/CD VERIFICATION
# ========================================
echo -e "${YELLOW}[CI/CD]${NC}"

# Check backend CI workflow
if [ -f ".github/workflows/backend-ci.yml" ]; then
    echo -e "${GREEN}✓${NC} Backend CI workflow exists"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Backend CI workflow missing"
    FAILED=$((FAILED + 1))
fi

# Check frontend CI workflow
if [ -f ".github/workflows/frontend-ci.yml" ]; then
    echo -e "${GREEN}✓${NC} Frontend CI workflow exists"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Frontend CI workflow missing"
    FAILED=$((FAILED + 1))
fi

# Check backend CI has PostgreSQL service
if grep -q "postgres:16-alpine" .github/workflows/backend-ci.yml; then
    echo -e "${GREEN}✓${NC} Backend CI has PostgreSQL service"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Backend CI missing PostgreSQL service"
    FAILED=$((FAILED + 1))
fi

# Check backend CI has Redis service
if grep -q "redis:7-alpine" .github/workflows/backend-ci.yml; then
    echo -e "${GREEN}✓${NC} Backend CI has Redis service"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Backend CI missing Redis service"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "=================================================="
echo -e "${YELLOW}SUMMARY${NC}"
echo "=================================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All Phase 1 improvements verified!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run backend tests: cd hmis-backend && pytest -v"
    echo "  2. Run frontend build: cd hmis-frontend && npm run build"
    echo "  3. Start services: docker compose up -d"
    echo "  4. Complete Task #3: Integration tests"
    echo "  5. Complete Task #5: Fragment monolithic pages"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review above.${NC}"
    exit 1
fi
