#!/bin/bash

# Comprehensive Sync Verification Script
# Tests all 8 data sources for both Admin Refresh and Daily Auto-Sync
# Run this after making changes to ensure all syncs work correctly

set -e

echo "🔍 COMPREHENSIVE SYNC VERIFICATION"
echo "===================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
declare -A sync_results
declare -A item_counts

# Function to test a single sync script
test_sync() {
  local name=$1
  local script=$2
  local table=$3
  local count_query=$4
  
  echo "📥 Testing: $name ($script)"
  
  # Run sync script with timeout
  if timeout 120 bash "$script" > /tmp/sync_${name}.log 2>&1; then
    # Check if data was loaded
    local count=$(pnpm exec tsx << EOF
import { getDb } from './server/db';
const db = await getDb();
if (!db) { console.log('0'); process.exit(0); }
const result = await db.execute(\`SELECT COUNT(*) as count FROM ${table}\`);
console.log(result[0]?.count || 0);
process.exit(0);
EOF
)
    
    if [ "$count" -gt 0 ]; then
      echo -e "${GREEN}✓${NC} $name: SUCCESS ($count items)"
      sync_results[$name]="SUCCESS"
      item_counts[$name]=$count
    else
      echo -e "${RED}✗${NC} $name: FAILED (0 items loaded)"
      sync_results[$name]="FAILED"
      item_counts[$name]=0
      cat /tmp/sync_${name}.log | tail -20
    fi
  else
    echo -e "${RED}✗${NC} $name: FAILED (script error or timeout)"
    sync_results[$name]="FAILED"
    item_counts[$name]=0
    cat /tmp/sync_${name}.log | tail -20
  fi
  
  echo ""
}

# Test all 8 sync scripts
echo "TESTING INDIVIDUAL SYNC SCRIPTS"
echo "--------------------------------"
echo ""

test_sync "Devices" "sync_from_gdrive.sh" "dashboard_items" "SELECT COUNT(*) as count FROM dashboard_items"
test_sync "Software" "sync_software.sh" "software_items" "SELECT COUNT(*) as count FROM software_items"
test_sync "Systems" "sync_systems.sh" "systems_items" "SELECT COUNT(*) as count FROM systems_items"
test_sync "Hearing" "sync_hearing.sh" "hearing_items" "SELECT COUNT(*) as count FROM hearing_items"
test_sync "AI" "sync_ai.sh" "ai_items" "SELECT COUNT(*) as count FROM ai_items"
test_sync "Decisions" "sync_decisions.sh" "decisions" "SELECT COUNT(*) as count FROM decisions"
test_sync "Milestones" "sync_milestones.sh" "milestones" "SELECT COUNT(*) as count FROM milestones"
test_sync "Upcoming Reviews" "sync_upcoming_reviews.sh" "upcoming_reviews" "SELECT COUNT(*) as count FROM upcoming_reviews"

# Print summary
echo ""
echo "SUMMARY REPORT"
echo "=============="
echo ""

success_count=0
fail_count=0

for name in "Devices" "Software" "Systems" "Hearing" "AI" "Decisions" "Milestones" "Upcoming Reviews"; do
  status=${sync_results[$name]}
  count=${item_counts[$name]}
  
  if [ "$status" = "SUCCESS" ]; then
    echo -e "${GREEN}✓${NC} $name: $count items"
    ((success_count++))
  else
    echo -e "${RED}✗${NC} $name: FAILED"
    ((fail_count++))
  fi
done

echo ""
echo "Results: $success_count succeeded, $fail_count failed"
echo ""

if [ $fail_count -gt 0 ]; then
  echo -e "${RED}⚠ Some syncs failed. Check logs above for details.${NC}"
  exit 1
else
  echo -e "${GREEN}✓ All syncs completed successfully!${NC}"
  exit 0
fi
