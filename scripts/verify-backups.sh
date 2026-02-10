#!/bin/bash
# Backup Verification Script
# Purpose: Automated verification of backup integrity and restorability
# Frequency: Daily (after backup completion)

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BUCKET="${S3_BUCKET:-hmis-backups}"
VERIFICATION_DB="${VERIFICATION_DB:-hmis_verify}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6380}"  # Use different port for verification

# Logging
LOG_FILE="${BACKUP_DIR}/verification.log"
REPORT_FILE="${BACKUP_DIR}/verification_report_$(date +%Y%m%d).txt"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

report() {
    echo "$1" | tee -a "$REPORT_FILE"
}

# Start verification report
cat > "$REPORT_FILE" <<EOF
=====================================
HMIS Backup Verification Report
Date: $(date)
=====================================

EOF

log "=== Starting Backup Verification ==="

# Verification counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to run a check
run_check() {
    local check_name="$1"
    local check_command="$2"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log "Running check: $check_name"

    if eval "$check_command"; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        report "✓ PASS: $check_name"
        return 0
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        report "✗ FAIL: $check_name"
        return 1
    fi
}

# ============================================
# PostgreSQL Backup Verification
# ============================================

report ""
report "PostgreSQL Backups:"
report "-------------------"

# Check 1: Local PostgreSQL backups exist
run_check "PostgreSQL local backups exist" \
    "[ -n \"\$(find ${BACKUP_DIR}/postgres -name 'hmis_backup_*.tar.gz' -mtime -2 2>/dev/null)\" ]"

# Check 2: S3 PostgreSQL backups exist
if command -v aws &> /dev/null; then
    run_check "PostgreSQL S3 backups exist" \
        "aws s3 ls s3://${S3_BUCKET}/postgres/ | grep -q hmis_backup"
else
    log "Skipping S3 check (AWS CLI not available)"
fi

# Check 3: Latest PostgreSQL backup integrity
LATEST_PG_BACKUP=$(find "${BACKUP_DIR}/postgres" -name "hmis_backup_*.tar.gz" -mtime -2 | sort -r | head -n 1)
if [ -n "$LATEST_PG_BACKUP" ]; then
    BACKUP_NAME=$(basename "$LATEST_PG_BACKUP" .tar.gz)

    # Check 3a: Checksum verification
    if [ -f "${LATEST_PG_BACKUP}.sha256" ]; then
        run_check "PostgreSQL backup checksum valid" \
            "cd ${BACKUP_DIR}/postgres && sha256sum -c ${BACKUP_NAME}.tar.gz.sha256 >/dev/null 2>&1"
    fi

    # Check 3b: Archive can be extracted
    run_check "PostgreSQL backup can be extracted" \
        "tar -tzf ${LATEST_PG_BACKUP} >/dev/null 2>&1"

    # Check 3c: Dump file exists in archive
    run_check "PostgreSQL dump file exists in backup" \
        "tar -tzf ${LATEST_PG_BACKUP} | grep -q 'full_dump_.*\.dump'"

    # Check 3d: Test restore to verification database (OPTIONAL - resource intensive)
    if [ "${VERIFY_RESTORE:-false}" = "true" ]; then
        log "Performing test restore to verification database..."

        # Create verification database
        PGPASSWORD="${POSTGRES_PASSWORD}" psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d postgres \
            -c "DROP DATABASE IF EXISTS ${VERIFICATION_DB};" >/dev/null 2>&1

        PGPASSWORD="${POSTGRES_PASSWORD}" psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d postgres \
            -c "CREATE DATABASE ${VERIFICATION_DB};" >/dev/null 2>&1

        # Extract and restore
        TEMP_EXTRACT="/tmp/verify_pg_$$"
        mkdir -p "$TEMP_EXTRACT"
        tar -xzf "$LATEST_PG_BACKUP" -C "$TEMP_EXTRACT"

        DUMP_FILE=$(find "$TEMP_EXTRACT" -name "full_dump_*.dump" | head -n 1)
        if [ -f "$DUMP_FILE" ]; then
            PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
                -h "$POSTGRES_HOST" \
                -p "$POSTGRES_PORT" \
                -U "$POSTGRES_USER" \
                -d "$VERIFICATION_DB" \
                --no-owner \
                --no-acl \
                "$DUMP_FILE" >/dev/null 2>&1

            run_check "PostgreSQL test restore successful" \
                "PGPASSWORD=\${POSTGRES_PASSWORD} psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $VERIFICATION_DB -c 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';' | grep -q '[1-9]'"
        fi

        # Cleanup
        rm -rf "$TEMP_EXTRACT"
        PGPASSWORD="${POSTGRES_PASSWORD}" psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d postgres \
            -c "DROP DATABASE IF EXISTS ${VERIFICATION_DB};" >/dev/null 2>&1
    fi

    # Check backup size (should be > 1MB for a real database)
    BACKUP_SIZE=$(stat -f%z "$LATEST_PG_BACKUP" 2>/dev/null || stat -c%s "$LATEST_PG_BACKUP" 2>/dev/null)
    run_check "PostgreSQL backup size > 1MB" \
        "[ ${BACKUP_SIZE:-0} -gt 1048576 ]"
fi

# ============================================
# Redis Backup Verification
# ============================================

report ""
report "Redis Backups:"
report "--------------"

# Check 4: Local Redis backups exist
run_check "Redis local backups exist" \
    "[ -n \"\$(find ${BACKUP_DIR}/redis -name 'redis_backup_*.tar.gz' -mtime -2 2>/dev/null)\" ]"

# Check 5: S3 Redis backups exist
if command -v aws &> /dev/null; then
    run_check "Redis S3 backups exist" \
        "aws s3 ls s3://${S3_BUCKET}/redis/ | grep -q redis_backup"
fi

# Check 6: Latest Redis backup integrity
LATEST_REDIS_BACKUP=$(find "${BACKUP_DIR}/redis" -name "redis_backup_*.tar.gz" -mtime -2 | sort -r | head -n 1)
if [ -n "$LATEST_REDIS_BACKUP" ]; then
    BACKUP_NAME=$(basename "$LATEST_REDIS_BACKUP" .tar.gz)

    # Check 6a: Checksum verification
    if [ -f "${LATEST_REDIS_BACKUP}.sha256" ]; then
        run_check "Redis backup checksum valid" \
            "cd ${BACKUP_DIR}/redis && sha256sum -c ${BACKUP_NAME}.tar.gz.sha256 >/dev/null 2>&1"
    fi

    # Check 6b: Archive can be extracted
    run_check "Redis backup can be extracted" \
        "tar -tzf ${LATEST_REDIS_BACKUP} >/dev/null 2>&1"

    # Check 6c: RDB file exists
    run_check "Redis RDB file exists in backup" \
        "tar -tzf ${LATEST_REDIS_BACKUP} | grep -q 'dump_.*\.rdb'"

    # Check backup size
    BACKUP_SIZE=$(stat -f%z "$LATEST_REDIS_BACKUP" 2>/dev/null || stat -c%s "$LATEST_REDIS_BACKUP" 2>/dev/null)
    run_check "Redis backup size > 100KB" \
        "[ ${BACKUP_SIZE:-0} -gt 102400 ]"
fi

# ============================================
# S3 Cross-Region Replication Verification
# ============================================

if command -v aws &> /dev/null; then
    report ""
    report "S3 Replication:"
    report "---------------"

    # Check 7: Replication rules configured
    run_check "S3 bucket has replication rules" \
        "aws s3api get-bucket-replication --bucket ${S3_BUCKET} >/dev/null 2>&1"

    # Check 8: Versioning enabled
    run_check "S3 bucket versioning enabled" \
        "aws s3api get-bucket-versioning --bucket ${S3_BUCKET} | grep -q '\"Status\": \"Enabled\"'"
fi

# ============================================
# Backup Age Verification
# ============================================

report ""
report "Backup Freshness:"
report "-----------------"

# Check 9: PostgreSQL backup is recent (< 25 hours)
if [ -n "$LATEST_PG_BACKUP" ]; then
    BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -f%m "$LATEST_PG_BACKUP" 2>/dev/null || stat -c%Y "$LATEST_PG_BACKUP")) / 3600 ))
    run_check "PostgreSQL backup age < 25 hours (current: ${BACKUP_AGE_HOURS}h)" \
        "[ ${BACKUP_AGE_HOURS} -lt 25 ]"
fi

# Check 10: Redis backup is recent (< 2 hours)
if [ -n "$LATEST_REDIS_BACKUP" ]; then
    BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -f%m "$LATEST_REDIS_BACKUP" 2>/dev/null || stat -c%Y "$LATEST_REDIS_BACKUP")) / 3600 ))
    run_check "Redis backup age < 2 hours (current: ${BACKUP_AGE_HOURS}h)" \
        "[ ${BACKUP_AGE_HOURS} -lt 2 ]"
fi

# ============================================
# Disk Space Verification
# ============================================

report ""
report "Disk Space:"
report "-----------"

# Check 11: Backup directory has sufficient space (> 10GB free)
DISK_FREE=$(df -BG "$BACKUP_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
run_check "Backup directory has > 10GB free (current: ${DISK_FREE}GB)" \
    "[ ${DISK_FREE:-0} -gt 10 ]"

# ============================================
# Generate Summary
# ============================================

report ""
report "====================================="
report "Verification Summary:"
report "-------------------------------------"
report "Total Checks: ${TOTAL_CHECKS}"
report "Passed: ${PASSED_CHECKS}"
report "Failed: ${FAILED_CHECKS}"
report "====================================="

if [ $FAILED_CHECKS -eq 0 ]; then
    report ""
    report "✓ ALL CHECKS PASSED - Backups are healthy"
    log "=== Verification completed successfully ==="
    EXIT_CODE=0
else
    report ""
    report "✗ VERIFICATION FAILED - Action required!"
    report ""
    report "Please review failed checks above and take corrective action."
    log "=== Verification completed with failures ==="
    EXIT_CODE=1
fi

# Send notification
if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
    SUBJECT="HMIS Backup Verification - "
    if [ $FAILED_CHECKS -eq 0 ]; then
        SUBJECT="${SUBJECT}Success (${PASSED_CHECKS}/${TOTAL_CHECKS})"
    else
        SUBJECT="${SUBJECT}FAILURE (${FAILED_CHECKS} failed)"
    fi

    cat "$REPORT_FILE" | mail -s "$SUBJECT" "$NOTIFICATION_EMAIL" 2>/dev/null || true
fi

log "Verification report: $REPORT_FILE"
exit $EXIT_CODE
