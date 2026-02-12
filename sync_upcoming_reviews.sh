#!/bin/bash
set -e

echo "🔄 Syncing Upcoming Reviews from Google Drive..."

# Download the three review sign-up sheets
echo "📥 Downloading review sign-up sheets..."
# Delete old files to force fresh downloads
rm -f "/tmp/2026 Wearables Reviews Sign-Up Sheet .xlsx"
rm -f "/tmp/2026 Product Reviews Sign-Up Sheet.xlsx"
rm -f "/tmp/Systems Reviews Sign-Up Sheet .xlsx"
rclone copy "manus_google_drive:2026 Wearables Reviews Sign-Up Sheet .xlsx" /tmp --config /home/ubuntu/.gdrive-rclone.ini
rclone copy "manus_google_drive:2026 Product Reviews Sign-Up Sheet.xlsx" /tmp --config /home/ubuntu/.gdrive-rclone.ini
rclone copy "manus_google_drive:Systems Reviews Sign-Up Sheet .xlsx" /tmp --config /home/ubuntu/.gdrive-rclone.ini

# Parse upcoming reviews
echo "📊 Parsing upcoming reviews..."
cd /home/ubuntu/analytics-dashboard
python3.11 server/parse_upcoming_reviews.py > /dev/null

# Load into database
echo "💾 Loading upcoming reviews data into database..."
node server/load_upcoming_reviews.mjs

echo "✅ Upcoming reviews sync complete! Refresh your browser to see the updated data."
