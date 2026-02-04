#!/usr/bin/env node
/**
 * Daily sync script for scheduled task
 * Always forces full refresh to ensure production has latest data
 */

import { syncAll } from './server/googleDriveSync.ts';

console.log('🔄 Starting daily sync with force refresh...\n');

try {
  // Always force refresh for daily sync to avoid stale data
  const result = await syncAll(true);
  
  console.log('\n✅ Daily sync completed successfully!');
  console.log('\nResults:');
  console.log(`- Devices: ${result.devices.success ? '✅' : '❌'} ${result.devices.message}`);
  console.log(`- Software: ${result.software.success ? '✅' : '❌'} ${result.software.message}`);
  console.log(`- Systems: ${result.systems.success ? '✅' : '❌'} ${result.systems.message}`);
  console.log(`- Decisions: ${result.decisions.success ? '✅' : '❌'} ${result.decisions.message}`);
  console.log(`- Milestones: ${result.milestones.success ? '✅' : '❌'} ${result.milestones.message}`);
  console.log(`- Upcoming Reviews: ${result.upcomingReviews.success ? '✅' : '❌'} ${result.upcomingReviews.message}`);
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Daily sync failed:', error);
  process.exit(1);
}
