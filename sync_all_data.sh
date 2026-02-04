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
log "Starting unified dashboard sync (optimized)"
log "========================================="

SYNC_START=$(date +%s)
SYNC_ERRORS=0
SYNC_WARNINGS=0

# Sync Devices data
log "📥 [1/6] Syncing Devices data..."
TASK_START=$(date +%s)
if bash "$SCRIPT_DIR/sync_from_gdrive.sh" > "$TEMP_DIR/devices.log" 2>&1; then
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Devices sync"
    log "✅ Devices sync completed"
else
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Devices sync (FAILED)"
    log "❌ Devices sync failed - check $TEMP_DIR/devices.log"
    cat "$TEMP_DIR/devices.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Sync Software data
log "📥 [2/6] Syncing Software data..."
TASK_START=$(date +%s)
if bash "$SCRIPT_DIR/sync_software.sh" > "$TEMP_DIR/software.log" 2>&1; then
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Software sync"
    log "✅ Software sync completed"
else
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Software sync (FAILED)"
    log "❌ Software sync failed - check $TEMP_DIR/software.log"
    cat "$TEMP_DIR/software.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Sync Systems data
log "📥 [3/6] Syncing Systems data..."
TASK_START=$(date +%s)
if bash "$SCRIPT_DIR/sync_systems.sh" > "$TEMP_DIR/systems.log" 2>&1; then
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Systems sync"
    log "✅ Systems sync completed"
else
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Systems sync (FAILED)"
    log "❌ Systems sync failed - check $TEMP_DIR/systems.log"
    cat "$TEMP_DIR/systems.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Sync Decisions data
log "📥 [4/6] Syncing Decisions data..."
TASK_START=$(date +%s)
if bash "$SCRIPT_DIR/sync_decisions.sh" > "$TEMP_DIR/decisions.log" 2>&1; then
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Decisions sync"
    log "✅ Decisions sync completed"
else
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Decisions sync (FAILED)"
    log "❌ Decisions sync failed - check $TEMP_DIR/decisions.log"
    cat "$TEMP_DIR/decisions.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Sync Milestones data
log "📥 [5/6] Syncing Milestones data..."
TASK_START=$(date +%s)
if bash "$SCRIPT_DIR/sync_milestones.sh" > "$TEMP_DIR/milestones.log" 2>&1; then
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Milestones sync"
    log "✅ Milestones sync completed"
else
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Milestones sync (FAILED)"
    log "❌ Milestones sync failed - check $TEMP_DIR/milestones.log"
    cat "$TEMP_DIR/milestones.log" >> "$LOG_FILE"
    ((SYNC_ERRORS++))
fi

# Sync Upcoming Reviews data
log "📥 [6/6] Syncing Upcoming Reviews data..."
TASK_START=$(date +%s)
if bash "$SCRIPT_DIR/sync_upcoming_reviews.sh" > "$TEMP_DIR/upcoming_reviews.log" 2>&1; then
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Upcoming Reviews sync"
    log "✅ Upcoming Reviews sync completed"
else
    TASK_END=$(date +%s)
    log_timing $TASK_START $TASK_END "Upcoming Reviews sync (FAILED)"
    log "❌ Upcoming Reviews sync failed - check $TEMP_DIR/upcoming_reviews.log"
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
