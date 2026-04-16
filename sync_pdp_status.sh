#!/usr/bin/env bash
# sync_pdp_status.sh
# Downloads the Devices & Growth Canonical Program Review and parses the PDP Status table.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="/home/ubuntu/wearables-venv/bin/python"
RCLONE_CONF="/home/ubuntu/.gdrive-rclone.ini"
GDRIVE_REMOTE="manus_google_drive"

# Folder and file
FOLDER="Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews"
FILENAME="Device & Growth Canonical Program Review"

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "[pdp_status] Searching for '$FILENAME' in '$FOLDER'..."

# Find the file
FILE_INFO=$(rclone lsjson "${GDRIVE_REMOTE}:${FOLDER}" --config "$RCLONE_CONF" 2>/dev/null | \
  python3 -c "
import json, sys
files = json.load(sys.stdin)
matches = [f for f in files if '${FILENAME}' in f.get('Name','') and f.get('Name','').endswith('.docx')]
if matches:
    # Pick most recently modified
    matches.sort(key=lambda x: x.get('ModTime',''), reverse=True)
    print(json.dumps(matches[0]))
" 2>/dev/null || echo "")

if [ -z "$FILE_INFO" ]; then
  echo "[pdp_status] ERROR: Could not find '$FILENAME' in Google Drive"
  exit 1
fi

ACTUAL_NAME=$(echo "$FILE_INFO" | python3 -c "import json,sys; print(json.load(sys.stdin)['Name'])")
echo "[pdp_status] Found: $ACTUAL_NAME"

# Download
rclone copy "${GDRIVE_REMOTE}:${FOLDER}/${ACTUAL_NAME}" "$TMP_DIR" --config "$RCLONE_CONF" 2>/dev/null
DOCX_PATH="$TMP_DIR/$ACTUAL_NAME"

if [ ! -f "$DOCX_PATH" ]; then
  echo "[pdp_status] ERROR: Download failed"
  exit 1
fi

# Parse
JSON_PATH="$TMP_DIR/pdp_status.json"
echo "[pdp_status] Parsing PDP Status table..."
"$VENV_PYTHON" "$SCRIPT_DIR/server/parse_pdp_status.py" "$DOCX_PATH" > "$JSON_PATH"

ROW_COUNT=$(python3 -c "import json; data=json.load(open('$JSON_PATH')); print(len(data))")
echo "[pdp_status] Parsed $ROW_COUNT rows"

if [ "$ROW_COUNT" -lt 1 ]; then
  echo "[pdp_status] ERROR: No rows parsed"
  exit 1
fi

# Load into DB
echo "[pdp_status] Loading into database..."
cd "$SCRIPT_DIR"
pnpm exec tsx server/load_pdp_status.ts "$JSON_PATH"

echo "[pdp_status] ✅ Done — $ROW_COUNT PDP status rows loaded"
