import { syncAll } from './server/googleDriveSync.ts';
import { readFileSync, existsSync } from 'fs';

console.log("[DAILY-SYNC] Starting automatic sync with force refresh...");
const startTime = Date.now();

try {
  // Step 1: Run sync to download and parse data
  const result = await syncAll(true); // forceRefresh = true
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[DAILY-SYNC] ✅ Sync complete in ${duration}s`);
  console.log(JSON.stringify(result, null, 2));

  // Step 2: Read parsed data from temp files
  const parsedData = {};
  
  if (existsSync('/tmp/parsed_data.json')) {
    parsedData.devices = JSON.parse(readFileSync('/tmp/parsed_data.json', 'utf-8'));
    console.log(`[DAILY-SYNC] Read ${parsedData.devices.length} devices`);
  }
  
  if (existsSync('/tmp/software_data.json')) {
    parsedData.software = JSON.parse(readFileSync('/tmp/software_data.json', 'utf-8'));
    console.log(`[DAILY-SYNC] Read ${parsedData.software.length} software items`);
  }
  
  if (existsSync('/tmp/systems_data.json')) {
    parsedData.systems = JSON.parse(readFileSync('/tmp/systems_data.json', 'utf-8'));
    console.log(`[DAILY-SYNC] Read ${parsedData.systems.length} systems items`);
  }
  
  if (existsSync('/tmp/decisions_data.json')) {
    parsedData.decisions = JSON.parse(readFileSync('/tmp/decisions_data.json', 'utf-8'));
    console.log(`[DAILY-SYNC] Read ${parsedData.decisions.length} decisions`);
  }

  // Step 3: POST data to production API
  const productionUrl = process.env.PRODUCTION_URL || 'https://execdash-qbejqjr6.manus.space';
  const syncSecret = process.env.SYNC_SECRET || 'manus-sync-secret-2026';
  
  console.log(`[DAILY-SYNC] Pushing data to production: ${productionUrl}`);
  
  const response = await fetch(`${productionUrl}/api/trpc/sync.pushData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      secret: syncSecret,
      ...parsedData
    })
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
