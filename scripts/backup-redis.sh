#!/bin/bash
# Redis Backup Script with AOF + RDB Snapshots
# Purpose: Automated Redis backups with dual persistence
# Target: RPO 5 minutes

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/redis}"
S3_BUCKET="${S3_BUCKET:-hmis-backups}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="redis_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Logging
LOG_FILE="${BACKUP_DIR}/backup.log"
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_PATH"

log "Starting Redis backup: ${BACKUP_NAME}"

# Build redis-cli command
REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="$REDIS_CLI -a $REDIS_PASSWORD"
fi

# Step 1: Trigger BGSAVE (background save)
log "Triggering Redis BGSAVE..."
$REDIS_CLI BGSAVE 2>&1 | tee -a "$LOG_FILE"

# Wait for BGSAVE to complete
log "Waiting for BGSAVE to complete..."
while true; do
    SAVE_STATUS=$($REDIS_CLI LASTSAVE)
    sleep 2
    NEW_SAVE_STATUS=$($REDIS_CLI LASTSAVE)
    if [ "$SAVE_STATUS" != "$NEW_SAVE_STATUS" ]; then
        log "BGSAVE completed"
        break
    fi
    sleep 1
done

# Step 2: Copy RDB file
log "Copying RDB snapshot..."
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/var/lib/redis}"
RDB_FILE="${REDIS_DATA_DIR}/dump.rdb"

if [ -f "$RDB_FILE" ]; then
    cp "$RDB_FILE" "${BACKUP_PATH}/dump_${TIMESTAMP}.rdb"
    log "RDB file copied successfully"
else
    log "WARNING: RDB file not found at $RDB_FILE"
fi

# Step 3: Copy AOF file (if exists)
AOF_FILE="${REDIS_DATA_DIR}/appendonly.aof"
if [ -f "$AOF_FILE" ]; then
    log "Copying AOF file..."
    cp "$AOF_FILE" "${BACKUP_PATH}/appendonly_${TIMESTAMP}.aof"
    log "AOF file copied successfully"
else
    log "WARNING: AOF file not found (AOF might be disabled)"
fi

# Step 4: Save Redis configuration
log "Saving Redis configuration..."
$REDIS_CLI CONFIG GET "*" > "${BACKUP_PATH}/redis_config_${TIMESTAMP}.txt"

# Step 5: Export Redis INFO
log "Exporting Redis INFO..."
$REDIS_CLI INFO ALL > "${BACKUP_PATH}/redis_info_${TIMESTAMP}.txt"

# Step 6: Export keyspace statistics
log "Exporting keyspace statistics..."
$REDIS_CLI INFO KEYSPACE > "${BACKUP_PATH}/redis_keyspace_${TIMESTAMP}.txt"

# Step 7: Create backup manifest
cat > "${BACKUP_PATH}/manifest.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "host": "${REDIS_HOST}",
  "port": ${REDIS_PORT},
  "backup_type": "full",
  "files": {
    "rdb": "dump_${TIMESTAMP}.rdb",
    "aof": "appendonly_${TIMESTAMP}.aof",
    "config": "redis_config_${TIMESTAMP}.txt",
    "info": "redis_info_${TIMESTAMP}.txt"
  }
}
EOF

# Step 8: Compress backup
log "Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
log "Backup compressed: ${BACKUP_SIZE}"

# Step 9: Calculate checksum
log "Calculating checksum..."
sha256sum "${BACKUP_NAME}.tar.gz" > "${BACKUP_NAME}.tar.gz.sha256"
CHECKSUM=$(cat "${BACKUP_NAME}.tar.gz.sha256")

# Step 10: Upload to S3 (if AWS CLI is available)
if command -v aws &> /dev/null; then
    log "Uploading backup to S3: s3://${S3_BUCKET}/redis/${BACKUP_NAME}.tar.gz"
    aws s3 cp "${BACKUP_NAME}.tar.gz" "s3://${S3_BUCKET}/redis/${BACKUP_NAME}.tar.gz" \
        --storage-class STANDARD_IA \
        --metadata "timestamp=${TIMESTAMP},size=${BACKUP_SIZE}" 2>&1 | tee -a "$LOG_FILE"

    aws s3 cp "${BACKUP_NAME}.tar.gz.sha256" "s3://${S3_BUCKET}/redis/${BACKUP_NAME}.tar.gz.sha256" 2>&1 | tee -a "$LOG_FILE"

    log "Backup uploaded to S3 successfully"
else
    log "WARNING: AWS CLI not found, skipping S3 upload"
fi

# Step 11: Clean up old backups
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "redis_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "redis_backup_*" -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

# Step 12: Remove uncompressed backup directory
rm -rf "$BACKUP_PATH"

log "Backup completed successfully: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Step 13: Send notification (optional)
if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
    echo "Redis backup completed: ${BACKUP_NAME}" | \
    mail -s "HMIS Redis Backup Success - ${TIMESTAMP}" "$NOTIFICATION_EMAIL" 2>/dev/null || true
fi

log "=== Redis backup process completed ==="
exit 0
