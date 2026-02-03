#!/bin/bash
set -e

echo "=== Syncing Systems Review Data ==="

# Download Systems review document
echo "Downloading Wearable Systems Review document..."
rclone copy "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Systems Software Reviews/Wearables Systems Review.docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini

# Parse the document
echo "Parsing Systems review document..."
python3 /home/ubuntu/analytics-dashboard/server/parse_systems_review.py "/tmp/Wearables Systems Review.docx" > /tmp/systems_data.json

# Load into database
echo "Loading Systems data into database..."
cd /home/ubuntu/analytics-dashboard
pnpm exec tsx << 'ENDTS'
import { getDb } from "./server/db.ts";
import { systemsItems } from "./drizzle/schema.ts";
import { readFileSync } from "fs";

const db = await getDb();
if (!db) {
  console.error("Database not available");
  process.exit(1);
}
const data = JSON.parse(readFileSync("/tmp/systems_data.json", "utf-8"));

// Clear existing data
await db.delete(systemsItems);

// Insert new data
for (const item of data) {
  await db.insert(systemsItems).values({
    sectionType: item.section_type,
    content: item.content,
    isNew: item.is_new,
    indentLevel: item.indent_level || 0,
    order: item.order,
  });
}

console.log(`✅ Loaded ${data.length} Systems items`);
process.exit(0);
ENDTS

echo "=== Systems sync complete ==="
