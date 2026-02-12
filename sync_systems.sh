#!/bin/bash
set -e
export PYTHONPATH=
export PYTHONHOME=

echo "=== Syncing Systems Review Data ==="

# Clear any cached files
echo "Clearing cache..."
rm -f /tmp/Wearables*Systems*Review*.docx
rm -f /tmp/systems_data.json

# Parse the document (parser will find and download latest weekly archive)
echo "Finding and parsing latest Systems review document..."
/home/ubuntu/analytics-dashboard/venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_systems_review.py > /tmp/systems_data.json

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
    isWearablesTag: item.is_wearables_tag || 0,
    indentLevel: item.indent_level || 0,
    order: item.order,
  });
}

console.log(`✅ Loaded ${data.length} Systems items`);
process.exit(0);
ENDTS

echo "=== Systems sync complete ==="
