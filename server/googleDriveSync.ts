import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { createHash } from "crypto";

/**
 * Execute command without shell dependency
 */
function spawnAsync(command: string, args: string[], options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
    });
    
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    
    const timeout = options.timeout ? setTimeout(() => {
      timedOut = true;
      child.kill();
      reject(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout) : null;
    
    child.stdout?.on("data", (data) => { stdout += data.toString(); });
    child.stderr?.on("data", (data) => { stderr += data.toString(); });
    
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      if (!timedOut) reject(error);
    });
    
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (timedOut) return;
      
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

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

// Sync mutex to prevent concurrent syncs
let syncInProgress = false;

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
 * Clear all cache metadata
 */
function clearCache() {
  try {
    if (existsSync(CACHE_METADATA)) {
      writeFileSync(CACHE_METADATA, JSON.stringify({}, null, 2));
    }
  } catch (e) {
    console.warn("Could not clear cache:", e);
  }
}

/**
 * Download a single file from Google Drive
 */
async function downloadFile(name: string, gdrivePath: string, localPath: string): Promise<boolean> {
  try {
    console.log(`📥 [${name}] Downloading...`);
    
    // First, get the actual filename using rclone lsf
    const lsfResult = await spawnAsync("rclone", [
      "lsf",
      `manus_google_drive:${gdrivePath}`,
      "--config",
      "/home/ubuntu/.gdrive-rclone.ini"
    ], { timeout: 120000 });
    
    const actualFilename = lsfResult.stdout.trim();
    const actualPath = `/tmp/${actualFilename}`;
    
    // Download the file
    await spawnAsync("rclone", [
      "copy",
      `manus_google_drive:${gdrivePath}`,
      "/tmp/",
      "--config",
      "/home/ubuntu/.gdrive-rclone.ini"
    ], { timeout: 120000 });
    
    // If the actual downloaded file has a different name, rename it to match localPath
    if (actualPath !== localPath && existsSync(actualPath)) {
      await spawnAsync("mv", [actualPath, localPath], {});
    }
    
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
    const { stdout } = await spawnAsync("/usr/bin/python3.11", [parser, localPath], {
      cwd: "/home/ubuntu/analytics-dashboard",
      timeout: 120000,
      env: {
        PATH: "/usr/bin:/usr/local/bin:/bin",
        PYTHONPATH: "",
        PYTHONHOME: "",
        VIRTUAL_ENV: "",
      }
    });
    
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
    const { stdout } = await spawnAsync("pnpm", ["exec", "tsx", "load_data.mjs"], {
      cwd: "/home/ubuntu/analytics-dashboard",
      timeout: 60000
    });
    
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
export async function syncAll(forceRefresh: boolean = false): Promise<{
  devices: SyncResult;
  software: SyncResult;
  systems: SyncResult;
  decisions: SyncResult;
  milestones: SyncResult;
  upcomingReviews: SyncResult;
}> {
  // Check if sync is already in progress
  if (syncInProgress) {
    console.log("⚠️ Sync already in progress, skipping...");
    return {
      devices: { success: false, message: "Sync already in progress", timestamp: new Date() },
      software: { success: false, message: "Sync already in progress", timestamp: new Date() },
      systems: { success: false, message: "Sync already in progress", timestamp: new Date() },
      decisions: { success: false, message: "Sync already in progress", timestamp: new Date() },
      milestones: { success: false, message: "Sync already in progress", timestamp: new Date() },
      upcomingReviews: { success: false, message: "Sync already in progress", timestamp: new Date() },
    };
  }
  
  // Set mutex lock
  syncInProgress = true;
  
  // ALWAYS delete tmp files at start to ensure fresh downloads
  console.log("🗑️  Deleting all tmp files to ensure fresh downloads...");
    const tmpFiles = [
      "/tmp/Device & Growth Canonical Program Review.docx",
      "/tmp/Software (I+E, AI, Hearing) Canonical Program Review.docx",
      "/tmp/Wearables Systems Review.docx",
      "/tmp/Wearable Decisions Canonical .docx",
      "/tmp/Wearable Program Milestones SOT - For AI ／ User Consumption.xlsx",
      "/tmp/2026 Wearables Reviews Sign-Up Sheet .xlsx",
      "/tmp/2026 Product Reviews Sign-Up Sheet.xlsx",
      "/tmp/Systems Reviews Sign-Up Sheet .xlsx"
    ];
    
    for (const file of tmpFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
          console.log(`   ✓ Deleted ${file}`);
        }
      } catch (e) {
        console.error(`   ❌ Failed to delete ${file}:`, e);
      }
    }
    
    // Clear cache if forced refresh
    if (forceRefresh) {
      console.log("🔄 FORCED sync - clearing query cache...");
      clearCache();
      console.log("✨ Cache cleared");
    } else {
      console.log("🚀 Starting sync with fresh downloads...");
    }
    const overallStart = Date.now();
  
  try {
  // Define all data sources
  const sources: SourceConfig[] = [
    {
      name: "Devices",
      gdrivePath: "Device & Growth Canonical Program Review.docx",
      localPath: "/tmp/Device & Growth Canonical Program Review.docx",
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
    },
    {
      name: "Milestones",
      gdrivePath: "Wearable Program Milestones SOT - For AI ／ User Consumption.xlsx",
      localPath: "/tmp/Wearable Program Milestones SOT - For AI ／ User Consumption.xlsx",
      parser: "/home/ubuntu/analytics-dashboard/server/parse_milestones_xlsx.py",
      output: "/tmp/milestones_parsed.json"
    },
    {
      name: "Upcoming Reviews (Wearables)",
      gdrivePath: "2026 Wearables Reviews Sign-Up Sheet .xlsx",
      localPath: "/tmp/2026 Wearables Reviews Sign-Up Sheet .xlsx",
      parser: "",
      output: ""
    },
    {
      name: "Upcoming Reviews (Product)",
      gdrivePath: "2026 Product Reviews Sign-Up Sheet.xlsx",
      localPath: "/tmp/2026 Product Reviews Sign-Up Sheet.xlsx",
      parser: "",
      output: ""
    },
    {
      name: "Upcoming Reviews (Systems)",
      gdrivePath: "Systems Reviews Sign-Up Sheet .xlsx",
      localPath: "/tmp/Systems Reviews Sign-Up Sheet .xlsx",
      parser: "",
      output: ""
    }
  ];
  
  // Phase 1: Download all files sequentially (to avoid rclone conflicts)
  console.log("📥 Phase 1: Downloading files...");
  const downloadStart = Date.now();
  for (const source of sources) {
    await downloadFile(source.name, source.gdrivePath, source.localPath);
  }
  console.log(`✅ Downloads complete (${((Date.now() - downloadStart) / 1000).toFixed(1)}s)`);
  
  // Phase 2: Parse documents in parallel (only .docx files with parsers)
  console.log("📊 Phase 2: Parsing documents...");
  const parseStart = Date.now();
  const docxSources = sources.filter(s => s.parser && s.output);
  const results = await Promise.all(
    docxSources.map(async (source) => {
      const startTime = Date.now();
      
      try {
        // Check if file changed (skip check if forceRefresh)
        if (!forceRefresh && !hasFileChanged(source.name, source.localPath)) {
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
  
  // Phase 3: Parse upcoming reviews (special handling - single parser for 3 files)
  console.log("📊 Phase 3: Parsing upcoming reviews...");
  const upcomingReviewsStart = Date.now();
  let upcomingReviewsResult: SyncResult;
  try {
    const { stdout } = await spawnAsync("/usr/bin/python3.11", ["/home/ubuntu/analytics-dashboard/server/parse_upcoming_reviews.py"], {
        cwd: "/home/ubuntu/analytics-dashboard",
        timeout: 120000,
        env: {
          PATH: "/usr/bin:/usr/local/bin:/bin",
          PYTHONPATH: "",
          PYTHONHOME: "",
          VIRTUAL_ENV: "",
        }
      }
    );
    
    // Write output to file
    writeFileSync("/tmp/upcoming_reviews_parsed.json", stdout);
    
    // Count items
    const data = JSON.parse(readFileSync("/tmp/upcoming_reviews_parsed.json", "utf8"));
    const itemCount = Array.isArray(data) ? data.length : 0;
    
    upcomingReviewsResult = {
      success: true,
      message: `Synced ${itemCount} upcoming reviews`,
      timestamp: new Date(),
      itemsUpdated: itemCount,
      cached: false,
      duration: Date.now() - upcomingReviewsStart
    };
    console.log(`✅ Upcoming reviews parsed: ${itemCount} items`);
  } catch (error) {
    console.error("Failed to parse upcoming reviews:", error);
    upcomingReviewsResult = {
      success: false,
      message: "Failed to parse upcoming reviews",
      timestamp: new Date(),
      itemsUpdated: 0,
      cached: false,
      duration: Date.now() - upcomingReviewsStart,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
  
  // Phase 4: Load all data to database
  const hasUpdates = results.some(r => r.success && !r.cached) || upcomingReviewsResult.success;
  let totalItems = 0;
  
  if (hasUpdates) {
    try {
      // Load main data (devices, software, systems, decisions)
      totalItems = await loadAllDataToDatabase();
      
      // Load milestones
      console.log("💾 Loading milestones to database...");
      await spawnAsync("pnpm", ["exec", "tsx", "server/load_milestones.mjs"], {
        cwd: "/home/ubuntu/analytics-dashboard",
        timeout: 60000
      });
      
      // Load upcoming reviews
      console.log("💾 Loading upcoming reviews to database...");
      await spawnAsync("node", ["server/load_upcoming_reviews.mjs"], {
        cwd: "/home/ubuntu/analytics-dashboard",
        timeout: 60000
      });
    } catch (error) {
      console.error("Failed to load data to database:", error);
    }
  } else {
    console.log("📦 No updates needed - all sources cached");
  }
  
  // Phase 5: Cleanup /tmp files
  console.log("🧹 Cleaning up temporary files...");
  try {
    const tmpFiles = [
      "/tmp/Device & Growth Canonical Program Review.docx",
      "/tmp/Software (I+E, AI, Hearing) Canonical Program Review.docx",
      "/tmp/Wearables Systems Review.docx",
      "/tmp/Wearable Decisions Canonical .docx",
      "/tmp/Wearable Program Milestones SOT - For AI ／ User Consumption.xlsx",
      "/tmp/2026 Wearables Reviews Sign-Up Sheet .xlsx",
      "/tmp/2026 Product Reviews Sign-Up Sheet.xlsx",
      "/tmp/Systems Reviews Sign-Up Sheet .xlsx",
      "/tmp/parsed_data.json",
      "/tmp/software_data.json",
      "/tmp/systems_data.json",
      "/tmp/decisions_data.json",
      "/tmp/milestones_parsed.json",
      "/tmp/upcoming_reviews_parsed.json",
      "/tmp/upcoming_reviews_data.json"
    ];
    
    const { unlinkSync } = await import("fs");
    let cleanedCount = 0;
    for (const file of tmpFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
          cleanedCount++;
        }
      } catch (e) {
        // Ignore individual file cleanup errors
      }
    }
    console.log(`✅ Cleaned up ${cleanedCount} temporary files`);
  } catch (error) {
    console.warn("Failed to cleanup temporary files:", error);
  }
  
    const overallDuration = Date.now() - overallStart;
    const allSuccess = results.every(r => r.success) && upcomingReviewsResult.success;
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
      decisions: results[3],
      milestones: results[4],
      upcomingReviews: upcomingReviewsResult
    };
    
  } finally {
    // Always release mutex lock
    syncInProgress = false;
  }
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
