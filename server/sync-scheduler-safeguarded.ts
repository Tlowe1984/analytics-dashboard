import { schedule } from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import { notifyOwner } from "./_core/notification";

const execAsync = promisify(exec);

// Sync runs daily at 6:00 AM PST
const SYNC_SCHEDULE = "0 6 * * *"; // Cron: minute hour day month weekday
const SYNC_TIMEZONE = "America/Los_Angeles"; // PST/PDT

// Track last sync status
let lastSyncStatus: {
  timestamp: Date;
  success: boolean;
  duration: number;
  error?: string;
} | null = null;

/**
 * Run the safeguarded sync script
 */
async function runSafeguardedSync(): Promise<void> {
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] Starting safeguarded sync...`);

  try {
    const { stdout, stderr } = await execAsync(
      "bash /home/ubuntu/analytics-dashboard/sync_with_safeguards.sh",
      {
        cwd: "/home/ubuntu/analytics-dashboard",
        timeout: 600000, // 10 minutes max
      }
    );

    const duration = Date.now() - startTime;
    
    // Log output
    if (stdout) {
      console.log(`[${new Date().toISOString()}] Sync output:\n${stdout}`);
    }
    if (stderr) {
      console.warn(`[${new Date().toISOString()}] Sync warnings:\n${stderr}`);
    }

    // Update status
    lastSyncStatus = {
      timestamp: new Date(),
      success: true,
      duration: Math.round(duration / 1000),
    };

    console.log(`[${new Date().toISOString()}] ✅ Safeguarded sync completed successfully in ${lastSyncStatus.duration}s`);

    // Notify owner of successful sync
    await notifyOwner({
      title: "Dashboard Sync Successful",
      content: `Sync completed in ${lastSyncStatus.duration}s with all safeguards passed.`,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || "Unknown error";

    // Update status
    lastSyncStatus = {
      timestamp: new Date(),
      success: false,
      duration: Math.round(duration / 1000),
      error: errorMessage,
    };

    console.error(`[${new Date().toISOString()}] ❌ Safeguarded sync failed:`, errorMessage);
    
    // Log stderr if available
    if (error.stderr) {
      console.error(`[${new Date().toISOString()}] Sync error output:\n${error.stderr}`);
    }

    // Notify owner of failure
    await notifyOwner({
      title: "⚠️ Dashboard Sync Failed",
      content: `Sync failed after ${lastSyncStatus.duration}s. Error: ${errorMessage}\n\nPlease check the sync logs and investigate.`,
    });

    // Re-throw to let scheduler know it failed
    throw error;
  }
}

/**
 * Get last sync status (for monitoring endpoint)
 */
export function getLastSyncStatus() {
  return lastSyncStatus;
}

/**
 * Initialize the sync scheduler
 */
export function initializeSyncScheduler(): void {
  console.log(`[${new Date().toISOString()}] Initializing safeguarded sync scheduler...`);
  console.log(`[${new Date().toISOString()}] Schedule: Daily at 6:00 AM PST`);

  // Schedule the sync
  schedule(
    SYNC_SCHEDULE,
    async () => {
      try {
        await runSafeguardedSync();
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Scheduled sync failed, will retry tomorrow`);
      }
    },
    {
      timezone: SYNC_TIMEZONE,
    }
  );

  console.log(`[${new Date().toISOString()}] ✅ Safeguarded sync scheduler initialized successfully`);
  console.log(`[${new Date().toISOString()}] Next sync will run at 6:00 AM PST`);
}

/**
 * Manually trigger a sync (for testing or manual refresh)
 */
export async function triggerManualSync(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Manual sync triggered`);
  await runSafeguardedSync();
}
