#!/usr/bin/env node
/**
 * Test script to verify TypeScript parsers work correctly
 */

import { syncAll } from './server/googleDriveSync.ts';

console.log('🧪 Testing TypeScript parsers...\n');

try {
  const result = await syncAll(true); // Force refresh
  
  console.log('\n✅ Sync completed successfully!');
  console.log('\nResults:');
  console.log(`- Devices: ${result.devices.success ? '✅' : '❌'} ${result.devices.message}`);
  console.log(`- Software: ${result.software.success ? '✅' : '❌'} ${result.software.message}`);
  console.log(`- Systems: ${result.systems.success ? '✅' : '❌'} ${result.systems.message}`);
  console.log(`- Decisions: ${result.decisions.success ? '✅' : '❌'} ${result.decisions.message}`);
  console.log(`- Milestones: ${result.milestones.success ? '✅' : '❌'} ${result.milestones.message}`);
  console.log(`- Upcoming Reviews: ${result.upcomingReviews.success ? '✅' : '❌'} ${result.upcomingReviews.message}`);
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Sync failed:', error);
  process.exit(1);
}
