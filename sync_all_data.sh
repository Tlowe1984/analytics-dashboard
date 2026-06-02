#!/bin/bash
# Optimized unified sync script for all dashboard data sources
# Runs daily at 6 AM via Node.js cron scheduler
# Improvements: Better error handling, parallel execution where safe, detailed timing

set -euo pipefail  # Strict error handling

SCRIPT_DIR="/home/ubuntu/analytics-dashboard"

# Load environment variables from .env file so sub-scripts can connect to DB
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

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
log "Starting unified dashboard sync (parallel optimized - 8 data sources)"
log "========================================="

SYNC_START=$(date +%s)
SYNC_ERRORS=0
SYNC_WARNINGS=0

# Run all independent syncs in parallel for maximum speed
log "📥 Starting all syncs in parallel..."

# Start all syncs in background with auto-fix wrapper
bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_from_gdrive.sh" "Devices" > "$TEMP_DIR/devices.log" 2>&1 &
PID_DEVICES=$!

bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_software.sh" "Software" > "$TEMP_DIR/software.log" 2>&1 &
PID_SOFTWARE=$!

bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_systems.sh" "Systems" > "$TEMP_DIR/systems.log" 2>&1 &
PID_SYSTEMS=$!

bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_decisions.sh" "Decisions" > "$TEMP_DIR/decisions.log" 2>&1 &
PID_DECISIONS=$!

bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_milestones.sh" "Milestones" > "$TEMP_DIR/milestones.log" 2>&1 &
PID_MILESTONES=$!

bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_upcoming_reviews.sh" "Upcoming Reviews" > "$TEMP_DIR/upcoming_reviews.log" 2>&1 &
PID_REVIEWS=$!

bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_ai.sh" "AI" > "$TEMP_DIR/ai.log" 2>&1 &
PID_AI=$!

bash "$SCRIPT_DIR/sync_with_auto_fix.sh" "$SCRIPT_DIR/sync_hearing.sh" "Hearing" > "$TEMP_DIR/hearing.log" 2>&1 &
PID_HEARING=$!

# Wait for all syncs to complete and check results
log "⏳ Waiting for all syncs to complete..."

# Check Devices sync
if wait $PID_DEVICES; then
    log "✅ [1/8] Devices sync completed"
else
    log "❌ [1/8] Devices sync failed - check $TEMP_DIR/devices.log"
    cat "$TEMP_DIR/devices.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
fi

# Check Software sync
if wait $PID_SOFTWARE; then
    log "✅ [2/8] Software sync completed"
else
    log "❌ [2/8] Software sync failed - check $TEMP_DIR/software.log"
    cat "$TEMP_DIR/software.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
fi

# Check Systems sync
if wait $PID_SYSTEMS; then
    log "✅ [3/8] Systems sync completed"
else
    log "❌ [3/8] Systems sync failed - check $TEMP_DIR/systems.log"
    cat "$TEMP_DIR/systems.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
fi

# Check Decisions sync
if wait $PID_DECISIONS; then
    log "✅ [4/8] Decisions sync completed"
else
    log "❌ [4/8] Decisions sync failed - check $TEMP_DIR/decisions.log"
    cat "$TEMP_DIR/decisions.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
fi

# Check Milestones sync
if wait $PID_MILESTONES; then
    log "✅ [5/8] Milestones sync completed"
else
    log "❌ [5/8] Milestones sync failed - check $TEMP_DIR/milestones.log"
    cat "$TEMP_DIR/milestones.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
fi

# Check Upcoming Reviews sync
if wait $PID_REVIEWS; then
    log "✅ [6/8] Upcoming Reviews sync completed"
else
    log "❌ [6/8] Upcoming Reviews sync failed - check $TEMP_DIR/upcoming_reviews.log"
    cat "$TEMP_DIR/upcoming_reviews.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
fi

# Check AI sync
if wait $PID_AI; then
    log "✅ [7/8] AI sync completed"
else
    log "❌ [7/8] AI sync failed - check $TEMP_DIR/ai.log"
    cat "$TEMP_DIR/ai.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
fi

# Check Hearing sync
if wait $PID_HEARING; then
    log "✅ [8/8] Hearing sync completed"
else
    log "❌ [8/8] Hearing sync failed - check $TEMP_DIR/hearing.log"
    cat "$TEMP_DIR/hearing.log" >> "$LOG_FILE"
    SYNC_ERRORS=$((SYNC_ERRORS+1))
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
    # Flush the server-side in-memory query cache so the frontend gets fresh data immediately
    SYNC_SECRET_VAL="${SYNC_SECRET:-sync-secret-default}"
    CACHE_RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/cache-clear \
      -H "Content-Type: application/json" \
      -H "x-sync-secret: ${SYNC_SECRET_VAL}" \
      --max-time 5 2>/dev/null || echo "000")
    if [ "$CACHE_RESULT" = "200" ]; then
        log "🗑️  Server cache cleared — frontend will show fresh data"
    else
        log "⚠️  Cache clear skipped (server returned: $CACHE_RESULT) — data will refresh on next TTL expiry"
    fi
    # Clean up temp logs on success
    rm -rf "$TEMP_DIR"
    exit 0
else
    log "⚠️  Sync completed with $SYNC_ERRORS error(s)"
    log "   Detailed logs available in: $TEMP_DIR/"
    log "========================================="
    exit 1
fi
