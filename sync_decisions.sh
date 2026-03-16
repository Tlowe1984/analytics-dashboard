#!/bin/bash
set -e

# Load environment variables
if [ -f "/home/ubuntu/analytics-dashboard/.env" ]; then
  set -a
  source "/home/ubuntu/analytics-dashboard/.env"
  set +a
fi
export PYTHONPATH=
export PYTHONHOME=

echo "🔄 Syncing Decisions from Google Drive..."

# ─── Step 1: Download with forced fresh copy ────────────────────────────────
echo "📥 Downloading Wearable Decisions Canonical..."
rm -f "/tmp/Wearable Decisions Canonical .docx"
rclone copy "manus_google_drive:Wearables Everything/Wearable Decisions Canonical .docx" /tmp/ \
  --config /home/ubuntu/.gdrive-rclone.ini \
  --drive-export-formats docx \
  --drive-skip-gdocs=false \
  --ignore-times \
  --no-check-certificate

# Verify download succeeded and file is non-trivially sized (>50KB)
FILE_SIZE=$(stat -c%s "/tmp/Wearable Decisions Canonical .docx" 2>/dev/null || echo 0)
if [ "$FILE_SIZE" -lt 50000 ]; then
  echo "❌ Downloaded file is too small (${FILE_SIZE} bytes) — aborting sync to avoid data loss"
  exit 1
fi
echo "✅ Downloaded file: ${FILE_SIZE} bytes"

# ─── Step 2: Parse decisions ─────────────────────────────────────────────────
echo "📊 Parsing decisions..."
/home/ubuntu/wearables-venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_decisions.py \
  "/tmp/Wearable Decisions Canonical .docx" > /tmp/decisions_data.json

# Validate parser output: must be a non-empty JSON array with at least 10 decisions
PARSED_COUNT=$(python3 -c "import json; d=json.load(open('/tmp/decisions_data.json')); print(len(d))" 2>/dev/null || echo 0)
if [ "$PARSED_COUNT" -lt 10 ]; then
  echo "❌ Parser returned only ${PARSED_COUNT} decisions — suspiciously low, aborting to avoid wiping good data"
  exit 1
fi
echo "✅ Parser found ${PARSED_COUNT} decisions"

# ─── Step 3: Load into database with post-insert validation ──────────────────
echo "💾 Loading decisions data into database..."
cd /home/ubuntu/analytics-dashboard
pnpm exec tsx server/load_decisions.ts /tmp/decisions_data.json

echo "✅ Decisions sync complete! Refresh your browser to see the updated data."
