#!/bin/bash
# Manual sync script to refresh dashboard data from Google Drive
# Run this script whenever you need to update the dashboard with latest Google Doc data

set -e
export PYTHONPATH=
export PYTHONHOME=

echo "📥 Downloading Google Doc from Drive..."
rclone copy "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Device & Growth Canonical Program Review.docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini

echo "📊 Parsing executive summary..."
/home/ubuntu/analytics-dashboard/venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_exec_summary.py "/tmp/Device & Growth Canonical Program Review.docx" > /tmp/parsed_data.json

echo "💾 Loading data into database..."
cd /home/ubuntu/analytics-dashboard
pnpm exec tsx << 'EOF'
import { readFileSync, existsSync } from 'fs';
import { clearAllDashboardItems, createDashboardItem } from './server/db.ts';

if (existsSync('/tmp/parsed_data.json')) {
  const data = JSON.parse(readFileSync('/tmp/parsed_data.json', 'utf-8'));
  console.log(`Loading ${data.length} dashboard items...`);
  
  // Clear existing items
  await clearAllDashboardItems();
  
  // Insert new items
  for (const item of data) {
    await createDashboardItem({
      sectionType: item.section,
      productCategory: item.product,
      content: item.content,
      isNew: item.is_new || false,
      indentLevel: item.indent_level || 0,
      order: item.order || 0
    });
  }
  
  console.log(`✅ Loaded ${data.length} dashboard items`);
  process.exit(0);
} else {
  console.error('❌ /tmp/parsed_data.json not found');
  process.exit(1);
}
EOF

echo "✅ Devices sync complete! Refresh your browser to see the updated data."
exit 0
