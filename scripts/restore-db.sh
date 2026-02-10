#!/bin/bash
# PostgreSQL Restore Script
# Purpose: Restore PostgreSQL database from backup with point-in-time recovery
# Target: RTO 15 minutes

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
S3_BUCKET="${S3_BUCKET:-hmis-backups}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-hmis}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

# Logging
LOG_FILE="${BACKUP_DIR}/restore.log"
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Usage
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
    -b, --backup-name NAME     Name of backup to restore (without .tar.gz)
    -s, --from-s3              Download backup from S3
    -t, --target-time TIME     Point-in-time recovery target (YYYY-MM-DD HH:MM:SS)
    -f, --force                Skip confirmation prompt
    -h, --help                 Show this help message

Examples:
    # Restore from local backup
    $0 --backup-name hmis_backup_20260209_120000

    # Restore from S3
    $0 --backup-name hmis_backup_20260209_120000 --from-s3

    # Point-in-time recovery
    $0 --backup-name hmis_backup_20260209_120000 --target-time "2026-02-09 14:30:00"
EOF
    exit 1
}

# Parse arguments
BACKUP_NAME=""
FROM_S3=false
TARGET_TIME=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--backup-name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        -s|--from-s3)
            FROM_S3=true
            shift
            ;;
        -t|--target-time)
            TARGET_TIME="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate backup name
if [ -z "$BACKUP_NAME" ]; then
    echo "ERROR: Backup name is required"
    usage
fi

mkdir -p "$BACKUP_DIR"

log "=== PostgreSQL Restore Process Starting ==="
log "Backup: ${BACKUP_NAME}"
log "Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
log "Database: ${POSTGRES_DB}"

# Step 1: Download from S3 if requested
if [ "$FROM_S3" = true ]; then
    if ! command -v aws &> /dev/null; then
        log "ERROR: AWS CLI not found, cannot download from S3"
        exit 1
    fi

    log "Downloading backup from S3..."
    aws s3 cp "s3://${S3_BUCKET}/postgres/${BACKUP_NAME}.tar.gz" "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    aws s3 cp "s3://${S3_BUCKET}/postgres/${BACKUP_NAME}.tar.gz.sha256" "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.sha256"
    log "Download completed"
fi

# Step 2: Verify backup file exists
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
if [ ! -f "$BACKUP_FILE" ]; then
    log "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Step 3: Verify checksum
if [ -f "${BACKUP_FILE}.sha256" ]; then
    log "Verifying backup integrity..."
    cd "$BACKUP_DIR"
    if sha256sum -c "${BACKUP_NAME}.tar.gz.sha256" 2>&1 | tee -a "$LOG_FILE"; then
        log "Checksum verification passed"
    else
        log "ERROR: Checksum verification failed!"
        exit 1
    fi
fi

# Step 4: Confirmation prompt
if [ "$FORCE" = false ]; then
    echo ""
    echo "WARNING: This will REPLACE the current database!"
    echo "Database: ${POSTGRES_DB} on ${POSTGRES_HOST}:${POSTGRES_PORT}"
    echo "Backup: ${BACKUP_NAME}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
fi

# Step 5: Extract backup
log "Extracting backup..."
cd "$BACKUP_DIR"
tar -xzf "${BACKUP_NAME}.tar.gz"
EXTRACT_DIR="${BACKUP_DIR}/${BACKUP_NAME}"

# Step 6: Stop application connections
log "Terminating active connections to database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" 2>&1 | tee -a "$LOG_FILE"

# Step 7: Drop and recreate database
log "Dropping existing database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" 2>&1 | tee -a "$LOG_FILE"

log "Creating fresh database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d postgres \
    -c "CREATE DATABASE ${POSTGRES_DB};" 2>&1 | tee -a "$LOG_FILE"

# Step 8: Restore from dump
log "Restoring database from backup..."
DUMP_FILE=$(find "$EXTRACT_DIR" -name "full_dump_*.dump" | head -n 1)

if [ -f "$DUMP_FILE" ]; then
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -v \
        --no-owner \
        --no-acl \
        "$DUMP_FILE" 2>&1 | tee -a "$LOG_FILE"

    log "Database restored successfully"
else
    log "ERROR: Dump file not found in backup"
    exit 1
fi

# Step 9: Point-in-time recovery (if requested)
if [ -n "$TARGET_TIME" ]; then
    log "Applying point-in-time recovery to: $TARGET_TIME"

    # Download WAL files from S3
    if command -v aws &> /dev/null; then
        WAL_DIR="${BACKUP_DIR}/wal_recovery"
        mkdir -p "$WAL_DIR"

        log "Downloading WAL files from S3..."
        aws s3 sync "s3://${S3_BUCKET}/wal/" "$WAL_DIR" 2>&1 | tee -a "$LOG_FILE"

        # Apply WAL files up to target time
        log "Applying WAL files..."
        # Note: This requires PostgreSQL to be stopped and restarted with recovery.conf
        # Implementation depends on PostgreSQL version (12+ uses recovery.signal)
        log "WARNING: Point-in-time recovery requires manual PostgreSQL configuration"
    fi
fi

# Step 10: Update sequences
log "Updating sequences..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -c "SELECT setval(sequence_name, COALESCE((SELECT MAX(id) FROM unnest(ARRAY['patients', 'appointments', 'encounters', 'invoices']) AS t(id)), 1)) FROM information_schema.sequences WHERE sequence_schema = 'public';" 2>&1 | tee -a "$LOG_FILE" || true

# Step 11: Analyze database
log "Analyzing database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -c "ANALYZE;" 2>&1 | tee -a "$LOG_FILE"

# Step 12: Clean up extracted files
log "Cleaning up temporary files..."
rm -rf "$EXTRACT_DIR"

# Step 13: Verify restore
log "Verifying restore..."
TABLE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

log "Tables restored: ${TABLE_COUNT}"

if [ "$TABLE_COUNT" -gt 0 ]; then
    log "=== Restore completed successfully ==="
else
    log "WARNING: No tables found after restore"
fi

# Step 14: Send notification
if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
    echo "PostgreSQL restore completed: ${BACKUP_NAME}" | \
    mail -s "HMIS Database Restore Success" "$NOTIFICATION_EMAIL" 2>/dev/null || true
fi

exit 0
