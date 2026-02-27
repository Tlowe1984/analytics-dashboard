#!/bin/bash
set -e
export PYTHONPATH=
export PYTHONHOME=

echo "🔄 Syncing Hearing (Health) reviews from Google Drive..."

# Get current and previous week numbers (force decimal to avoid octal errors on 08/09)
CURRENT_WEEK=$((10#$(date +%V)))
PREVIOUS_WEEK=$((CURRENT_WEEK - 1))
CURRENT_WEEK_FORMATTED=$(printf "W%02d" $CURRENT_WEEK)
PREVIOUS_WEEK_FORMATTED=$(printf "W%02d" $PREVIOUS_WEEK)

echo "📅 Looking for Health reviews from $CURRENT_WEEK_FORMATTED or $PREVIOUS_WEEK_FORMATTED..."

# List files in the folder and find the most recent WXX Health Canonical Program Review
FOLDER_PATH="Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/Health/Previous Reviews & Review Notes"

# Search for files matching pattern and get the most recent one
# Flexible regex matches:
#   "W09 Health Canonical Program Review.docx"
#   "W9 Health Canonical Program Review.docx"
#   "WK09 Health Canonical Program Review.docx"
#   "W09 Health Program Review.docx" (shorter variant)
echo "🔍 Searching for Health Canonical Program Review files..."
LATEST_FILE=$(rclone lsl "manus_google_drive:$FOLDER_PATH" --config /home/ubuntu/.gdrive-rclone.ini | \
  grep -iE "W(K)?[0-9]{1,2}[[:space:]].*Health.*(Canonical[[:space:]]+)?Program[[:space:]]+Review\.docx" | \
  sort -k2,3 -r | \
  head -1 | \
  awk '{for(i=4;i<=NF;i++) printf "%s ", $i; print ""}' | \
  sed 's/[[:space:]]*$//')

# Fallback: if nothing matched the strict pattern, grab the most recently modified Health .docx
if [ -z "$LATEST_FILE" ]; then
  echo "⚠️  Primary pattern matched nothing — trying broad Health .docx fallback..."
  LATEST_FILE=$(rclone lsl "manus_google_drive:$FOLDER_PATH" --config /home/ubuntu/.gdrive-rclone.ini | \
    grep -iE "Health.*\.docx" | \
    sort -k2,3 -r | \
    head -1 | \
    awk '{for(i=4;i<=NF;i++) printf "%s ", $i; print ""}' | \
    sed 's/[[:space:]]*$//')
fi

if [ -z "$LATEST_FILE" ]; then
  echo "❌ No Health review file found in $FOLDER_PATH"
  exit 1
fi

echo "📄 Found: $LATEST_FILE"

# Delete old cached file to force fresh download
rm -f "/tmp/$LATEST_FILE"

# Download the file
echo "📥 Downloading $LATEST_FILE..."
rclone copy "manus_google_drive:$FOLDER_PATH/$LATEST_FILE" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini --ignore-times --no-check-certificate

# Parse the document
echo "📊 Parsing Health review document..."
/home/ubuntu/analytics-dashboard/venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_hearing_review.py "/tmp/$LATEST_FILE" > /tmp/hearing_data.json

# Load into database
echo "💾 Loading Hearing data into database..."
cd /home/ubuntu/analytics-dashboard
pnpm exec tsx << 'EOF'
import fs from 'fs';
import { getDb } from './server/db';
import { hearingItems } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function loadHearingData() {
  const data = JSON.parse(fs.readFileSync('/tmp/hearing_data.json', 'utf8'));
  const db = await getDb();
  
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }
  
  // Clear existing hearing items
  await db.delete(hearingItems);
  
  // Insert new items
  console.log(`Loading ${data.items.length} hearing items...`);
  for (const item of data.items) {
    await db.insert(hearingItems).values({
      sectionType: item.section_type,
      content: item.content,
      isNew: item.is_new ? 1 : 0,
      isWearablesTag: item.is_wearables_tag ? 1 : 0,
      indentLevel: item.indent_level,
      order: item.order,
      // Decision table fields (only for decisions section)
      date: item.date || null,
      dri: item.dri || null,
      forum: item.forum || null,
      status: item.status || null,
      decisionDoc: item.decision_doc || null,
      decisionMakers: item.decision_makers || null
    });
  }
  
  console.log('✅ Hearing data loaded successfully!');
  process.exit(0);
}

loadHearingData().catch(err => {
  console.error('Error loading hearing data:', err);
  process.exit(1);
});
EOF

echo "✅ Hearing sync complete! Refresh your browser to see the updated data."
