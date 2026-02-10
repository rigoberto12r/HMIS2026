#!/bin/bash
# PostgreSQL Backup Script with WAL Archiving
# Purpose: Automated daily backups with point-in-time recovery capability
# Target: RPO 5 minutes, RTO 15 minutes

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
S3_BUCKET="${S3_BUCKET:-hmis-backups}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-hmis}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="hmis_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Logging
LOG_FILE="${BACKUP_DIR}/backup.log"
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting PostgreSQL backup: ${BACKUP_NAME}"

# Step 1: Create base backup using pg_basebackup
log "Creating base backup with pg_basebackup..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_basebackup \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -D "$BACKUP_PATH" \
    -Ft \
    -z \
    -Xs \
    -P \
    -v 2>&1 | tee -a "$LOG_FILE"

if [ $? -eq 0 ]; then
    log "Base backup completed successfully"
else
    log "ERROR: Base backup failed"
    exit 1
fi

# Step 2: Backup current database schema (SQL dump as fallback)
log "Creating SQL dump for schema backup..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --schema-only \
    --no-owner \
    --no-acl \
    -f "${BACKUP_PATH}/schema_${TIMESTAMP}.sql" 2>&1 | tee -a "$LOG_FILE"

# Step 3: Create full logical backup (for tenant schemas)
log "Creating full logical backup..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Fc \
    -f "${BACKUP_PATH}/full_dump_${TIMESTAMP}.dump" 2>&1 | tee -a "$LOG_FILE"

# Step 4: Compress backup
log "Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
log "Backup compressed: ${BACKUP_SIZE}"

# Step 5: Calculate checksum for integrity verification
log "Calculating checksum..."
sha256sum "${BACKUP_NAME}.tar.gz" > "${BACKUP_NAME}.tar.gz.sha256"
CHECKSUM=$(cat "${BACKUP_NAME}.tar.gz.sha256")
log "Checksum: ${CHECKSUM}"

# Step 6: Upload to S3 (if AWS CLI is available)
if command -v aws &> /dev/null; then
    log "Uploading backup to S3: s3://${S3_BUCKET}/postgres/${BACKUP_NAME}.tar.gz"
    aws s3 cp "${BACKUP_NAME}.tar.gz" "s3://${S3_BUCKET}/postgres/${BACKUP_NAME}.tar.gz" \
        --storage-class STANDARD_IA \
        --metadata "timestamp=${TIMESTAMP},size=${BACKUP_SIZE},checksum=${CHECKSUM}" 2>&1 | tee -a "$LOG_FILE"

    aws s3 cp "${BACKUP_NAME}.tar.gz.sha256" "s3://${S3_BUCKET}/postgres/${BACKUP_NAME}.tar.gz.sha256" 2>&1 | tee -a "$LOG_FILE"

    log "Backup uploaded to S3 successfully"
else
    log "WARNING: AWS CLI not found, skipping S3 upload"
fi

# Step 7: Clean up old local backups (keep last N days)
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "hmis_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "hmis_backup_*" -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

# Step 8: Remove uncompressed backup directory
rm -rf "$BACKUP_PATH"

# Step 9: Log final status
log "Backup completed successfully: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Step 10: Send notification (optional - requires SMTP config)
if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
    echo "PostgreSQL backup completed: ${BACKUP_NAME}" | \
    mail -s "HMIS Backup Success - ${TIMESTAMP}" "$NOTIFICATION_EMAIL" 2>/dev/null || true
fi

# Archive WAL files to S3 (for point-in-time recovery)
if command -v aws &> /dev/null; then
    WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/lib/postgresql/data/pg_wal}"
    if [ -d "$WAL_ARCHIVE_DIR" ]; then
        log "Archiving WAL files to S3..."
        find "$WAL_ARCHIVE_DIR" -type f -name "*.ready" | while read -r wal_file; do
            WAL_NAME=$(basename "$wal_file" .ready)
            if [ -f "${WAL_ARCHIVE_DIR}/${WAL_NAME}" ]; then
                aws s3 cp "${WAL_ARCHIVE_DIR}/${WAL_NAME}" "s3://${S3_BUCKET}/wal/${WAL_NAME}" 2>&1 | tee -a "$LOG_FILE"
            fi
        done
    fi
fi

log "=== Backup process completed ==="
exit 0
