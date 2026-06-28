#!/bin/bash
# setup.sh — runs on every server start to pin the Python environment
# Prevents SRE module mismatch and _decimal/_contextvars errors after sandbox hibernation
# Typical runtime: ~20-30 seconds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="/home/ubuntu/wearables-venv"
REQUIREMENTS="python-docx openpyxl requests"

echo "[setup] Starting Python environment setup..."
START_TIME=$(date +%s)

# Always rebuild venv from scratch to avoid compiled C extension mismatches
# after sandbox hibernation (SRE module mismatch, _decimal, _contextvars errors)
# IMPORTANT: Always use /usr/bin/python3.12 explicitly — never `python3` or `uv python`
# The UV-managed python3.13 binary corrupts its _sre C extension after sandbox hibernation
# and even `python3 -m venv` fails because venv imports re which imports _sre.
# /usr/bin/python3.12 is the stable system binary that survives hibernation reliably.
PYTHON_BIN="/usr/bin/python3.12"
echo "[setup] Rebuilding Python venv from scratch using $PYTHON_BIN..."
rm -rf "$VENV_DIR"
"$PYTHON_BIN" -m venv "$VENV_DIR"

echo "[setup] Installing Python packages into venv..."
"$VENV_DIR/bin/pip" install --quiet $REQUIREMENTS

# Also force-reinstall into system Python 3.11 for scripts that call python3 directly
# IMPORTANT: Use /usr/bin/python3.12 -m pip explicitly — sudo pip3 aliases to `uv pip`
# which calls the broken UV Python 3.13 binary and crashes with SRE module mismatch.
echo "[setup] Reinstalling system Python packages into python3.11..."
/usr/bin/python3.12 -m pip install --quiet --force-reinstall --no-cache-dir $REQUIREMENTS 2>/dev/null || true

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo "[setup] ✅ Python environment ready in ${ELAPSED}s"
echo "[setup] Venv: $VENV_DIR"
echo "[setup] Packages: $REQUIREMENTS"
