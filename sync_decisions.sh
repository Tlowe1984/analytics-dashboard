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

echo "🔄 Syncing Decisions from Google Drive..."

# Download the Wearable Decisions Canonical document (Google Doc, needs export)
echo "📥 Downloading Wearable Decisions Canonical..."
# Delete old file to force fresh download
rm -f "/tmp/Wearable Decisions Canonical .docx"
rclone copy "manus_google_drive:Wearables Everything/Wearable Decisions Canonical .docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini --drive-export-formats docx --drive-skip-gdocs=false --ignore-times --no-check-certificate

# Parse decisions
echo "📊 Parsing decisions..."
/home/ubuntu/analytics-dashboard/venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_decisions.py "/tmp/Wearable Decisions Canonical .docx" > /tmp/decisions_data.json

# Load into database
echo "💾 Loading decisions data into database..."
cd /home/ubuntu/analytics-dashboard
pnpm exec tsx << 'EOF'
import fs from 'fs';
import { getDb, clearDecisions, insertDecision } from './server/db';

async function loadDecisions() {
  const data = JSON.parse(fs.readFileSync('/tmp/decisions_data.json', 'utf8'));
  
  // Clear existing decisions
  await clearDecisions();
  
  // Insert new decisions
  console.log(`Loading ${data.length} decisions into database...`);
  for (const decision of data) {
    await insertDecision({
      week: decision.week,
      dri: decision.dri,
      forum: decision.forum || '',
      status: decision.status || '',
      decisionOutcome: decision.decision_outcome
    });
  }
  
  console.log('Decisions data loaded successfully!');
  process.exit(0);
}

loadDecisions().catch(err => {
  console.error('Error loading decisions:', err);
  process.exit(1);
});
EOF

echo "✅ Decisions sync complete! Refresh your browser to see the updated data."
