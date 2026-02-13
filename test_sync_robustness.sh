#!/bin/bash
# Comprehensive Sync Robustness Test
# Tests all sync scripts and validates time-based edge cases

set -e

echo "🧪 Testing Analytics Dashboard Sync Robustness"
echo "=============================================="
echo ""

# Initialize dependencies first
echo "1️⃣  Checking dependencies..."
bash /home/ubuntu/analytics-dashboard/init_dependencies.sh
echo ""

# Test each sync script
echo "2️⃣  Testing individual sync scripts..."
echo ""

SYNC_RESULTS=()

# Test Devices sync
echo "📱 Testing Devices sync..."
if bash /home/ubuntu/analytics-dashboard/sync_from_gdrive.sh > /tmp/test_devices.log 2>&1; then
    DEVICES_COUNT=$(grep "Loaded.*dashboard items" /tmp/test_devices.log | grep -oP '\d+' | head -1)
    echo "✅ Devices: $DEVICES_COUNT items"
    SYNC_RESULTS+=("✅ Devices: $DEVICES_COUNT items")
else
    echo "❌ Devices sync failed"
    SYNC_RESULTS+=("❌ Devices sync failed")
    cat /tmp/test_devices.log
fi
echo ""

# Test Software sync
echo "💻 Testing Software sync..."
if bash /home/ubuntu/analytics-dashboard/sync_software.sh > /tmp/test_software.log 2>&1; then
    SOFTWARE_COUNT=$(grep "Loaded.*Software items" /tmp/test_software.log | grep -oP '\d+' | head -1)
    echo "✅ Software: $SOFTWARE_COUNT items"
    SYNC_RESULTS+=("✅ Software: $SOFTWARE_COUNT items")
else
    echo "❌ Software sync failed"
    SYNC_RESULTS+=("❌ Software sync failed")
    cat /tmp/test_software.log
fi
echo ""

# Test Systems sync
echo "⚙️  Testing Systems sync..."
if bash /home/ubuntu/analytics-dashboard/sync_systems.sh > /tmp/test_systems.log 2>&1; then
    SYSTEMS_COUNT=$(grep "Loaded.*Systems items" /tmp/test_systems.log | grep -oP '\d+' | head -1)
    echo "✅ Systems: $SYSTEMS_COUNT items"
    SYNC_RESULTS+=("✅ Systems: $SYSTEMS_COUNT items")
else
    echo "❌ Systems sync failed"
    SYNC_RESULTS+=("❌ Systems sync failed")
    cat /tmp/test_systems.log
fi
echo ""

# Test Hearing sync
echo "👂 Testing Hearing sync..."
if bash /home/ubuntu/analytics-dashboard/sync_hearing.sh > /tmp/test_hearing.log 2>&1; then
    HEARING_COUNT=$(grep "Loaded.*hearing items" /tmp/test_hearing.log | grep -oP '\d+' | head -1)
    echo "✅ Hearing: $HEARING_COUNT items"
    SYNC_RESULTS+=("✅ Hearing: $HEARING_COUNT items")
else
    echo "❌ Hearing sync failed"
    SYNC_RESULTS+=("❌ Hearing sync failed")
    cat /tmp/test_hearing.log
fi
echo ""

# Test AI sync
echo "🤖 Testing AI sync..."
if bash /home/ubuntu/analytics-dashboard/sync_ai.sh > /tmp/test_ai.log 2>&1; then
    AI_COUNT=$(grep "Loaded.*AI items" /tmp/test_ai.log | grep -oP '\d+' | head -1)
    echo "✅ AI: $AI_COUNT items"
    SYNC_RESULTS+=("✅ AI: $AI_COUNT items")
else
    echo "❌ AI sync failed"
    SYNC_RESULTS+=("❌ AI sync failed")
    cat /tmp/test_ai.log
fi
echo ""

# Test Decisions sync
echo "📋 Testing Decisions sync..."
if bash /home/ubuntu/analytics-dashboard/sync_decisions.sh > /tmp/test_decisions.log 2>&1; then
    DECISIONS_COUNT=$(grep "Loading.*decisions" /tmp/test_decisions.log | grep -oP '\d+' | head -1)
    echo "✅ Decisions: $DECISIONS_COUNT items"
    SYNC_RESULTS+=("✅ Decisions: $DECISIONS_COUNT items")
else
    echo "❌ Decisions sync failed"
    SYNC_RESULTS+=("❌ Decisions sync failed")
    cat /tmp/test_decisions.log
fi
echo ""

# Test Milestones sync
echo "📅 Testing Milestones sync..."
if bash /home/ubuntu/analytics-dashboard/sync_milestones.sh > /tmp/test_milestones.log 2>&1; then
    MILESTONES_COUNT=$(grep "Parsed.*milestones" /tmp/test_milestones.log | grep -oP '\d+' | head -1)
    echo "✅ Milestones: $MILESTONES_COUNT items"
    SYNC_RESULTS+=("✅ Milestones: $MILESTONES_COUNT items")
else
    echo "❌ Milestones sync failed"
    SYNC_RESULTS+=("❌ Milestones sync failed")
    cat /tmp/test_milestones.log
fi
echo ""

# Test Upcoming Reviews sync
echo "📆 Testing Upcoming Reviews sync..."
if timeout 60 bash /home/ubuntu/analytics-dashboard/sync_upcoming_reviews.sh > /tmp/test_upcoming.log 2>&1; then
    UPCOMING_COUNT=$(grep "Parsed.*upcoming reviews" /tmp/test_upcoming.log | grep -oP '\d+' | head -1)
    echo "✅ Upcoming Reviews: $UPCOMING_COUNT items"
    SYNC_RESULTS+=("✅ Upcoming Reviews: $UPCOMING_COUNT items")
else
    echo "❌ Upcoming Reviews sync failed"
    SYNC_RESULTS+=("❌ Upcoming Reviews sync failed")
    cat /tmp/test_upcoming.log
fi
echo ""

# Summary
echo "=============================================="
echo "📊 Sync Test Summary:"
echo "=============================================="
for result in "${SYNC_RESULTS[@]}"; do
    echo "$result"
done
echo ""

# Check if all passed
FAILED_COUNT=$(printf '%s\n' "${SYNC_RESULTS[@]}" | grep -c "❌" || true)
if [ "$FAILED_COUNT" -eq 0 ]; then
    echo "✅ All syncs passed!"
    exit 0
else
    echo "❌ $FAILED_COUNT sync(s) failed"
    exit 1
fi
