import { syncAll } from "./server/googleDriveSync.js";
import { execSync } from 'child_process';

console.log("[DAILY-SYNC] Starting automatic sync with force refresh...");
const startTime = Date.now();

try {
  // Step 1: Sync data from Google Drive
  const result = await syncAll(true); // forceRefresh = true
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[DAILY-SYNC] ✅ Sync complete in ${duration}s`);
  console.log(JSON.stringify(result, null, 2));
  
  // Step 2: Export database to S3 for production
  console.log('[DAILY-SYNC] Exporting database to S3...');
  try {
    const exportResult = execSync('node db-export.mjs', { 
      cwd: '/home/ubuntu/analytics-dashboard',
      encoding: 'utf-8'
    });
    console.log('[DAILY-SYNC] ✅ Database exported successfully');
    console.log(exportResult);
  } catch (exportError) {
    console.error('[DAILY-SYNC] ⚠️  Database export failed:', exportError.message);
    // Don't fail the whole sync if export fails
  }
  
} catch (error) {
  console.error("[DAILY-SYNC] ❌ Sync failed:", error);
  process.exit(1);
}
