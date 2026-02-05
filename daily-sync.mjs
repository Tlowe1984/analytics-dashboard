import { syncAll } from "./server/googleDriveSync.ts";

console.log("[DAILY-SYNC] Starting automatic sync with force refresh...");
const startTime = Date.now();

try {
  // Step 1: Sync data from Google Drive
  const result = await syncAll(true); // forceRefresh = true
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[DAILY-SYNC] ✅ Sync complete in ${duration}s`);
  console.log(JSON.stringify(result, null, 2));
  console.log('[DAILY-SYNC] Data synced to shared database - production will see updates immediately');
  
} catch (error) {
  console.error("[DAILY-SYNC] ❌ Sync failed:", error);
  process.exit(1);
}
