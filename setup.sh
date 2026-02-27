#!/bin/bash
# setup.sh — runs on every server start to pin the Python environment
# Prevents SRE module mismatch and _decimal/_contextvars errors after sandbox hibernation
# Typical runtime: ~20-30 seconds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"
REQUIREMENTS="python-docx openpyxl requests"

echo "[setup] Starting Python environment setup..."
START_TIME=$(date +%s)

# Always rebuild venv from scratch to avoid compiled C extension mismatches
# after sandbox hibernation (SRE module mismatch, _decimal, _contextvars errors)
echo "[setup] Rebuilding Python venv from scratch..."
rm -rf "$VENV_DIR"
python3 -m venv "$VENV_DIR"

echo "[setup] Installing Python packages into venv..."
"$VENV_DIR/bin/pip" install --quiet $REQUIREMENTS

# Also force-reinstall system Python packages used by milestones/upcoming reviews scripts
echo "[setup] Reinstalling system Python packages..."
sudo pip3 install --quiet --force-reinstall --no-cache-dir $REQUIREMENTS 2>/dev/null || true

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo "[setup] ✅ Python environment ready in ${ELAPSED}s"
echo "[setup] Venv: $VENV_DIR"
echo "[setup] Packages: $REQUIREMENTS"
