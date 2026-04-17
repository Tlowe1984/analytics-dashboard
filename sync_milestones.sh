#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting milestones sync..."

# Parse milestones from spreadsheet
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Parsing Wearable Program Milestones SOT spreadsheet..."
MILESTONES_JSON=$(/home/ubuntu/wearables-venv/bin/python server/parse_milestones_xlsx.py 2>&1 | tail -n +4)

if [ -z "$MILESTONES_JSON" ] || [ "$MILESTONES_JSON" = "[]" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: No milestones parsed"
    exit 1
fi

# Save to temp file
echo "$MILESTONES_JSON" > /tmp/milestones_parsed.json

# Count milestones
MILESTONE_COUNT=$(echo "$MILESTONES_JSON" | /home/ubuntu/wearables-venv/bin/python -c "import json, sys; print(len(json.load(sys.stdin)))")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Parsed $MILESTONE_COUNT milestones"

# Load into database
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Loading milestones into database..."
cd "$SCRIPT_DIR"
pnpm exec tsx << 'EOF'
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { milestones } from './drizzle/schema.js';
import fs from 'fs';

const rawDbUrl = (process.env.DATABASE_URL || '');
const isLocal = rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1');
const dbUrl = rawDbUrl.replace(/[?&]ssl=[^&]*/g, '').replace(/\?$/, '').replace(/\?&/, '?');
const connection = await mysql.createConnection({ uri: dbUrl, ...(isLocal ? {} : { ssl: { rejectUnauthorized: true } }) });
const db = drizzle(connection);

// Read parsed milestones
const data = JSON.parse(fs.readFileSync('/tmp/milestones_parsed.json', 'utf8'));

// Clear existing milestones
await db.delete(milestones);
console.log('Cleared existing milestones');

// Insert new milestones in batches for performance
const batchSize = 100;
let insertCount = 0;

for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  const values = batch.map(item => ({
    product: item.product,
    milestoneName: item.milestone_name,
    milestoneDate: new Date(item.milestone_date),
    milestoneType: item.milestone_type,
    originalType: item.original_type || ''
  }));
  
  try {
    await db.insert(milestones).values(values);
    insertCount += values.length;
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertCount}/${data.length} milestones`);
  } catch (err) {
    console.error(`Failed to insert batch starting at index ${i}:`, err.message);
  }
}

console.log(`Successfully inserted ${insertCount} milestones`);
await connection.end();
process.exit(0);
EOF

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Milestones sync completed successfully"
exit 0
