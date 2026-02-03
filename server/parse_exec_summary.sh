#!/bin/bash
# Wrapper script to run Python parser and avoid Node.js/Python environment conflicts

DOCX_PATH="$1"
SCRIPT_DIR="$(dirname "$0")"

python3 "${SCRIPT_DIR}/parse_exec_summary.py" "$DOCX_PATH"
