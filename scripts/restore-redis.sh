#!/bin/bash
# Redis Restore Script
# Purpose: Restore Redis data from RDB/AOF backup
# Target: RTO 5 minutes

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/redis}"
S3_BUCKET="${S3_BUCKET:-hmis-backups}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/var/lib/redis}"

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
    -f, --force                Skip confirmation prompt
    -h, --help                 Show this help message

Examples:
    # Restore from local backup
    $0 --backup-name redis_backup_20260209_120000

    # Restore from S3
    $0 --backup-name redis_backup_20260209_120000 --from-s3
EOF
    exit 1
}

# Parse arguments
BACKUP_NAME=""
FROM_S3=false
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

log "=== Redis Restore Process Starting ==="
log "Backup: ${BACKUP_NAME}"
log "Host: ${REDIS_HOST}:${REDIS_PORT}"

# Build redis-cli command
REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="$REDIS_CLI -a $REDIS_PASSWORD"
fi

# Step 1: Download from S3 if requested
if [ "$FROM_S3" = true ]; then
    if ! command -v aws &> /dev/null; then
        log "ERROR: AWS CLI not found, cannot download from S3"
        exit 1
    fi

    log "Downloading backup from S3..."
    aws s3 cp "s3://${S3_BUCKET}/redis/${BACKUP_NAME}.tar.gz" "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    aws s3 cp "s3://${S3_BUCKET}/redis/${BACKUP_NAME}.tar.gz.sha256" "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.sha256"
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
    # Get current keyspace info
    CURRENT_KEYS=$($REDIS_CLI DBSIZE 2>/dev/null || echo "0")

    echo ""
    echo "WARNING: This will REPLACE all Redis data!"
    echo "Redis: ${REDIS_HOST}:${REDIS_PORT}"
    echo "Current keys: ${CURRENT_KEYS}"
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

# Step 6: Flush current Redis data
log "Flushing current Redis data..."
$REDIS_CLI FLUSHALL 2>&1 | tee -a "$LOG_FILE"

# Step 7: Shutdown Redis (for file replacement)
log "Saving current Redis data and preparing for restore..."
$REDIS_CLI SAVE 2>&1 | tee -a "$LOG_FILE"

log "Shutting down Redis..."
$REDIS_CLI SHUTDOWN SAVE 2>&1 | tee -a "$LOG_FILE" || true

# Wait for Redis to shutdown
sleep 3

# Step 8: Replace RDB file
RDB_BACKUP=$(find "$EXTRACT_DIR" -name "dump_*.rdb" | head -n 1)
if [ -f "$RDB_BACKUP" ]; then
    log "Replacing RDB file..."

    # Backup current RDB (just in case)
    if [ -f "${REDIS_DATA_DIR}/dump.rdb" ]; then
        cp "${REDIS_DATA_DIR}/dump.rdb" "${REDIS_DATA_DIR}/dump.rdb.backup.$(date +%s)"
    fi

    # Copy new RDB
    cp "$RDB_BACKUP" "${REDIS_DATA_DIR}/dump.rdb"
    chown redis:redis "${REDIS_DATA_DIR}/dump.rdb" 2>/dev/null || true
    chmod 644 "${REDIS_DATA_DIR}/dump.rdb"

    log "RDB file replaced successfully"
else
    log "WARNING: RDB file not found in backup"
fi

# Step 9: Replace AOF file (if exists)
AOF_BACKUP=$(find "$EXTRACT_DIR" -name "appendonly_*.aof" | head -n 1)
if [ -f "$AOF_BACKUP" ]; then
    log "Replacing AOF file..."

    # Backup current AOF
    if [ -f "${REDIS_DATA_DIR}/appendonly.aof" ]; then
        cp "${REDIS_DATA_DIR}/appendonly.aof" "${REDIS_DATA_DIR}/appendonly.aof.backup.$(date +%s)"
    fi

    # Copy new AOF
    cp "$AOF_BACKUP" "${REDIS_DATA_DIR}/appendonly.aof"
    chown redis:redis "${REDIS_DATA_DIR}/appendonly.aof" 2>/dev/null || true
    chmod 644 "${REDIS_DATA_DIR}/appendonly.aof"

    log "AOF file replaced successfully"
fi

# Step 10: Start Redis
log "Starting Redis..."
if command -v systemctl &> /dev/null; then
    systemctl start redis 2>&1 | tee -a "$LOG_FILE"
elif command -v service &> /dev/null; then
    service redis start 2>&1 | tee -a "$LOG_FILE"
else
    log "WARNING: Could not detect init system, please start Redis manually"
fi

# Wait for Redis to start
log "Waiting for Redis to start..."
for i in {1..30}; do
    if $REDIS_CLI PING &>/dev/null; then
        log "Redis is online"
        break
    fi
    sleep 1
done

# Step 11: Verify restore
log "Verifying restore..."
RESTORED_KEYS=$($REDIS_CLI DBSIZE 2>/dev/null || echo "0")
log "Keys restored: ${RESTORED_KEYS}"

if [ "$RESTORED_KEYS" -gt 0 ]; then
    log "=== Restore completed successfully ==="
else
    log "WARNING: No keys found after restore"
fi

# Step 12: Display Redis INFO
log "Redis INFO:"
$REDIS_CLI INFO KEYSPACE 2>&1 | tee -a "$LOG_FILE"

# Step 13: Clean up extracted files
log "Cleaning up temporary files..."
rm -rf "$EXTRACT_DIR"

# Step 14: Send notification
if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
    echo "Redis restore completed: ${BACKUP_NAME} (${RESTORED_KEYS} keys)" | \
    mail -s "HMIS Redis Restore Success" "$NOTIFICATION_EMAIL" 2>/dev/null || true
fi

exit 0
