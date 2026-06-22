#!/bin/bash

# Automatic Error Detection & Fixing Wrapper for Sync Scripts
# This script wraps individual sync scripts and automatically fixes common errors

SCRIPT_PATH="$1"
SOURCE_NAME="$2"
MAX_RETRIES=3
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[AUTO-FIX]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[AUTO-FIX]${NC} $1"
}

log_error() {
    echo -e "${RED}[AUTO-FIX]${NC} $1"
}

# Function to fix Python environment issues
fix_python_env() {
    log_warn "Detected Python environment issue, attempting automatic fix..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Step 1: Rebuild the venv from scratch (fixes SRE module mismatch after hibernation)
    log_warn "Rebuilding Python venv to fix SRE module mismatch..."
    if [ -d "$SCRIPT_DIR/venv" ]; then
        rm -rf "$SCRIPT_DIR/venv"
    fi
    python3.11 -m venv "$SCRIPT_DIR/venv" 2>&1
    if [ $? -ne 0 ]; then
        log_error "Failed to create venv"
        return 1
    fi
    
    # Step 2: Install all required packages into the fresh venv
    "$SCRIPT_DIR/venv/bin/pip" install --quiet openpyxl python-docx lxml requests 2>&1 | tail -3
    if [ $? -ne 0 ]; then
        log_error "Failed to install packages into venv"
        return 1
    fi
    
    # Step 3: Also fix system python3 packages (for scripts using python3/python3.11 directly)
    sudo pip3 install --force-reinstall --no-cache-dir --quiet openpyxl python-docx lxml requests 2>&1 | grep -v "Defaulting to user installation" | tail -3
    
    log_info "Python environment rebuilt successfully"
    return 0
}

# Function to fix Google Drive token issues
fix_gdrive_token() {
    log_warn "Detected Google Drive token error, waiting for rate limit reset..."
    
    # Wait longer for rate limits to reset
    sleep 30
    
    log_info "Retrying after rate limit cooldown..."
    return 0
}

# Function to fix missing rclone config
fix_rclone_config() {
    log_warn "Detected missing rclone config, attempting to create from GOOGLE_WORKSPACE_CLI_TOKEN..."
    
    RCLONE_CONFIG="/home/ubuntu/.gdrive-rclone.ini"
    
    # Check if token is available
    if [ -z "${GOOGLE_WORKSPACE_CLI_TOKEN}" ] && [ -z "${GOOGLE_DRIVE_TOKEN}" ]; then
        log_error "GOOGLE_WORKSPACE_CLI_TOKEN is not set — cannot create rclone config"
        return 1
    fi
    
    TOKEN="${GOOGLE_WORKSPACE_CLI_TOKEN:-${GOOGLE_DRIVE_TOKEN}}"
    
    # Create rclone config using the bearer token
    cat > "$RCLONE_CONFIG" << RCLONE_EOF
[manus_google_drive]
type = drive
scope = drive.readonly
token = {"access_token":"${TOKEN}","token_type":"Bearer","expiry":"2099-01-01T00:00:00Z"}
RCLONE_EOF
    
    if [ -f "$RCLONE_CONFIG" ]; then
        log_info "rclone config created at $RCLONE_CONFIG"
        return 0
    else
        log_error "Failed to create rclone config"
        return 1
    fi
}

# Function to detect error type from output
detect_error_type() {
    local output="$1"
    
    if echo "$output" | grep -q "SRE module mismatch\|ModuleNotFoundError\|No module named"; then
        echo "python_env"
    elif echo "$output" | grep -q "token error\|rate limit\|429\|quota"; then
        echo "gdrive_token"
    elif echo "$output" | grep -q "didn't find section in config file\|Config file.*not found\|manus_google_drive"; then
        echo "rclone_config"
    elif echo "$output" | grep -q "No such file\|cannot find"; then
        echo "missing_file"
    elif echo "$output" | grep -q "Connection\|timeout\|network"; then
        echo "network"
    else
        echo "unknown"
    fi
}

# Main retry loop with automatic fixing
attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
    log_info "Running $SOURCE_NAME sync (attempt $attempt/$MAX_RETRIES)..."
    
    # Run the sync script and capture output
    output=$(bash "$SCRIPT_PATH" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_info "$SOURCE_NAME sync completed successfully!"
        echo "$output"
        exit 0
    fi
    
    # Detect error type
    error_type=$(detect_error_type "$output")
    log_warn "$SOURCE_NAME sync failed with error type: $error_type"
    
    # Attempt automatic fix based on error type
    case "$error_type" in
        python_env)
            fix_python_env
            if [ $? -eq 0 ]; then
                log_info "Retrying $SOURCE_NAME sync after Python environment fix..."
                ((attempt++))
                continue
            fi
            ;;
        gdrive_token)
            fix_gdrive_token
            ((attempt++))
            continue
            ;;
        rclone_config)
            fix_rclone_config
            if [ $? -eq 0 ]; then
                log_info "Retrying $SOURCE_NAME sync after rclone config fix..."
                ((attempt++))
                continue
            else
                log_error "Cannot fix rclone config — GOOGLE_WORKSPACE_CLI_TOKEN not available"
                echo "$output"
                exit 1
            fi
            ;;
        network)
            log_warn "Network error detected, waiting ${RETRY_DELAY}s before retry..."
            sleep $RETRY_DELAY
            ((attempt++))
            continue
            ;;
        *)
            log_error "Unknown error type, cannot auto-fix"
            echo "$output"
            ;;
    esac
    
    # If we get here, auto-fix failed or wasn't applicable
    if [ $attempt -lt $MAX_RETRIES ]; then
        log_warn "Retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
        ((attempt++))
    else
        log_error "$SOURCE_NAME sync failed after $MAX_RETRIES attempts"
        echo "$output"
        exit 1
    fi
done

exit 1
