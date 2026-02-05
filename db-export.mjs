#!/usr/bin/env node
/**
 * Database Export Script
 * 
 * Exports the sandbox database to a SQL dump file and uploads to S3.
 * Production will download and import this dump to stay synchronized.
 */

import { execSync } from 'child_process';
import { unlinkSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[DB-EXPORT] ❌ DATABASE_URL not configured');
  process.exit(1);
}

// Parse DATABASE_URL: mysql://user:pass@host:port/database?ssl=...
const dbUrlMatch = DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!dbUrlMatch) {
  console.error('[DB-EXPORT] ❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, host, port, database] = dbUrlMatch;

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dumpFile = `/tmp/db-dump-${timestamp}.sql`;

console.log('[DB-EXPORT] Starting database export...');
console.log(`[DB-EXPORT] Database: ${database}`);
console.log(`[DB-EXPORT] Host: ${host}:${port}`);

try {
  // Export database using mysqldump
  // --no-tablespaces: avoid permission issues
  // --single-transaction: consistent snapshot without locking
  // --skip-lock-tables: avoid lock issues
  const dumpCommand = `mysqldump \\
    --host=${host} \\
    --port=${port} \\
    --user=${user} \\
    --password='${password}' \\
    --no-tablespaces \\
    --single-transaction \\
    --skip-lock-tables \\
    --ssl-mode=REQUIRED \\
    ${database} > ${dumpFile}`;
  
  console.log('[DB-EXPORT] Running mysqldump...');
  execSync(dumpCommand, { stdio: 'pipe' });
  
  // Check file size
  const sizeOutput = execSync(`du -h ${dumpFile}`, { encoding: 'utf-8' });
  const dumpSize = sizeOutput.split('\t')[0];
  console.log(`[DB-EXPORT] ✅ Dump created: ${dumpSize}`);
  
  // Upload to S3 using manus-upload-file utility
  console.log('[DB-EXPORT] Uploading to S3...');
  const uploadOutput = execSync(`manus-upload-file ${dumpFile}`, { encoding: 'utf-8' });
  const urlMatch = uploadOutput.match(/https:\/\/[^\s]+/);
  
  if (!urlMatch) {
    throw new Error('Failed to extract S3 URL from upload output');
  }
  
  const url = urlMatch[0];
  console.log(`[DB-EXPORT] ✅ Uploaded to S3: ${url}`);
  
  // Save URL to a known location for production to fetch
  execSync(`echo "${url}" > /tmp/latest-db-dump-url.txt`);
  
  // Clean up temp file
  unlinkSync(dumpFile);
  console.log('[DB-EXPORT] ✅ Export complete');
  
  // Return metadata for caller
  console.log(JSON.stringify({
    success: true,
    url,
    timestamp: new Date().toISOString()
  }));
  
} catch (error) {
  console.error('[DB-EXPORT] ❌ Export failed:', error.message);
  process.exit(1);
}
