import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";

const execAsync = promisify(exec);

interface SyncResult {
  success: boolean;
  message: string;
  timestamp: Date;
  itemsUpdated?: number;
  error?: string;
  cached?: boolean;
  duration?: number;
}

interface SourceConfig {
  name: string;
  gdrivePath: string;
  localPath: string;
  parser: string;
  output: string;
}

const CACHE_DIR = "/tmp/dashboard-cache";
const CACHE_METADATA = `${CACHE_DIR}/metadata.json`;

// Ensure cache directory exists
try {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create cache directory:", e);
}

/**
 * Get MD5 hash of a file
 */
function getFileHash(filePath: string): string {
  if (!existsSync(filePath)) return "";
  try {
    const content = readFileSync(filePath);
    return createHash("md5").update(content).digest("hex");
  } catch {
    return "";
  }
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
  try {
    writeFileSync(CACHE_METADATA, JSON.stringify(metadata, null, 2));
  } catch (e) {
    console.warn("Could not save cache metadata:", e);
  }
}

/**
 * Check if file has changed since last sync
 */
function hasFileChanged(source: string, filePath: string): boolean {
  const metadata = loadCacheMetadata();
  const currentHash = getFileHash(filePath);
  
  if (!metadata[source] || !currentHash) return true;
  return metadata[source].hash !== currentHash;
}

/**
 * Update cache metadata for a source
 */
function updateCacheMetadata(source: string, filePath: string) {
  const metadata = loadCacheMetadata();
  const hash = getFileHash(filePath);
  if (hash) {
    metadata[source] = {
      hash,
      timestamp: Date.now()
    };
    saveCacheMetadata(metadata);
  }
}

/**
 * Download a single file from Google Drive
 */
async function downloadFile(name: string, gdrivePath: string, localPath: string): Promise<boolean> {
  try {
    console.log(`📥 [${name}] Downloading...`);
    await execAsync(
      `rclone copy "manus_google_drive:${gdrivePath}" /tmp/ --config /home/ubuntu/.gdrive-rclone.ini`,
      { timeout: 30000, shell: "/bin/bash" }
    );
    
    if (!existsSync(localPath)) {
      console.error(`❌ [${name}] File not found after download: ${localPath}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ [${name}] Download failed:`, error);
    return false;
  }
}

/**
 * Parse a document file
 */
async function parseDocument(name: string, localPath: string, parser: string, output: string): Promise<number> {
  try {
    console.log(`📊 [${name}] Parsing...`);
    const { stdout } = await execAsync(
      `/home/ubuntu/analytics-dashboard/venv/bin/python ${parser} "${localPath}"`,
      {
        cwd: "/home/ubuntu/analytics-dashboard",
        timeout: 30000,
        shell: "/bin/bash"
      }
    );
    
    // Write output to file
    writeFileSync(output, stdout);
    
    // Count items from JSON
    if (existsSync(output)) {
      try {
        const data = JSON.parse(readFileSync(output, "utf8"));
        return Array.isArray(data) ? data.length : Object.keys(data).length;
      } catch {
        return 0;
      }
    }
    
    return 0;
  } catch (error) {
    console.error(`❌ [${name}] Parsing failed:`, error);
    throw error;
  }
}

/**
 * Sync a single data source with caching
 */
async function syncSource(config: SourceConfig): Promise<SyncResult> {
  const startTime = Date.now();
  
  try {
    // Check if file has changed (if it exists locally)
    if (existsSync(config.localPath) && !hasFileChanged(config.name, config.localPath)) {
      console.log(`✅ [${config.name}] No changes detected (cached)`);
      const duration = Date.now() - startTime;
      return {
        success: true,
        message: `${config.name} unchanged (cached)`,
        timestamp: new Date(),
        itemsUpdated: 0,
        cached: true,
        duration
      };
    }
    
    // Download file
    const downloaded = await downloadFile(config.name, config.gdrivePath, config.localPath);
    if (!downloaded) {
      throw new Error("Download failed");
    }
    
    // Parse document
    const itemsUpdated = await parseDocument(config.name, config.localPath, config.parser, config.output);
    
    // Update cache metadata
    updateCacheMetadata(config.name, config.localPath);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [${config.name}] Complete - ${itemsUpdated} items (${(duration / 1000).toFixed(1)}s)`);
    
    return {
      success: true,
      message: `Synced ${itemsUpdated} ${config.name.toLowerCase()} items`,
      timestamp: new Date(),
      itemsUpdated,
      cached: false,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${config.name}] Error:`, error);
    return {
      success: false,
      message: `Failed to sync ${config.name.toLowerCase()}`,
      timestamp: new Date(),
      itemsUpdated: 0,
      cached: false,
      duration,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Load all parsed data into database
 */
async function loadAllDataToDatabase(): Promise<number> {
  console.log("💾 Loading all data to database...");
  
  try {
    const { stdout } = await execAsync(
      "cd /home/ubuntu/analytics-dashboard && pnpm exec tsx load_data.mjs",
      { timeout: 15000, shell: "/bin/bash" }
    );
    
    // Try to extract total count from output
    const match = stdout.match(/(\d+)\s+total/i);
    return match ? parseInt(match[1]) : 0;
  } catch (error) {
    console.error("Error loading data to database:", error);
    throw error;
  }
}

/**
 * Sync all dashboard data from Google Drive using optimized approach:
 * 1. Download all files sequentially (to avoid rclone conflicts)
 * 2. Parse all documents in parallel (CPU-bound, benefits from parallelism)
 * 3. Load all data to database in single transaction
 */
export async function syncAll(): Promise<{
  devices: SyncResult;
  software: SyncResult;
  systems: SyncResult;
  decisions: SyncResult;
}> {
  console.log("🚀 Starting optimized sync...");
  const overallStart = Date.now();
  
  // Define all data sources
  const sources: SourceConfig[] = [
    {
      name: "Devices",
      gdrivePath: "Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/W5 2026 Device & Growth Canonical Program Review.docx",
      localPath: "/tmp/W5 2026 Device & Growth Canonical Program Review.docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_exec_summary.py",
      output: "/tmp/parsed_data.json"
    },
    {
      name: "Software",
      gdrivePath: "Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/Software (I+E, AI, Hearing) Canonical Program Review.docx",
      localPath: "/tmp/Software (I+E, AI, Hearing) Canonical Program Review.docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_software_review.py",
      output: "/tmp/software_data.json"
    },
    {
      name: "Systems",
      gdrivePath: "Wearables Everything/Reviews (Comment Only)/Systems Software Reviews/Wearables Systems Review.docx",
      localPath: "/tmp/Wearables Systems Review.docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_systems_review.py",
      output: "/tmp/systems_data.json"
    },
    {
      name: "Decisions",
      gdrivePath: "Wearables Everything/Wearable Decisions Canonical .docx",
      localPath: "/tmp/Wearable Decisions Canonical .docx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_decisions.py",
      output: "/tmp/decisions_data.json"
    }
  ];
  
  // Phase 1: Download all files sequentially (to avoid rclone conflicts)
  console.log("📥 Phase 1: Downloading files...");
  const downloadStart = Date.now();
  for (const source of sources) {
    await downloadFile(source.name, source.gdrivePath, source.localPath);
  }
  console.log(`✅ Downloads complete (${((Date.now() - downloadStart) / 1000).toFixed(1)}s)`);
  
  // Phase 2: Parse all documents in parallel
  console.log("📊 Phase 2: Parsing documents...");
  const parseStart = Date.now();
  const results = await Promise.all(
    sources.map(async (source) => {
      const startTime = Date.now();
      
      try {
        // Check if file changed
        if (!hasFileChanged(source.name, source.localPath)) {
          console.log(`✅ [${source.name}] No changes (cached)`);
          return {
            success: true,
            message: `${source.name} unchanged (cached)`,
            timestamp: new Date(),
            itemsUpdated: 0,
            cached: true,
            duration: Date.now() - startTime
          };
        }
        
        // Parse document
        const itemsUpdated = await parseDocument(source.name, source.localPath, source.parser, source.output);
        updateCacheMetadata(source.name, source.localPath);
        
        return {
          success: true,
          message: `Synced ${itemsUpdated} items`,
          timestamp: new Date(),
          itemsUpdated,
          cached: false,
          duration: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to parse ${source.name}`,
          timestamp: new Date(),
          itemsUpdated: 0,
          cached: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    })
  );
  console.log(`✅ Parsing complete (${((Date.now() - parseStart) / 1000).toFixed(1)}s)`);
  
  // Phase 3: Load all data to database
  const hasUpdates = results.some(r => r.success && !r.cached);
  let totalItems = 0;
  
  if (hasUpdates) {
    try {
      totalItems = await loadAllDataToDatabase();
    } catch (error) {
      console.error("Failed to load data to database:", error);
    }
  } else {
    console.log("📦 No updates needed - all sources cached");
  }
  
  const overallDuration = Date.now() - overallStart;
  const allSuccess = results.every(r => r.success);
  const cachedCount = results.filter(r => r.cached).length;
  
  console.log(
    allSuccess
      ? `✅ Full sync complete! ${totalItems} items in ${(overallDuration / 1000).toFixed(1)}s (${cachedCount}/${results.length} cached)`
      : `⚠️ Sync completed with errors. Check individual results.`
  );
  
  return {
    devices: results[0],
    software: results[1],
    systems: results[2],
    decisions: results[3]
  };
}

// Legacy exports for backward compatibility
export async function syncExecutiveSummary() {
  const result = await syncAll();
  return result.devices;
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
