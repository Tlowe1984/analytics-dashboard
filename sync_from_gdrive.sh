#!/bin/bash
# Manual sync script to refresh dashboard data from Google Drive

# Load environment variables
if [ -f "/home/ubuntu/analytics-dashboard/.env" ]; then
  set -a
  source "/home/ubuntu/analytics-dashboard/.env"
  set +a
fi
# Run this script whenever you need to update the dashboard with latest Google Doc data

set -e
export PYTHONPATH=
export PYTHONHOME=

echo "📥 Downloading Google Doc from Drive..."
# Delete old file to force fresh download
rm -f "/tmp/Device Canonical Program Review.docx"

# Capture file metadata before downloading
DEVICES_FILE_NAME="Device Canonical Program Review.docx"
DEVICES_META=$(rclone lsjson "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Device Canonical Program Review.docx" --config /home/ubuntu/.gdrive-rclone.ini 2>/dev/null)
DEVICES_FILE_ID=$(echo "$DEVICES_META" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0].get('ID','') if data else '')" 2>/dev/null || echo "")
DEVICES_FILE_MODIFIED=$(echo "$DEVICES_META" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0].get('ModTime','') if data else '')" 2>/dev/null || echo "")
if [ -n "$DEVICES_FILE_ID" ]; then
  DEVICES_FILE_URL="https://docs.google.com/document/d/${DEVICES_FILE_ID}/edit"
else
  DEVICES_FILE_URL=""
fi

rclone copy "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Device Canonical Program Review.docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini --ignore-times --no-check-certificate

echo "📊 Parsing executive summary..."
/home/ubuntu/wearables-venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_exec_summary.py "/tmp/Device Canonical Program Review.docx" > /tmp/parsed_data.json

echo "💾 Loading data into database..."
cd /home/ubuntu/analytics-dashboard
pnpm exec tsx << 'EOF'
import { readFileSync, existsSync } from 'fs';
import { clearAllDashboardItems, createDashboardItem } from './server/db.ts';

if (existsSync('/tmp/parsed_data.json')) {
  const data = JSON.parse(readFileSync('/tmp/parsed_data.json', 'utf-8'));
  console.log(`Loading ${data.length} dashboard items...`);
  
  // Clear existing items
  await clearAllDashboardItems();
  
  // Insert new items
  for (const item of data) {
    await createDashboardItem({
      sectionType: item.section,
      productCategory: item.product,
      content: item.content,
      isNew: item.is_new || false,
      indentLevel: item.indent_level || 0,
      order: item.order || 0
    });
  }
  
  console.log(`✅ Loaded ${data.length} dashboard items`);
  process.exit(0);
} else {
  console.error('❌ /tmp/parsed_data.json not found');
  process.exit(1);
}
EOF

# Save source file metadata to DB
echo "Saving source file metadata..."
python3 -c "import json; json.dump({'filename': '$DEVICES_FILE_NAME', 'modified': '$DEVICES_FILE_MODIFIED', 'file_url': '$DEVICES_FILE_URL'}, open('/tmp/devices_source_meta.json','w'))"
cat > /home/ubuntu/analytics-dashboard/upsert_devices_meta.mjs << 'METAEOF'
import { readFileSync } from 'fs';
import { getDb } from './server/db.js';
import { syncMetadata } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';
const meta = JSON.parse(readFileSync('/tmp/devices_source_meta.json', 'utf8'));
const db = await getDb();
if (db) {
  const filename = meta.filename || '';
  const fileModifiedAt = meta.modified ? new Date(meta.modified) : null;
  const sourceFileUrl = meta.file_url || null;
  console.log(`📄 Source: ${filename} (modified: ${meta.modified})`);
  if (sourceFileUrl) console.log(`🔗 URL: ${sourceFileUrl}`);
  const existing = await db.select().from(syncMetadata).where(eq(syncMetadata.section, 'devices')).limit(1);
  if (existing.length > 0) {
    await db.update(syncMetadata).set({ sourceFileName: filename, sourceFileUrl, fileModifiedAt, lastSyncedAt: new Date(), syncStatus: 'success' }).where(eq(syncMetadata.section, 'devices'));
  } else {
    await db.insert(syncMetadata).values({ section: 'devices', documentId: 'devices_review', sourceFileName: filename, sourceFileUrl, fileModifiedAt, lastSyncedAt: new Date(), syncStatus: 'success' });
  }
  console.log('✅ Metadata saved for devices');
}
process.exit(0);
METAEOF
cd /home/ubuntu/analytics-dashboard && pnpm exec tsx upsert_devices_meta.mjs
rm -f /home/ubuntu/analytics-dashboard/upsert_devices_meta.mjs

echo "✅ Devices sync complete! Refresh your browser to see the updated data."
exit 0
