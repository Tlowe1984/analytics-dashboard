import { syncAll } from './server/googleDriveSync.ts';

console.log("Starting sync test...");
const result = await syncAll();
console.log("Sync complete!");
console.log(JSON.stringify(result, null, 2));
