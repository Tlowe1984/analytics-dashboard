/**
 * Sync Scheduler - Runs daily data sync at 6 AM
 * 
 * This module sets up a cron job that automatically syncs all dashboard data
 * from Google Drive every day at 6 AM. It includes error handling and notifications.
 */

import cron from 'node-cron';
import { notifyOwner } from './_core/notification';
import { appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOG_FILE = join(__dirname, '../.manus-logs/sync-scheduler.log');

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  try {
    appendFileSync(LOG_FILE, logMessage);
  } catch (error) {
    console.error('[Sync Scheduler] Failed to write to log file:', error);
  }
}

/**
 * Run the sync using TypeScript sync function
 */
async function runSync() {
  log('========================================')
  log('Starting scheduled sync');
  log('========================================')
  
  try {
    // Import and call the bash script sync function (with weekly archive detection)
    const { syncAllBash } = await import('./syncAllBash');
    
    log('Syncing all 7 data sources using bash scripts...');
    const result = await syncAllBash();
    
    // Log results for each source
    const sources = ['devices', 'software', 'systems', 'hearing', 'decisions', 'milestones', 'upcomingReviews'] as const;
    let successCount = 0;
    let failCount = 0;
    
    for (const source of sources) {
      const sourceResult = result[source];
      if (sourceResult.success) {
        successCount++;
        log(`✅ ${source}: ${sourceResult.message}`);
      } else {
        failCount++;
        log(`❌ ${source}: ${sourceResult.message}`);
      }
    }
    
    log('========================================')
    log(`Sync completed: ${successCount} succeeded, ${failCount} failed`);
    log('========================================')
    
    if (failCount > 0) {
      // Notify owner of partial failure
      try {
        await notifyOwner({
          title: '⚠️ Dashboard Sync Completed with Errors',
          content: `Daily sync at ${new Date().toLocaleString()}:\n\n${successCount} sources succeeded\n${failCount} sources failed\n\nCheck logs for details.`
        });
      } catch (notifyError) {
        log('Failed to send notification: ' + notifyError);
      }
    }
    
    return { success: failCount === 0 };
  } catch (error: any) {
    log('Sync failed with error:');
    log(error.message);
    log(error.stack || '');
    
    // Notify owner of failure
    try {
      await notifyOwner({
        title: '⚠️ Dashboard Sync Failed',
        content: `Daily sync failed at ${new Date().toLocaleString()}:\n\n${error.message}\n\nCheck logs for details.`
      });
    } catch (notifyError) {
      log('Failed to send notification: ' + notifyError);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the cron scheduler
 */
export function initSyncScheduler() {
  // Run daily at 9:15 AM (15 9 * * *) - Changed for testing
  // Cron format: second minute hour day month weekday
  // node-cron uses 5-field format (no seconds): minute hour day month weekday
  const schedule = '15 9 * * *'; // 9:15 AM every day
  
  log('Initializing sync scheduler');
  log(`Schedule: Daily at 9:15 AM (cron: ${schedule})`);
  
  cron.schedule(schedule, async () => {
    await runSync();
  }, {
    timezone: 'America/Los_Angeles' // PST/PDT
  });
  
  log('✅ Sync scheduler initialized successfully');
  log('Next sync will run at 9:15 AM PST');
  
  // Optional: Run sync on startup (commented out by default)
  // Uncomment if you want to sync immediately when server starts
  // log('Running initial sync on startup to test fixes...');
  // runSync();
}

/**
 * Manually trigger a sync (for testing or manual refresh)
 */
export async function triggerManualSync() {
  log('Manual sync triggered');
  return await runSync();
}
