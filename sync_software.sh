#!/bin/bash
set -e
export PYTHONPATH=
export PYTHONHOME=

echo "=== Syncing Software (I+E, AI, Hearing) Review Data ==="

# Clear any cached files
echo "Clearing cache..."
rm -f /tmp/W*Experiences*Interfaces*Review*.docx
rm -f /tmp/software_data.json

# Parse the document (parser will find and download latest weekly archive)
echo "Finding and parsing latest Software review document..."
/home/ubuntu/analytics-dashboard/venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_ie_review.py > /tmp/software_data.json

# Load into database
echo "Loading Software data into database..."
cd /home/ubuntu/analytics-dashboard
cat > load_software_temp.mjs << 'ENDSCRIPT'
import { readFileSync } from 'fs';
import { getDb } from './server/db.js';
import { softwareItems } from './drizzle/schema.js';

const sections = JSON.parse(readFileSync('/tmp/software_data.json', 'utf8'));
const db = await getDb();

if (!db) {
  console.error('Failed to connect to database');
  process.exit(1);
}

// Map section names to database categories
const categoryMap = {
  'Experiences & Interfaces': 'software_ie',
  'AI': 'software_ai',
  'Hearing': 'software_hearing'
};

// Clear existing data
await db.delete(softwareItems);

let totalInserted = 0;

// Process each section
for (const section of sections) {
  const sectionName = section.section;
  const dbCategory = categoryMap[sectionName];
  
  if (!dbCategory) {
    console.error(`Unknown section: ${sectionName}`);
    continue;
  }
  
  // Insert wins
  for (let idx = 0; idx < section.wins.length; idx++) {
    await db.insert(softwareItems).values({
      softwareCategory: dbCategory,
      sectionType: 'wins',
      content: section.wins[idx],
      isNew: 0,
      indentLevel: 0,
      order: idx,
    });
    totalInserted++;
  }
  
  // Insert exec summary
  for (let idx = 0; idx < section.exec_summary.length; idx++) {
    await db.insert(softwareItems).values({
      softwareCategory: dbCategory,
      sectionType: 'exec_summary',
      content: section.exec_summary[idx],
      isNew: 0,
      indentLevel: 0,
      order: idx,
    });
    totalInserted++;
  }
  
  // Insert structured decisions
  for (let idx = 0; idx < section.structured_decisions.length; idx++) {
    const decision = section.structured_decisions[idx];
    await db.insert(softwareItems).values({
      softwareCategory: dbCategory,
      sectionType: 'decisions',
      content: '',
      topic: decision.topic || '',
      dri: decision.dri || '',
      forum: decision.forum || '',
      status: decision.status || '',
      decisionDoc: decision.decision_doc || '',
      decisionMakers: decision.decision_makers || '',
      decisionOutcome: decision.decision_outcome || '',
      post: decision.post || '',
      isNew: 0,
      indentLevel: 0,
      order: idx,
    });
    totalInserted++;
  }
  
  console.log(`Synced ${sectionName}: ${section.wins.length} wins, ${section.exec_summary.length} exec items, ${section.structured_decisions.length} decisions`);
}

console.log(`✅ Loaded ${totalInserted} Software items total`);
process.exit(0);
ENDSCRIPT

pnpm exec tsx load_software_temp.mjs
rm load_software_temp.mjs

echo "=== Software sync complete ==="
