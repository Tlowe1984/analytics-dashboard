/**
 * Sync Scheduler - Runs daily data sync at 6 AM
 * 
 * This module sets up a cron job that automatically syncs all dashboard data
 * from Google Drive every day at 6 AM. It includes error handling and notifications.
 */

import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { notifyOwner } from './_core/notification';
import { appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

const LOG_FILE = join(__dirname, '../.manus-logs/sync-scheduler.log');
const SYNC_SCRIPT = '/home/ubuntu/analytics-dashboard/sync_all_data.sh';

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
 * Run the sync script
 */
async function runSync() {
  log('========================================');
  log('Starting scheduled sync');
  log('========================================');
  
  try {
    const { stdout, stderr } = await execAsync(
      `bash ${SYNC_SCRIPT}`,
      { 
        timeout: 600000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    );
    
    log('Sync completed successfully');
    
    if (stdout) {
      log('Output:');
      log(stdout);
    }
    
    if (stderr) {
      log('Warnings:');
      log(stderr);
    }
    
    return { success: true };
  } catch (error: any) {
    log('Sync failed with error:');
    log(error.message);
    
    if (error.stdout) {
      log('Partial output:');
      log(error.stdout);
    }
    
    if (error.stderr) {
      log('Error output:');
      log(error.stderr);
    }
    
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
  // Run daily at 6:00 AM (0 6 * * *)
  // Cron format: second minute hour day month weekday
  // node-cron uses 5-field format (no seconds): minute hour day month weekday
  const schedule = '0 6 * * *'; // 6:00 AM every day
  
  log('Initializing sync scheduler');
  log(`Schedule: Daily at 6:00 AM (cron: ${schedule})`);
  
  cron.schedule(schedule, async () => {
    await runSync();
  }, {
    timezone: 'America/Los_Angeles' // PST/PDT
  });
  
  log('✅ Sync scheduler initialized successfully');
  log('Next sync will run at 6:00 AM PST');
  
  // Optional: Run sync on startup (commented out by default)
  // Uncomment if you want to sync immediately when server starts
  // log('Running initial sync on startup...');
  // runSync();
}

/**
 * Manually trigger a sync (for testing or manual refresh)
 */
export async function triggerManualSync() {
  log('Manual sync triggered');
  return await runSync();
}
