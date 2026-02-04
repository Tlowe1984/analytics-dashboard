#!/bin/bash
# Optimized unified sync script for all dashboard data sources
# Runs daily at 6 AM via Node.js cron scheduler
# Improvements: Better error handling, parallel execution where safe, detailed timing

set -euo pipefail  # Strict error handling

SCRIPT_DIR="/home/ubuntu/analytics-dashboard"
LOG_FILE="$SCRIPT_DIR/.manus-logs/sync.log"
TEMP_DIR="$SCRIPT_DIR/.manus-logs/sync_temp"

# Create directories if they don't exist
mkdir -p "$SCRIPT_DIR/.manus-logs"
mkdir -p "$TEMP_DIR"

# Function to log messages with timestamps
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to log timing
log_timing() {
    local start=$1
    local end=$2
    local task=$3
    local duration=$((end - start))
    log "⏱️  $task completed in ${duration}s"
}

# Trap errors and log them
trap 'log "❌ ERROR: Script failed at line $LINENO"' ERR

log "========================================="
log "Starting unified dashboard sync (parallel optimized)"
log "========================================="

SYNC_START=$(date +%s)
SYNC_ERRORS=0
SYNC_WARNINGS=0

# Run all independent syncs in parallel for maximum speed
log "📥 Starting all syncs in parallel..."

# Start all syncs in background
bash "$SCRIPT_DIR/sync_from_gdrive.sh" > "$TEMP_DIR/devices.log" 2>&1 &
PID_DEVICES=$!

bash "$SCRIPT_DIR/sync_software.sh" > "$TEMP_DIR/software.log" 2>&1 &
PID_SOFTWARE=$!

bash "$SCRIPT_DIR/sync_systems.sh" > "$TEMP_DIR/systems.log" 2>&1 &
PID_SYSTEMS=$!

bash "$SCRIPT_DIR/sync_decisions.sh" > "$TEMP_DIR/decisions.log" 2>&1 &
PID_DECISIONS=$!

bash "$SCRIPT_DIR/sync_milestones.sh" > "$TEMP_DIR/milestones.log" 2>&1 &
PID_MILESTONES=$!

bash "$SCRIPT_DIR/sync_upcoming_reviews.sh" > "$TEMP_DIR/upcoming_reviews.log" 2>&1 &
PID_REVIEWS=$!

# Wait for all syncs to complete and check results
log "⏳ Waiting for all syncs to complete..."

# Check Devices sync
if wait $PID_DEVICES; then
    log "✅ [1/6] Devices sync completed"
else
    log "❌ [1/6] Devices sync failed - check $TEMP_DIR/devices.log"
    cat "$TEMP_DIR/devices.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Check Software sync
if wait $PID_SOFTWARE; then
    log "✅ [2/6] Software sync completed"
else
    log "❌ [2/6] Software sync failed - check $TEMP_DIR/software.log"
    cat "$TEMP_DIR/software.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Check Systems sync
if wait $PID_SYSTEMS; then
    log "✅ [3/6] Systems sync completed"
else
    log "❌ [3/6] Systems sync failed - check $TEMP_DIR/systems.log"
    cat "$TEMP_DIR/systems.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Check Decisions sync
if wait $PID_DECISIONS; then
    log "✅ [4/6] Decisions sync completed"
else
    log "❌ [4/6] Decisions sync failed - check $TEMP_DIR/decisions.log"
    cat "$TEMP_DIR/decisions.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Check Milestones sync
if wait $PID_MILESTONES; then
    log "✅ [5/6] Milestones sync completed"
else
    log "❌ [5/6] Milestones sync failed - check $TEMP_DIR/milestones.log"
    cat "$TEMP_DIR/milestones.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Check Upcoming Reviews sync
if wait $PID_REVIEWS; then
    log "✅ [6/6] Upcoming Reviews sync completed"
else
    log "❌ [6/6] Upcoming Reviews sync failed - check $TEMP_DIR/upcoming_reviews.log"
    cat "$TEMP_DIR/upcoming_reviews.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Calculate total time
SYNC_END=$(date +%s)
TOTAL_DURATION=$((SYNC_END - SYNC_START))

# Summary
log "========================================="
log "📊 Sync Summary:"
log "   Total duration: ${TOTAL_DURATION}s"
log "   Errors: $SYNC_ERRORS"
log "   Warnings: $SYNC_WARNINGS"

if [ $SYNC_ERRORS -eq 0 ]; then
    log "✅ All syncs completed successfully!"
    log "========================================="
    # Clean up temp logs on success
    rm -rf "$TEMP_DIR"
    exit 0
else
    log "⚠️  Sync completed with $SYNC_ERRORS error(s)"
    log "   Detailed logs available in: $TEMP_DIR/"
    log "========================================="
    exit 1
fi
