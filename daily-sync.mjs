import { syncAll } from './server/googleDriveSync.ts';
import * as db from './server/db.ts';

console.log("[DAILY-SYNC] Starting automatic sync with force refresh...");
const startTime = Date.now();

try {
  // Step 1: Run sync to download, parse, and load data into sandbox database
  const result = await syncAll(true); // forceRefresh = true
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[DAILY-SYNC] ✅ Sync complete in ${duration}s`);
  console.log(JSON.stringify(result, null, 2));

  // Step 2: Query sandbox database to get all parsed data
  console.log('[DAILY-SYNC] Querying sandbox database...');
  const parsedData = {
    devices: await db.getAllDashboardItems(),
    software: await db.getAllSoftwareItems(),
    systems: await db.getAllSystemsItems(),
    decisions: await db.getAllDecisions(),
    milestones: await db.getAllMilestones(),
    upcomingReviews: await db.getUpcomingReviews()
  };
  
  console.log(`[DAILY-SYNC] Retrieved from sandbox DB:`);
  console.log(`  - ${parsedData.devices.length} devices`);
  console.log(`  - ${parsedData.software.length} software items`);
  console.log(`  - ${parsedData.systems.length} systems items`);
  console.log(`  - ${parsedData.decisions.length} decisions`);
  console.log(`  - ${parsedData.milestones.length} milestones`);
  console.log(`  - ${parsedData.upcomingReviews.length} upcoming reviews`);

  // Step 3: POST data to production API
  const productionUrl = process.env.PRODUCTION_URL || 'https://execdash-qbejqjr6.manus.space';
  const syncSecret = process.env.SYNC_SECRET || 'manus-sync-secret-2026';
  
  console.log(`[DAILY-SYNC] Pushing data to production: ${productionUrl}`);
  
  // tRPC v11 requires input as query parameter with batch=1
  const inputData = {
    secret: syncSecret,
    devices: parsedData.devices,
    software: parsedData.software,
    systems: parsedData.systems,
    decisions: parsedData.decisions,
    milestones: parsedData.milestones,
    upcomingReviews: parsedData.upcomingReviews
  };
  
  const encodedInput = encodeURIComponent(JSON.stringify(inputData));
  const response = await fetch(`${productionUrl}/api/trpc/sync.pushData?batch=1&input=${encodedInput}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Production API returned ${response.status}: ${await response.text()}`);
  }

  const apiResult = await response.json();
  console.log(`[DAILY-SYNC] ✅ Production updated:`, apiResult);
  
} catch (error) {
  console.error("[DAILY-SYNC] ❌ Sync failed:", error);
  process.exit(1);
}
