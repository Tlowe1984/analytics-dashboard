#!/bin/bash
set -e

# Load environment variables
if [ -f "/home/ubuntu/analytics-dashboard/.env" ]; then
  set -a
  source "/home/ubuntu/analytics-dashboard/.env"
  set +a
fi

echo "🔄 Syncing AI reviews from Google Drive..."

# Calculate current week and previous week (force decimal to avoid octal errors on 08/09)
current_week=$((10#$(date +%V)))
current_year=$(date +%Y)

# Look for AI review documents from current or previous week
echo "📅 Looking for AI reviews from W${current_week} or W$((current_week - 1))..."

# Search for AI review files in the specified directory
FOLDER_PATH="Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/AI Previous Reviews & Review Notes"

echo "🔍 Searching for AI WX review files..."
rclone lsf "manus_google_drive:$FOLDER_PATH" \
  --config /home/ubuntu/.gdrive-rclone.ini \
  --include "AI W*.docx" | while read -r filename; do
  echo "📄 Found: $filename"
done

# Find the most recent AI WX file (sort by modification time)
# Flexible pattern matches all known naming variants:
#   - "W9 AI Hotspots and Product Review.docx"
#   - "AI W9 Hotspots.docx"
#   - "W09 AI Hotspots.docx"
#   - "W09 AI Product Review.docx"
#   - "WK09 AI Hotspots.docx"
ai_lsl_output=$(rclone lsl "manus_google_drive:$FOLDER_PATH" --config /home/ubuntu/.gdrive-rclone.ini 2>/dev/null)
latest_line=$(echo "$ai_lsl_output" | \
  grep -iE "(W(K)?[0-9]+.*AI.*(Hotspots|Product[[:space:]]+Review)|AI.*W(K)?[0-9]+.*(Hotspots|Review)).*\.docx" | \
  sort -k2,3 -r | \
  head -1)
latest_file=$(echo "$latest_line" | awk '{for(i=4;i<=NF;i++) printf "%s ", $i; print ""}' | sed 's/[[:space:]]*$//')
ai_file_modified=$(echo "$latest_line" | awk '{print $2" "$3}' | sed 's/\..*//')

# Fallback: if nothing matched, grab the most recently modified .docx in the folder
if [ -z "$latest_file" ]; then
  echo "⚠️  Primary pattern matched nothing — trying broad .docx fallback..."
  fallback_line=$(echo "$ai_lsl_output" | grep -iE "\.docx$" | sort -k2,3 -r | head -1)
  latest_file=$(echo "$fallback_line" | awk '{for(i=4;i<=NF;i++) printf "%s ", $i; print ""}' | sed 's/[[:space:]]*$//')
  ai_file_modified=$(echo "$fallback_line" | awk '{print $2" "$3}' | sed 's/\..*//')
fi

if [ -z "$latest_file" ]; then
  echo "❌ No AI review documents found in $FOLDER_PATH"
  exit 1
fi

echo "📄 Latest file: $latest_file"

# Download the file
echo "📥 Downloading $latest_file..."
rm -f "/tmp/$latest_file"
rclone copy "manus_google_drive:$FOLDER_PATH/$latest_file" /tmp --config /home/ubuntu/.gdrive-rclone.ini --ignore-times --no-check-certificate

# Parse AI review document
echo "📊 Parsing AI review document..."
cd /home/ubuntu/analytics-dashboard
/home/ubuntu/wearables-venv/bin/python server/parse_ai_review.py "/tmp/$latest_file" > /tmp/ai_data.json

# Load into database
echo "💾 Loading AI data into database..."
pnpm exec tsx << 'EOF'
import fs from 'fs';
import { getDb } from './server/db';
import { aiItems } from './drizzle/schema';

async function loadAiData() {
  const data = JSON.parse(fs.readFileSync('/tmp/ai_data.json', 'utf8'));
  const db = await getDb();
  
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }
  
  // Clear existing AI items
  await db.delete(aiItems);
  
  // Insert new items
  console.log(`Loading ${data.items.length} AI items...`);
  for (const item of data.items) {
    await db.insert(aiItems).values({
      sectionType: item.section_type,
      content: item.content,
      isNew: item.is_new ? 1 : 0,
      isWearablesTag: item.is_wearables_tag ? 1 : 0,
      indentLevel: item.indent_level,
      order: item.order,
      // Decision table fields (only for decisions section)
      dri: item.dri || null,
      forum: item.forum || null,
      status: item.status || null,
      decisionDoc: item.decision_doc || null,
      decisionMakers: item.decision_makers || null,
      post: item.post || null
    });
  }
  
  console.log('✅ AI data loaded successfully!');
  process.exit(0);
}

loadAiData().catch(err => {
  console.error('Error loading AI data:', err);
  process.exit(1);
});
EOF

# Upsert source file metadata into sync_metadata table
echo "Saving source file metadata..."
python3 -c "import json; json.dump({'filename': '$latest_file', 'modified': '$ai_file_modified'}, open('/tmp/ai_source_meta.json','w'))"
cat > /home/ubuntu/analytics-dashboard/upsert_ai_meta.mjs << 'METAEOF'
import { readFileSync } from 'fs';
import { getDb } from './server/db.js';
import { syncMetadata } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';
const meta = JSON.parse(readFileSync('/tmp/ai_source_meta.json', 'utf8'));
const db = await getDb();
if (db) {
  const filename = meta.filename || '';
  const fileModifiedAt = meta.modified ? new Date(meta.modified) : null;
  console.log(`📄 Source: ${filename} (modified: ${meta.modified})`);
  const existing = await db.select().from(syncMetadata).where(eq(syncMetadata.section, 'ai')).limit(1);
  if (existing.length > 0) {
    await db.update(syncMetadata).set({ sourceFileName: filename, fileModifiedAt, lastSyncedAt: new Date(), syncStatus: 'success' }).where(eq(syncMetadata.section, 'ai'));
  } else {
    await db.insert(syncMetadata).values({ section: 'ai', documentId: 'ai_review', sourceFileName: filename, fileModifiedAt, lastSyncedAt: new Date(), syncStatus: 'success' });
  }
  console.log('✅ Metadata saved for ai');
}
process.exit(0);
METAEOF
cd /home/ubuntu/analytics-dashboard && pnpm exec tsx upsert_ai_meta.mjs
rm -f /home/ubuntu/analytics-dashboard/upsert_ai_meta.mjs

echo "✅ AI sync complete! Refresh your browser to see the updated data."
