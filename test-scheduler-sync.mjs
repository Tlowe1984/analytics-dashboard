/**
 * Test script to manually trigger the scheduler sync
 * This verifies the scheduler's sync logic works correctly
 */

import { triggerManualSync } from './server/sync-scheduler.ts';

console.log('Testing scheduler sync...\n');

try {
  const result = await triggerManualSync();
  console.log('\n✅ Scheduler sync test completed');
  console.log('Result:', result);
  process.exit(result.success ? 0 : 1);
} catch (error) {
  console.error('\n❌ Scheduler sync test failed');
  console.error(error);
  process.exit(1);
}
