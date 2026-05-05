/**
 * Sync Scheduler - Runs daily data sync at 8:45 AM PST
 * 
 * This module sets up a cron job that automatically syncs all dashboard data
 * from Google Drive every day at 8:45 AM PST. It includes error handling and notifications.
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
 * Run the sync using the Node.js-native scheduledSync module.
 * Works in both development and production environments.
 * Uses GOOGLE_WORKSPACE_CLI_TOKEN + Google Drive API v3 (no rclone/Python needed).
 */
async function runSync() {
  log('========================================')
  log('Starting scheduled sync (Node.js-native)');
  log('========================================')
  
  try {
    // Step 1: Clear query cache before sync
    log('🧽 Clearing query cache...');
    const { invalidateDashboardCache } = await import('./query-cache');
    await invalidateDashboardCache();
    log('✅ Query cache cleared');
    
    // Step 2: Run Node.js-native sync (works in both production and development)
    // Uses GOOGLE_WORKSPACE_CLI_TOKEN + Google Drive API v3 directly.
    // No rclone, Python, or bash tools required.
    const { runScheduledSync } = await import('./scheduledSync');
    log('Syncing all 8 data sources via Google Drive API...');
    const result = await runScheduledSync();
    
    // Log results for each source
    let successCount = 0;
    let failCount = 0;
    for (const [source, sourceResult] of Object.entries(result.sources)) {
      if (sourceResult.success) {
        successCount++;
        log(`✅ ${source}: ${sourceResult.items} items`);
      } else {
        failCount++;
        log(`❌ ${source}: ${sourceResult.error || 'failed'}`);
      }
    }
    
    log('========================================')
    log(`Sync completed: ${successCount} succeeded, ${failCount} failed (${result.totalItems} total items, ${(result.durationMs/1000).toFixed(1)}s)`);
    log('========================================')
    
    if (failCount > 0) {
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
  // Run daily at 8:45 AM PST (45 8 * * *)
  // Cron format: minute hour day month weekday
  // node-cron uses 5-field format (no seconds)
  const schedule = '45 8 * * *'; // 8:45 AM every day
  
  log('Initializing sync scheduler');
  log(`Schedule: Daily at 8:45 AM PST (cron: ${schedule})`);
  
  cron.schedule(schedule, async () => {
    await runSync();
  }, {
    timezone: 'America/Los_Angeles' // PST/PDT
  });
  
  log('✅ Sync scheduler initialized successfully');
  log('Next sync will run at 8:45 AM PST');
  
  // The sync now uses Node.js-native Google Drive API (no rclone/Python needed),
  // so it works in both production and development environments.
  // Startup sync is skipped to avoid blocking the server during first-load.
  log('Sync scheduler ready. Next sync at 8:45 AM PST. No startup sync (use /api/scheduled/sync to trigger manually).');
}

/**
 * Manually trigger a sync (for testing or manual refresh)
 */
export async function triggerManualSync() {
  log('Manual sync triggered');
  return await runSync();
}
