#!/bin/bash
set -e

echo "📥 Syncing all dashboard data from Google Drive..."

# Download Devices doc
echo "📥 Downloading Devices document..."
rclone copy "manus_google_drive:Wearables Everything/Reviews (Comment Only)/W5 2026 Device & Growth Canonical Program Review.docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini

# Download Software doc  
echo "📥 Downloading Software document..."
rclone copy "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/Software (I+E, AI, Hearing) Canonical Program Review.docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini

# Parse Devices doc
echo "📊 Parsing Devices executive summary..."
/usr/bin/python3.11 /home/ubuntu/analytics-dashboard/server/parse_exec_summary.py "/tmp/W5 2026 Device & Growth Canonical Program Review.docx" > /tmp/devices_data.json

# Parse Software doc
echo "📊 Parsing Software review..."
/usr/bin/python3.11 /home/ubuntu/analytics-dashboard/server/parse_software_review.py "/tmp/Software (I+E, AI, Hearing) Canonical Program Review.docx" > /tmp/software_data.json

# Load Devices data
echo "💾 Loading Devices data into database..."
cd /home/ubuntu/analytics-dashboard
cat > /tmp/load_devices.mjs << 'ENDSCRIPT'
import { readFileSync } from 'fs';
import { db } from './server/db.js';
import { dashboardItems } from './drizzle/schema.js';

const data = JSON.parse(readFileSync('/tmp/devices_data.json', 'utf8'));

console.log(`Loading ${data.length} devices items into database...`);

// Clear existing data
await db.delete(dashboardItems);

// Insert new data
for (const item of data) {
  await db.insert(dashboardItems).values({
    sectionType: item.section_type,
    productCategory: item.product_category,
    content: item.content,
    isNew: item.is_new,
    order: item.order,
  });
}

console.log('Devices data loaded successfully!');
process.exit(0);
ENDSCRIPT

pnpm exec tsx /tmp/load_devices.mjs

# Load Software data
echo "💾 Loading Software data into database..."
cat > /tmp/load_software.mjs << 'ENDSCRIPT'
import { readFileSync } from 'fs';
import { db } from './server/db.js';
import { softwareItems } from './drizzle/schema.js';

const data = JSON.parse(readFileSync('/tmp/software_data.json', 'utf8'));

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

pnpm exec tsx /tmp/load_software.mjs

echo "✅ Sync complete! Refresh your browser to see the updated data."
