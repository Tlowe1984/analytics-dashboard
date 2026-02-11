import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface SyncResult {
  success: boolean;
  message: string;
  timestamp: Date;
  itemsUpdated?: number;
  error?: string;
  duration?: number;
}

// Sync mutex to prevent concurrent syncs
let syncInProgress = false;

/**
 * Sync all dashboard data using bash scripts (with weekly archive detection)
 */
export async function syncAllBash(): Promise<{
  devices: SyncResult;
  software: SyncResult;
  systems: SyncResult;
  decisions: SyncResult;
  milestones: SyncResult;
  upcomingReviews: SyncResult;
}> {
  // Check if sync is already in progress
  if (syncInProgress) {
    console.log("⚠️ Sync already in progress, skipping...");
    const skipResult = { success: false, message: "Sync already in progress", timestamp: new Date() };
    return {
      devices: skipResult,
      software: skipResult,
      systems: skipResult,
      decisions: skipResult,
      milestones: skipResult,
      upcomingReviews: skipResult,
    };
  }

  // Set mutex lock
  syncInProgress = true;
  const overallStart = Date.now();

  console.log("🚀 Starting comprehensive sync using bash scripts...");

  try {
    const results: {
      devices: SyncResult;
      software: SyncResult;
      systems: SyncResult;
      decisions: SyncResult;
      milestones: SyncResult;
      upcomingReviews: SyncResult;
    } = {
      devices: { success: false, message: "", timestamp: new Date() },
      software: { success: false, message: "", timestamp: new Date() },
      systems: { success: false, message: "", timestamp: new Date() },
      decisions: { success: false, message: "", timestamp: new Date() },
      milestones: { success: false, message: "", timestamp: new Date() },
      upcomingReviews: { success: false, message: "", timestamp: new Date() },
    };

    // Run all sync scripts in parallel for speed
    const scripts = [
      { name: "devices", script: "sync_from_gdrive.sh" },
      { name: "software", script: "sync_software.sh" },
      { name: "systems", script: "sync_systems.sh" },
      { name: "decisions", script: "sync_decisions.sh" },
      { name: "milestones", script: "sync_milestones.sh" },
      { name: "upcomingReviews", script: "sync_upcoming_reviews.sh" },
    ];

    console.log(`📥 Starting ${scripts.length} syncs in parallel...`);

    // Run all scripts in parallel
    const syncPromises = scripts.map(async ({ name, script }) => {
      const startTime = Date.now();
      try {
        console.log(`📥 Running ${script}...`);
        const { stdout, stderr } = await execAsync(
          `cd /home/ubuntu/analytics-dashboard && bash ${script}`,
          { timeout: 180000, shell: "/bin/bash" }
        );

        const duration = Date.now() - startTime;
        
        // Extract item count from output
        const match = stdout.match(/Loaded (\d+)/i) || stdout.match(/(\d+)\s+items/i);
        const itemsUpdated = match ? parseInt(match[1]) : 0;

        const result: SyncResult = {
          success: true,
          message: `Synced successfully (${itemsUpdated} items)`,
          timestamp: new Date(),
          itemsUpdated,
          duration,
        };

        console.log(`✅ ${name} sync complete (${(duration / 1000).toFixed(1)}s, ${itemsUpdated} items)`);
        return { name, result };
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        const result: SyncResult = {
          success: false,
          message: `Failed to sync ${name}`,
          timestamp: new Date(),
          itemsUpdated: 0,
          duration,
          error: errorMessage,
        };

        console.error(`❌ ${name} sync failed:`, errorMessage);
        return { name, result };
      }
    });

    // Wait for all syncs to complete
    const syncResults = await Promise.all(syncPromises);
    
    // Map results back to the results object
    for (const { name, result } of syncResults) {
      results[name as keyof typeof results] = result;
    }

    const overallDuration = Date.now() - overallStart;
    console.log(`✨ Overall sync complete (${(overallDuration / 1000).toFixed(1)}s)`);

    return results;
  } finally {
    // Release mutex lock
    syncInProgress = false;
  }
}
