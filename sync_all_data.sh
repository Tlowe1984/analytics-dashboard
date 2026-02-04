#!/bin/bash
# Unified sync script for all dashboard data sources
# Runs daily at 6 AM via Node.js cron scheduler

set -e

SCRIPT_DIR="/home/ubuntu/analytics-dashboard"
LOG_FILE="$SCRIPT_DIR/.manus-logs/sync.log"

# Create log directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/.manus-logs"

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Starting unified dashboard sync"
log "========================================="

# Track sync status
SYNC_ERRORS=0

# Sync Devices data
log "📥 Syncing Devices data..."
if bash "$SCRIPT_DIR/sync_from_gdrive.sh" >> "$LOG_FILE" 2>&1; then
    log "✅ Devices sync completed"
else
    log "❌ Devices sync failed"
    ((SYNC_ERRORS++))
fi

# Sync Software data
log "📥 Syncing Software data..."
if bash "$SCRIPT_DIR/sync_software.sh" >> "$LOG_FILE" 2>&1; then
    log "✅ Software sync completed"
else
    log "❌ Software sync failed"
    ((SYNC_ERRORS++))
fi

# Sync Systems data
log "📥 Syncing Systems data..."
if bash "$SCRIPT_DIR/sync_systems.sh" >> "$LOG_FILE" 2>&1; then
    log "✅ Systems sync completed"
else
    log "❌ Systems sync failed"
    ((SYNC_ERRORS++))
fi

# Sync Decisions data
log "📥 Syncing Decisions data..."
if bash "$SCRIPT_DIR/sync_decisions.sh" >> "$LOG_FILE" 2>&1; then
    log "✅ Decisions sync completed"
else
    log "❌ Decisions sync failed"
    ((SYNC_ERRORS++))
fi

# Summary
log "========================================="
if [ $SYNC_ERRORS -eq 0 ]; then
    log "✅ All syncs completed successfully!"
    log "========================================="
    exit 0
else
    log "⚠️  Sync completed with $SYNC_ERRORS error(s)"
    log "========================================="
    exit 1
fi
