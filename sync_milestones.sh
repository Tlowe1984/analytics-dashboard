#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting milestones sync..."

# Parse milestones from spreadsheet
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Parsing Wearable Program Milestones SOT spreadsheet..."
MILESTONES_JSON=$(./venv/bin/python3 server/parse_milestones_xlsx.py 2>&1 | tail -n +4)

if [ -z "$MILESTONES_JSON" ] || [ "$MILESTONES_JSON" = "[]" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: No milestones parsed"
    exit 1
fi

# Save to temp file
echo "$MILESTONES_JSON" > /tmp/milestones_parsed.json

# Count milestones
MILESTONE_COUNT=$(echo "$MILESTONES_JSON" | python3 -c "import json, sys; print(len(json.load(sys.stdin)))")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Parsed $MILESTONE_COUNT milestones"

# Load into database
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Loading milestones into database..."
cat > "$SCRIPT_DIR/server/load_milestones_temp.mjs" << 'EOF'
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { milestones } from '../drizzle/schema.js';
import fs from 'fs';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Read parsed milestones
const data = JSON.parse(fs.readFileSync('/tmp/milestones_parsed.json', 'utf8'));

// Clear existing milestones
await db.delete(milestones);
console.log('Cleared existing milestones');

// Insert new milestones
let insertCount = 0;
for (const item of data) {
  try {
    await db.insert(milestones).values({
      product: item.product,
      milestoneName: item.milestone_name,
      milestoneDate: new Date(item.milestone_date),
      milestoneType: item.milestone_type,
      originalType: item.original_type || ''
    });
    insertCount++;
  } catch (err) {
    console.error(`Failed to insert milestone: ${item.product} - ${item.milestone_name}`, err.message);
  }
}

console.log(`Successfully inserted ${insertCount} milestones`);
await connection.end();
process.exit(0);
EOF

cd "$SCRIPT_DIR" && pnpm exec tsx server/load_milestones_temp.mjs && rm server/load_milestones_temp.mjs

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Milestones sync completed successfully"
