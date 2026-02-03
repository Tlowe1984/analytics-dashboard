import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface SyncResult {
  success: boolean;
  message: string;
  timestamp: Date;
  itemsUpdated?: number;
  error?: string;
}

/**
 * Sync all dashboard data from Google Drive using existing shell scripts
 */
export async function syncAll(): Promise<{
  devices: SyncResult;
  software: SyncResult;
  systems: SyncResult;
  decisions: SyncResult;
}> {
  console.log("🔄 Starting full dashboard sync...");
  
  const results = {
    devices: await syncDevices(),
    software: await syncSoftware(),
    systems: await syncSystems(),
    decisions: await syncDecisions()
  };
  
  const allSuccess = results.devices.success && results.software.success && results.systems.success && results.decisions.success;
  const totalItems = (results.devices.itemsUpdated || 0) + (results.software.itemsUpdated || 0) + (results.systems.itemsUpdated || 0) + (results.decisions.itemsUpdated || 0);
  
  console.log(allSuccess 
    ? `✅ Full sync complete! ${totalItems} items updated.`
    : `⚠️ Sync completed with errors. Check individual results.`
  );
  
  return results;
}

/**
 * Sync Devices (Executive Summary) data
 */
async function syncDevices(): Promise<SyncResult> {
  try {
    console.log("📥 Syncing Devices data...");
    const { stdout } = await execAsync(`cd /home/ubuntu/analytics-dashboard && bash sync_all_exec_summary.sh 2>&1`);
    
    // Extract item count from output
    const match = stdout.match(/Devices: (\d+) items/);
    const itemsUpdated = match ? parseInt(match[1]) : 0;
    
    return {
      success: true,
      message: `Synced ${itemsUpdated} devices items`,
      timestamp: new Date(),
      itemsUpdated
    };
  } catch (error) {
    console.error("Error syncing devices:", error);
    return {
      success: false,
      message: "Failed to sync devices",
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Sync Software data
 */
async function syncSoftware(): Promise<SyncResult> {
  try {
    console.log("📥 Syncing Software data...");
    const { stdout } = await execAsync(`cd /home/ubuntu/analytics-dashboard && bash sync_software.sh 2>&1`);
    
    // Extract item count from output
    const match = stdout.match(/Loading (\d+) software items/);
    const itemsUpdated = match ? parseInt(match[1]) : 0;
    
    return {
      success: true,
      message: `Synced ${itemsUpdated} software items`,
      timestamp: new Date(),
      itemsUpdated
    };
  } catch (error) {
    console.error("Error syncing software:", error);
    return {
      success: false,
      message: "Failed to sync software",
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Sync Systems data
 */
async function syncSystems(): Promise<SyncResult> {
  try {
    console.log("📥 Syncing Systems data...");
    const { stdout } = await execAsync(`cd /home/ubuntu/analytics-dashboard && bash sync_systems.sh 2>&1`);
    
    // Extract item count from output
    const match = stdout.match(/Loaded (\d+) Systems items/);
    const itemsUpdated = match ? parseInt(match[1]) : 0;
    
    return {
      success: true,
      message: `Synced ${itemsUpdated} systems items`,
      timestamp: new Date(),
      itemsUpdated
    };
  } catch (error) {
    console.error("Error syncing systems:", error);
    return {
      success: false,
      message: "Failed to sync systems",
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Sync Decisions data
 */
async function syncDecisions(): Promise<SyncResult> {
  try {
    console.log("📥 Syncing Decisions data...");
    const { stdout } = await execAsync(`cd /home/ubuntu/analytics-dashboard && bash sync_decisions.sh 2>&1`);
    
    // Extract item count from output
    const match = stdout.match(/Loading (\d+) decisions/);
    const itemsUpdated = match ? parseInt(match[1]) : 0;
    
    return {
      success: true,
      message: `Synced ${itemsUpdated} decisions`,
      timestamp: new Date(),
      itemsUpdated
    };
  } catch (error) {
    console.error("Error syncing decisions:", error);
    return {
      success: false,
      message: "Failed to sync decisions",
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Legacy exports for backward compatibility
export async function syncExecutiveSummary() {
  return syncDevices();
}

export async function syncMilestones(): Promise<SyncResult> {
  // Milestones sync is not implemented - return success to avoid errors
  return {
    success: true,
    message: "Milestones sync not implemented (static data)",
    timestamp: new Date(),
    itemsUpdated: 0
  };
}
