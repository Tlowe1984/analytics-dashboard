#!/bin/bash
set -e

echo "📥 Downloading Software document from Google Drive..."
rclone copy "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/Software (I+E, AI, Hearing) Canonical Program Review.docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini

echo "📊 Parsing Software review..."
python3 /home/ubuntu/analytics-dashboard/server/parse_software_review.py "/tmp/Software (I+E, AI, Hearing) Canonical Program Review.docx" > /tmp/software_data.json

echo "💾 Loading Software data into database..."
cd /home/ubuntu/analytics-dashboard
cat > load_software_temp.mjs << 'ENDSCRIPT'
import { readFileSync } from 'fs';
import { getDb } from './server/db.js';
import { softwareItems } from './drizzle/schema.js';

const data = JSON.parse(readFileSync('/tmp/software_data.json', 'utf8'));
const db = await getDb();

if (!db) {
  console.error('Failed to connect to database');
  process.exit(1);
}

console.log(`Loading ${data.length} software items into database...`);

// Clear existing data
await db.delete(softwareItems);

// Insert new data
for (const item of data) {
  await db.insert(softwareItems).values({
    sectionType: item.section_type,
    content: item.content,
    isNew: item.is_new,
    order: item.order,
  });
}

console.log('Software data loaded successfully!');
process.exit(0);
ENDSCRIPT

pnpm exec tsx load_software_temp.mjs
rm load_software_temp.mjs

echo "✅ Software sync complete! Refresh your browser to see the updated data."
