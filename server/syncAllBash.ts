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
  hearing: SyncResult;
  ai: SyncResult;
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
      hearing: skipResult,
      ai: skipResult,
      decisions: skipResult,
      milestones: skipResult,
      upcomingReviews: skipResult,
    };
  }

  // Set mutex lock
  syncInProgress = true;
  const overallStart = Date.now();

  console.log("🚀 Starting comprehensive sync using bash scripts...");

  // Auto-rebuild Python venv if broken (uses persistent path outside project dir to survive checkpoints)
  try {
    await execAsync(
      '/home/ubuntu/wearables-venv/bin/python -c "import json, docx, openpyxl" 2>/dev/null || (python3.11 -m venv /home/ubuntu/wearables-venv && /home/ubuntu/wearables-venv/bin/pip install --quiet python-docx openpyxl requests)',
      { timeout: 120000, shell: '/bin/bash' }
    );
    console.log('✅ Python venv health check passed');
  } catch (venvErr) {
    console.warn('⚠️ Python venv check/rebuild failed:', venvErr instanceof Error ? venvErr.message.slice(0, 100) : String(venvErr));
  }

  // Note: Google Drive token refresh is handled automatically by Manus integration
  // The rclone config at /home/ubuntu/.gdrive-rclone.ini is managed by the platform
  // and tokens are refreshed automatically when they expire

  // Helper function to run sync with retry logic
  const runSyncWithRetry = async (name: string, script: string, maxRetries = 3): Promise<{ stdout: string; stderr: string }> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📥 Running ${script} (attempt ${attempt}/${maxRetries})...`);
        const result = await execAsync(
          `cd /home/ubuntu/analytics-dashboard && bash ${script}`,
          { timeout: 180000, shell: "/bin/bash" }
        );
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTokenError = errorMessage.includes("token expired") || 
                             errorMessage.includes("CRITICAL: Failed to create file system");
        const isSreMismatch = errorMessage.includes("SRE module mismatch") || errorMessage.includes("AssertionError");
        
        // Don't retry SRE mismatch errors (Python env issue, not a transient error)
        if (isSreMismatch) {
          throw error;
        }
        if (isTokenError && attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.warn(`⚠️ ${name} sync failed with token error (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Failed after ${maxRetries} retries`);
  };

  try {
    const results: {
      devices: SyncResult;
      software: SyncResult;
      systems: SyncResult;
      hearing: SyncResult;
      ai: SyncResult;
      decisions: SyncResult;
      milestones: SyncResult;
      upcomingReviews: SyncResult;
    } = {
      devices: { success: false, message: "", timestamp: new Date() },
      software: { success: false, message: "", timestamp: new Date() },
      systems: { success: false, message: "", timestamp: new Date() },
      hearing: { success: false, message: "", timestamp: new Date() },
      ai: { success: false, message: "", timestamp: new Date() },
      decisions: { success: false, message: "", timestamp: new Date() },
      milestones: { success: false, message: "", timestamp: new Date() },
      upcomingReviews: { success: false, message: "", timestamp: new Date() },
    };

    // Run all sync scripts in parallel for speed
    const scripts = [
      { name: "devices", script: "sync_from_gdrive.sh" },
      { name: "software", script: "sync_software.sh" },
      { name: "systems", script: "sync_systems.sh" },
      { name: "hearing", script: "sync_hearing.sh" },
      { name: "ai", script: "sync_ai.sh" },
      { name: "decisions", script: "sync_decisions.sh" },
      { name: "milestones", script: "sync_milestones.sh" },
      { name: "upcomingReviews", script: "sync_upcoming_reviews.sh" }
    ];

    console.log(`📥 Starting ${scripts.length} syncs sequentially to avoid Google Drive API rate limits...`);

    // Run all scripts sequentially to avoid Google Drive API race conditions
    const syncResults: Array<{ name: string; result: SyncResult }> = [];
    
    for (const { name, script } of scripts) {
      const startTime = Date.now();
      try {
        const { stdout, stderr } = await runSyncWithRetry(name, script);

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
        syncResults.push({ name, result });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Check if it's a token error for better error message
        const isTokenError = errorMessage.includes("token expired") || 
                             errorMessage.includes("CRITICAL: Failed to create file system");
        
        const result: SyncResult = {
          success: false,
          message: isTokenError ? "Google Drive token error - please wait a few minutes and try again" : `Sync failed: ${errorMessage}`,
          timestamp: new Date(),
          error: errorMessage,
          duration,
        };

        console.error(`❌ ${name}: ${result.message}`);
        syncResults.push({ name, result });
      }
    }

    // Convert array to object
    for (const { name, result } of syncResults) {
      results[name as keyof typeof results] = result;
    }

    // Old parallel code removed for sequential execution

    const overallDuration = Date.now() - overallStart;
    console.log(`✨ Overall sync complete (${(overallDuration / 1000).toFixed(1)}s)`);

    return results;
  } finally {
    // Release mutex lock
    syncInProgress = false;
  }
}
