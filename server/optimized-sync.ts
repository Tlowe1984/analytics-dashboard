import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, statSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const execAsync = promisify(exec);

interface SyncResult {
  source: string;
  success: boolean;
  itemsUpdated: number;
  duration: number;
  cached: boolean;
  error?: string;
}

const CACHE_DIR = "/tmp/dashboard-cache";
const CACHE_METADATA = `${CACHE_DIR}/metadata.json`;

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  execAsync(`mkdir -p ${CACHE_DIR}`);
}

/**
 * Get MD5 hash of a file
 */
function getFileHash(filePath: string): string {
  if (!existsSync(filePath)) return "";
  const content = readFileSync(filePath);
  return createHash("md5").update(content).digest("hex");
}

/**
 * Load cache metadata
 */
function loadCacheMetadata(): Record<string, { hash: string; timestamp: number }> {
  if (!existsSync(CACHE_METADATA)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_METADATA, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Save cache metadata
 */
function saveCacheMetadata(metadata: Record<string, { hash: string; timestamp: number }>) {
  writeFileSync(CACHE_METADATA, JSON.stringify(metadata, null, 2));
}

/**
 * Check if file has changed since last sync
 */
function hasFileChanged(source: string, filePath: string): boolean {
  const metadata = loadCacheMetadata();
  const currentHash = getFileHash(filePath);
  
  if (!metadata[source]) return true;
  return metadata[source].hash !== currentHash;
}

/**
 * Update cache metadata for a source
 */
function updateCacheMetadata(source: string, filePath: string) {
  const metadata = loadCacheMetadata();
  metadata[source] = {
    hash: getFileHash(filePath),
    timestamp: Date.now()
  };
  saveCacheMetadata(metadata);
}

/**
 * Sync a single data source with caching
 */
async function syncSource(
  source: string,
  gdrivePath: string,
  localPath: string,
  parserScript: string,
  outputJson: string
): Promise<SyncResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Download file from Google Drive
    console.log(`📥 [${source}] Downloading...`);
    await execAsync(
      `rclone copy "manus_google_drive:${gdrivePath}" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini`
    );
    
    // Step 2: Check if file has changed
    if (!hasFileChanged(source, localPath)) {
      console.log(`✅ [${source}] No changes detected, using cache`);
      return {
        source,
        success: true,
        itemsUpdated: 0,
        duration: Date.now() - startTime,
        cached: true
      };
    }
    
    // Step 3: Parse document
    console.log(`📊 [${source}] Parsing...`);
    await execAsync(
      `/home/ubuntu/analytics-dashboard/venv/bin/python ${parserScript} "${localPath}" > ${outputJson}`,
      { env: { ...process.env, PYTHONPATH: "", PYTHONHOME: "" } }
    );
    
    // Step 4: Update cache metadata
    updateCacheMetadata(source, localPath);
    
    // Step 5: Count items from JSON
    const data = JSON.parse(readFileSync(outputJson, "utf8"));
    const itemsUpdated = Array.isArray(data) ? data.length : Object.keys(data).length;
    
    console.log(`✅ [${source}] Complete - ${itemsUpdated} items`);
    
    return {
      source,
      success: true,
      itemsUpdated,
      duration: Date.now() - startTime,
      cached: false
    };
  } catch (error) {
    console.error(`❌ [${source}] Error:`, error);
    return {
      source,
      success: false,
      itemsUpdated: 0,
      duration: Date.now() - startTime,
      cached: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Load all parsed data into database in a single transaction
 */
async function loadAllDataToDatabase(): Promise<number> {
  console.log("💾 Loading all data to database...");
  
  const { stdout } = await execAsync(
    "cd /home/ubuntu/analytics-dashboard && pnpm exec tsx load_data.mjs"
  );
  
  // Extract total count from output
  const match = stdout.match(/(\d+)\s+items?/i);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Main optimized sync function - runs all sources in parallel
 */
export async function optimizedSyncAll() {
  console.log("🚀 Starting optimized parallel sync...");
  const overallStart = Date.now();
  
  // Define all data sources
  const sources = [
    {
      name: "Devices",
      gdrivePath: "Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/W5 2026 Device & Growth Canonical Program Review.docx",
      localPath: "/tmp/W5 2026 Device & Growth Canonical Program Review.docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_exec_summary.py",
      output: "/tmp/parsed_data.json"
    },
    {
      name: "Software",
      gdrivePath: "Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Wearable Software Review.docx",
      localPath: "/tmp/Wearable Software Review.docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_software_review.py",
      output: "/tmp/software_data.json"
    },
    {
      name: "Systems",
      gdrivePath: "Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Wearables Systems Review.docx",
      localPath: "/tmp/Wearables Systems Review.docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_systems_review.py",
      output: "/tmp/systems_data.json"
    },
    {
      name: "Decisions",
      gdrivePath: "Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Wearable Decisions Canonical .docx",
      localPath: "/tmp/Wearable Decisions Canonical .docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_decisions.py",
      output: "/tmp/decisions_data.json"
    }
  ];
  
  // Run all syncs in parallel
  const results = await Promise.all(
    sources.map(s => syncSource(s.name, s.gdrivePath, s.localPath, s.parser, s.output))
  );
  
  // Check if any source actually updated
  const hasUpdates = results.some(r => r.success && !r.cached);
  
  let totalItems = 0;
  if (hasUpdates) {
    // Load all data to database in single operation
    totalItems = await loadAllDataToDatabase();
  } else {
    console.log("📦 No updates needed - all sources cached");
    totalItems = results.reduce((sum, r) => sum + r.itemsUpdated, 0);
  }
  
  const overallDuration = Date.now() - overallStart;
  
  console.log(`✅ Optimized sync complete in ${(overallDuration / 1000).toFixed(1)}s`);
  console.log(`   Total items: ${totalItems}`);
  console.log(`   Cached sources: ${results.filter(r => r.cached).length}/${results.length}`);
  
  return {
    success: results.every(r => r.success),
    totalItems,
    duration: overallDuration,
    sources: results,
    cached: results.every(r => r.cached)
  };
}
