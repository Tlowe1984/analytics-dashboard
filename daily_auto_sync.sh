#!/bin/bash
# Daily Auto-Sync Script for Analytics Dashboard
# Runs all 8 data source syncs automatically

set -e
cd /home/ubuntu/analytics-dashboard

echo "🔄 Starting daily auto-sync at $(date)"

# Run all sync scripts
bash sync_devices.sh
bash sync_software.sh  
bash sync_systems.sh
bash sync_hearing.sh
bash sync_ai.sh
bash sync_decisions.sh
bash sync_milestones.sh
bash sync_upcoming_reviews.sh

echo "✅ Daily auto-sync completed at $(date)"
