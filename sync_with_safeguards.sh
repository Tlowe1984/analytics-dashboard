#!/bin/bash

#############################################
# Sync Script with Comprehensive Safeguards
# Prevents data corruption and pipeline failures
#############################################

set -euo pipefail

# Configuration
LOCK_FILE="/tmp/analytics_dashboard_sync.lock"
BACKUP_DIR="/home/ubuntu/analytics-dashboard/backups"
LOG_FILE="/home/ubuntu/analytics-dashboard/.manus-logs/sync.log"
MAX_SYNC_DURATION=300  # 5 minutes
MIN_ITEMS_PER_TABLE=5  # Minimum expected items
DISK_SPACE_THRESHOLD=80  # Alert if >80% full

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        log_info "Lock file removed"
    fi
    
    if [ $exit_code -ne 0 ]; then
        log_error "Sync failed with exit code $exit_code"
        send_alert "CRITICAL" "Sync failed with exit code $exit_code"
    fi
    
    exit $exit_code
}

trap cleanup EXIT INT TERM

# Alert function (placeholder - implement with actual notification system)
send_alert() {
    local severity=$1
    local message=$2
    log_warning "ALERT [$severity]: $message"
    # TODO: Implement actual alerting (email, Slack, etc.)
    # curl -X POST https://api.manus.im/notifications \
    #   -H "Authorization: Bearer $NOTIFICATION_TOKEN" \
    #   -d "{\"title\": \"Sync Alert\", \"message\": \"$message\", \"severity\": \"$severity\"}"
}

#############################################
# SAFEGUARD 1: Sync Lock (Prevent Concurrent Runs)
#############################################

check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE")
        if ps -p "$lock_pid" > /dev/null 2>&1; then
            log_error "Another sync is already running (PID: $lock_pid)"
            send_alert "WARNING" "Sync blocked: Another sync already running"
            exit 1
        else
            log_warning "Stale lock file found (PID: $lock_pid no longer running), removing"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    log_info "Lock file created (PID: $$)"
}

#############################################
# SAFEGUARD 2: Pre-Sync Validation
#############################################

validate_prerequisites() {
    log_info "Running pre-sync validation..."
    
    # Check 1: Disk space
    local disk_usage=$(df -h /home/ubuntu | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt "$DISK_SPACE_THRESHOLD" ]; then
        log_error "Disk space critical: ${disk_usage}% used (threshold: ${DISK_SPACE_THRESHOLD}%)"
        send_alert "CRITICAL" "Disk space at ${disk_usage}%"
        return 1
    fi
    log_success "Disk space OK: ${disk_usage}% used"
    
    # Check 2: Google Drive authentication
    if ! rclone lsf "manus_google_drive:" --config /home/ubuntu/.gdrive-rclone.ini --max-depth 1 > /dev/null 2>&1; then
        log_error "Google Drive authentication failed"
        send_alert "CRITICAL" "Google Drive authentication expired or failed"
        return 1
    fi
    log_success "Google Drive authentication OK"
    
    # Check 3: Database connection
    if ! mysql -e "SELECT 1" 2>/dev/null > /dev/null 2>&1; then
        log_error "Database connection failed"
        send_alert "CRITICAL" "Database connection failed"
        return 1
    fi
    log_success "Database connection OK"
    
    # Check 4: Source files exist
    local required_files=(
        "Wearable Live Dashboard/Exec Summary Week 5.docx"
        "Wearable Live Dashboard/Software Review.docx"
        "Wearable Live Dashboard/Systems Review.docx"
        "Wearable Live Dashboard/Decisions.docx"
        "Wearable Live Dashboard/Upcoming Reviews.docx"
        "Wearable Live Dashboard/Milestones.docx"
    )
    
    for file in "${required_files[@]}"; do
        if ! rclone lsf "manus_google_drive:$file" --config /home/ubuntu/.gdrive-rclone.ini > /dev/null 2>&1; then
            log_warning "Source file not found: $file"
            send_alert "WARNING" "Source file missing: $file"
        fi
    done
    
    log_success "Pre-sync validation passed"
    return 0
}

#############################################
# SAFEGUARD 3: Database Backup
#############################################

backup_database() {
    log_info "Creating database backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Keep only last 7 days of backups
    find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete
    
    local backup_file="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Backup all tables
    if mysqldump --single-transaction \
        dashboard_items software_items systems_items \
        decisions upcoming_reviews milestones \
        > "$backup_file" 2>&1; then
        log_success "Database backup created: $backup_file"
        echo "$backup_file"  # Return backup file path
        return 0
    else
        log_error "Database backup failed"
        send_alert "CRITICAL" "Database backup failed before sync"
        return 1
    fi
}

#############################################
# SAFEGUARD 4: Post-Sync Integrity Checks
#############################################

validate_sync_results() {
    log_info "Running post-sync integrity checks..."
    
    local validation_failed=0
    
    # Check 1: Verify tables have data
    local tables=("dashboard_items" "software_items" "systems_items" "decisions" "upcoming_reviews" "milestones")
    
    for table in "${tables[@]}"; do
        local count=$(mysql -sN -e "SELECT COUNT(*) FROM $table")
        
        if [ "$count" -lt "$MIN_ITEMS_PER_TABLE" ]; then
            log_warning "Table $table has only $count items (expected >=$MIN_ITEMS_PER_TABLE)"
            validation_failed=1
        else
            log_success "Table $table: $count items"
        fi
    done
    
    # Check 2: Verify no NULL content
    local null_count=$(mysql -sN -e "
        SELECT COUNT(*) FROM (
            SELECT id FROM dashboard_items WHERE content IS NULL OR content = ''
            UNION ALL
            SELECT id FROM software_items WHERE content IS NULL OR content = ''
            UNION ALL
            SELECT id FROM systems_items WHERE content IS NULL OR content = ''
        ) AS null_items
    ")
    
    if [ "$null_count" -gt 0 ]; then
        log_warning "Found $null_count items with NULL or empty content"
        validation_failed=1
    else
        log_success "No NULL or empty content found"
    fi
    
    # Check 3: Verify timestamps are recent
    local old_items=$(mysql -sN -e "
        SELECT COUNT(*) FROM dashboard_items 
        WHERE updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    ")
    
    if [ "$old_items" -gt 0 ]; then
        log_warning "Found $old_items items not updated in 7 days"
    else
        log_success "All items have recent timestamps"
    fi
    
    if [ $validation_failed -eq 1 ]; then
        log_error "Post-sync validation failed"
        send_alert "WARNING" "Post-sync validation detected issues"
        return 1
    fi
    
    log_success "Post-sync validation passed"
    return 0
}

#############################################
# SAFEGUARD 5: Automatic Rollback
#############################################

rollback_database() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_warning "Rolling back database to: $backup_file"
    
    if mysql < "$backup_file" 2>&1; then
        log_success "Database rolled back successfully"
        send_alert "WARNING" "Database rolled back due to sync failure"
        return 0
    else
        log_error "Database rollback failed!"
        send_alert "CRITICAL" "Database rollback FAILED - manual intervention required"
        return 1
    fi
}

#############################################
# Main Sync Logic
#############################################

main() {
    local start_time=$(date +%s)
    local backup_file=""
    
    log_info "=========================================="
    log_info "Starting sync with safeguards"
    log_info "=========================================="
    
    # SAFEGUARD 1: Check for concurrent sync
    check_lock
    
    # SAFEGUARD 2: Pre-sync validation
    if ! validate_prerequisites; then
        log_error "Pre-sync validation failed, aborting"
        exit 1
    fi
    
    # SAFEGUARD 3: Backup database
    backup_file=$(backup_database)
    if [ -z "$backup_file" ]; then
        log_error "Failed to create backup, aborting"
        exit 1
    fi
    
    # Run the actual sync
    log_info "Running sync script..."
    
    if timeout "$MAX_SYNC_DURATION" bash /home/ubuntu/analytics-dashboard/sync_all_data.sh; then
        log_success "Sync script completed"
        
        # SAFEGUARD 4: Post-sync validation
        if validate_sync_results; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            log_success "=========================================="
            log_success "Sync completed successfully in ${duration}s"
            log_success "=========================================="
            
            # Clean up old backup (keep it for 24 hours just in case)
            # The 7-day cleanup happens in backup_database function
            
            return 0
        else
            log_error "Post-sync validation failed"
            
            # SAFEGUARD 5: Automatic rollback
            log_warning "Attempting automatic rollback..."
            if rollback_database "$backup_file"; then
                log_warning "Rollback successful, sync aborted"
                exit 1
            else
                log_error "Rollback failed! Database may be in inconsistent state"
                send_alert "CRITICAL" "Sync failed AND rollback failed - immediate action required"
                exit 1
            fi
        fi
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_error "Sync timed out after ${MAX_SYNC_DURATION}s"
            send_alert "CRITICAL" "Sync timed out"
        else
            log_error "Sync script failed with exit code $exit_code"
        fi
        
        # SAFEGUARD 5: Automatic rollback
        log_warning "Attempting automatic rollback..."
        rollback_database "$backup_file"
        exit 1
    fi
}

# Run main function
main "$@"

# Invalidate cache after successful sync (if server is running)
invalidate_cache() {
    log_info "Invalidating query cache..."
    
    # Send HTTP request to invalidate cache endpoint (if implemented)
    # For now, just log - the cache has TTL so it will expire naturally
    log_info "Cache will auto-expire after TTL (1 hour)"
}
