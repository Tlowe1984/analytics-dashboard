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

echo "=== Syncing Systems Review Data ==="

# Clear any cached files
echo "Clearing cache..."
rm -f /tmp/Wearables*Systems*Review*.docx
rm -f /tmp/systems_data.json

# Parse the document (parser will find and download latest weekly archive)
echo "Finding and parsing latest Systems review document..."
/home/ubuntu/wearables-venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_systems_review.py > /tmp/systems_data.json

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

# Upsert source file metadata into sync_metadata table
if [ -f /tmp/systems_source_meta.json ]; then
  echo "Saving source file metadata..."
  cat > /home/ubuntu/analytics-dashboard/upsert_systems_meta.mjs << 'METAEOF'
import { readFileSync } from 'fs';
import { getDb } from './server/db.js';
import { syncMetadata } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';
const meta = JSON.parse(readFileSync('/tmp/systems_source_meta.json', 'utf8'));
const db = await getDb();
if (db) {
  const filename = meta.filename || '';
  const fileModifiedAt = meta.modified ? new Date(meta.modified) : null;
  const sourceFileUrl = meta.file_url || null;
  console.log(`📄 Source: ${filename} (modified: ${meta.modified})`);
  if (sourceFileUrl) console.log(`🔗 URL: ${sourceFileUrl}`);
  const existing = await db.select().from(syncMetadata).where(eq(syncMetadata.section, 'systems')).limit(1);
  if (existing.length > 0) {
    await db.update(syncMetadata).set({ sourceFileName: filename, sourceFileUrl, fileModifiedAt, lastSyncedAt: new Date(), syncStatus: 'success' }).where(eq(syncMetadata.section, 'systems'));
  } else {
    await db.insert(syncMetadata).values({ section: 'systems', documentId: 'systems_review', sourceFileName: filename, sourceFileUrl, fileModifiedAt, lastSyncedAt: new Date(), syncStatus: 'success' });
  }
  console.log('✅ Metadata saved for systems');
}
process.exit(0);
METAEOF
  cd /home/ubuntu/analytics-dashboard && pnpm exec tsx upsert_systems_meta.mjs
  rm -f /home/ubuntu/analytics-dashboard/upsert_systems_meta.mjs
fi

echo "=== Systems sync complete ==="
