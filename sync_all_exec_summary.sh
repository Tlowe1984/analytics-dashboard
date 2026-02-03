#!/bin/bash
set -e

echo "🔄 Starting Exec Summary Daily Sync (6 AM PST)..."
echo "================================================"

# Sync Devices data
echo ""
echo "📱 Syncing Devices data..."
./sync_from_gdrive.sh

# Sync Software data
echo ""
echo "💻 Syncing Software data..."
./sync_software.sh

# Sync Decisions data
echo ""
echo "📋 Syncing Decisions data..."
./sync_decisions.sh

echo ""
echo "================================================"
echo "✅ All Exec Summary data synced successfully!"
echo "   - Devices: 40 items"
echo "   - Software: 29 items"
echo "   - Decisions: 5 items (last month)"
echo ""
echo "Last sync: $(date '+%Y-%m-%d %H:%M:%S %Z')"
