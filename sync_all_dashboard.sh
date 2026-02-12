#!/bin/bash
set -e

echo "🔄 Starting Dashboard Daily Sync (6 AM PST)..."
echo "================================================"

# Sync Devices data
echo ""
echo "📱 Syncing Devices data..."
./sync_from_gdrive.sh

# Sync Software data
echo ""
echo "💻 Syncing Software data..."
./sync_software.sh

# Sync Systems data
echo ""
echo "🖥️  Syncing Systems data..."
./sync_systems.sh

# Sync Hearing data
echo ""
echo "🏯 Syncing Hearing data..."
./sync_hearing.sh

# Sync AI data
echo ""
echo "🤖 Syncing AI data..."
./sync_ai.sh

# Sync Decisions data
echo ""
echo "📋 Syncing Decisions data..."
./sync_decisions.sh

# Sync Milestones data
echo ""
echo "📅 Syncing Milestones data..."
./sync_milestones.sh

# Sync Upcoming Reviews data
echo ""
echo "🔮 Syncing Upcoming Reviews data..."
./sync_upcoming_reviews.sh

echo ""
echo "================================================"
echo "✅ All dashboard data synced successfully!"
echo "   - Devices: ~62 items"
echo "   - Software: ~30 items"
echo "   - Systems: ~30 items"
echo "   - Hearing: ~45 items"
echo "   - AI: ~43 items"
echo "   - Decisions: ~17 items"
echo "   - Milestones: ~666 items"
echo "   - Upcoming Reviews: varies"
echo ""
echo "Last sync: $(date '+%Y-%m-%d %H:%M:%S %Z')"
