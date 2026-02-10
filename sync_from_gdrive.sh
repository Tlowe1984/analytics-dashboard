#!/bin/bash
# Manual sync script to refresh dashboard data from Google Drive
# Run this script whenever you need to update the dashboard with latest Google Doc data

set -e
export PYTHONPATH=
export PYTHONHOME=

echo "📥 Downloading Google Doc from Drive..."
rclone copy "manus_google_drive:Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Program Review archive/W6 2026 Device & Growth Canonical Program Review.docx" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini

echo "📊 Parsing executive summary..."
/home/ubuntu/analytics-dashboard/venv/bin/python /home/ubuntu/analytics-dashboard/server/parse_exec_summary.py "/tmp/W6 2026 Device & Growth Canonical Program Review.docx" > /tmp/parsed_data.json

echo "💾 Loading data into database..."
cd /home/ubuntu/analytics-dashboard
pnpm exec tsx load_data.mjs

echo "✅ Sync complete! Refresh your browser to see the updated data."
