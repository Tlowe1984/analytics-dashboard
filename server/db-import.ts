/**
 * Database Import Module
 * 
 * Downloads the latest database dump from S3 and imports it into production.
 * This keeps production synchronized with sandbox without complex API logic.
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import fetch from 'node-fetch';

const S3_DUMP_URL = 'https://storage.manus.im/database-dumps/latest.sql';

export async function importDatabase(): Promise<{ success: boolean; message: string; itemsImported?: number }> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  // Parse DATABASE_URL
  const dbUrlMatch = DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!dbUrlMatch) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const [, user, password, host, port, database] = dbUrlMatch;
  const dumpFile = `/tmp/db-import-${Date.now()}.sql`;

  try {
    console.log('[DB-IMPORT] Downloading latest dump from S3...');
    
    // Download dump from S3
    const response = await fetch(S3_DUMP_URL);
    if (!response.ok) {
      throw new Error(`Failed to download dump: ${response.statusText}`);
    }
    
    const dumpContent = await response.text();
    const dumpSizeMB = (dumpContent.length / 1024 / 1024).toFixed(2);
    console.log(`[DB-IMPORT] ✅ Downloaded: ${dumpSizeMB} MB`);
    
    // Write to temp file
    writeFileSync(dumpFile, dumpContent);
    
    // Import using mysql client
    console.log('[DB-IMPORT] Importing into database...');
    const importCommand = `mysql \\
      --host=${host} \\
      --port=${port} \\
      --user=${user} \\
      --password='${password}' \\
      --ssl-mode=REQUIRED \\
      ${database} < ${dumpFile}`;
    
    execSync(importCommand, { stdio: 'inherit' });
    
    console.log('[DB-IMPORT] ✅ Import complete');
    
    // Clean up
    unlinkSync(dumpFile);
    
    return {
      success: true,
      message: `Imported ${dumpSizeMB} MB from sandbox database`,
      itemsImported: parseInt(dumpSizeMB) * 1000 // Rough estimate
    };
    
  } catch (error) {
    console.error('[DB-IMPORT] ❌ Import failed:', error);
    
    // Clean up on error
    try {
      unlinkSync(dumpFile);
    } catch {}
    
    throw error;
  }
}
