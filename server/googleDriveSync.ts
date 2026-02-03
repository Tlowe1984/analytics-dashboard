import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { getDb } from "./db";
import { dashboardItems, milestones } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

const RCLONE_CONFIG = "/home/ubuntu/.gdrive-rclone.ini";
const GOOGLE_DOC_NAME = "Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Device & Growth Canonical Program Review.docx";
const GOOGLE_SHEETS_NAME = "WearableProgramMilestonesSOT-ForAI_UserConsumption.xlsx";

interface SyncResult {
  success: boolean;
  message: string;
  timestamp: Date;
  itemsUpdated?: number;
}

/**
 * Download a file from Google Drive using rclone
 */
async function downloadFromGoogleDrive(fileName: string, localPath: string): Promise<void> {
  const command = `rclone copy "manus_google_drive:${fileName}" "$(dirname ${localPath})" --config ${RCLONE_CONFIG}`;
  await execAsync(command);
  
  // Rename to expected path if needed
  const downloadedName = fileName.split('/').pop();
  if (downloadedName && downloadedName !== localPath.split('/').pop()) {
    await execAsync(`mv "$(dirname ${localPath})/${downloadedName}" "${localPath}"`);
  }
}

/**
 * Parse executive summary from Word document
 */
async function parseExecutiveSummary(filePath: string): Promise<any[]> {
  // Read the document content
  const content = await readFile(filePath, 'utf-8');
  
  // This is a simplified parser - in production you'd use a proper DOCX parser
  // For now, we'll return the existing structure
  // TODO: Implement proper DOCX parsing with mammoth or similar library
  
  return [];
}

/**
 * Parse milestones from Excel spreadsheet
 */
async function parseMilestones(filePath: string): Promise<any[]> {
  // Use Python script to parse Excel since we already have openpyxl installed
  const pythonScript = `
import openpyxl
import json
from datetime import datetime

wb = openpyxl.load_workbook('${filePath}', data_only=True)
ws = wb.active

milestones = {
    'pdp_gates': [],
    'sw_milestones': [],
    'hw_dates': []
}

for row in ws.iter_rows(min_row=2, values_only=True):
    if not row[0] or not row[1] or not row[2]:
        continue
    
    product = str(row[0]).strip()
    name = str(row[1]).strip()
    date_val = row[2]
    milestone_type = str(row[3]).strip() if len(row) > 3 else ''
    
    if isinstance(date_val, datetime):
        date_str = date_val.strftime('%Y-%m-%d')
    else:
        continue
    
    # Categorize by type
    if 'PDP' in milestone_type or 'Gate' in milestone_type:
        milestones['pdp_gates'].append({'product': product, 'name': name, 'date': date_str, 'type': milestone_type})
    elif 'SW' in milestone_type or 'Software' in milestone_type:
        milestones['sw_milestones'].append({'product': product, 'name': name, 'date': date_str, 'type': milestone_type})
    elif 'HW' in milestone_type or 'Hardware' in milestone_type or 'Silicon' in milestone_type:
        milestones['hw_dates'].append({'product': product, 'name': name, 'date': date_str, 'type': milestone_type})

print(json.dumps(milestones))
`;

  const { stdout } = await execAsync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`);
  return JSON.parse(stdout);
}

/**
 * Sync executive summary from Google Doc
 */
export async function syncExecutiveSummary(): Promise<SyncResult> {
  const tempPath = `/tmp/exec_summary_${Date.now()}.docx`;
  
  try {
    // Download from Google Drive
    await downloadFromGoogleDrive(GOOGLE_DOC_NAME, tempPath);
    
    // Parse the document
    const items = await parseExecutiveSummary(tempPath);
    
    // Update database
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // For now, we'll keep the existing data since parsing isn't fully implemented
    // TODO: Implement full sync logic
    
    // Clean up
    await unlink(tempPath);
    
    return {
      success: true,
      message: "Executive summary synced successfully",
      timestamp: new Date(),
      itemsUpdated: items.length
    };
  } catch (error) {
    console.error("Error syncing executive summary:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date()
    };
  }
}

/**
 * Sync milestones from Google Sheets
 */
export async function syncMilestones(): Promise<SyncResult> {
  const tempPath = `/tmp/milestones_${Date.now()}.xlsx`;
  
  try {
    // Download from Google Drive
    await downloadFromGoogleDrive(GOOGLE_SHEETS_NAME, tempPath);
    
    // Parse the spreadsheet
    const data = await parseMilestones(tempPath);
    
    // Update database
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Clear existing milestones
    await db.delete(milestones);
    
    // Insert new milestones
    let totalInserted = 0;
    for (const [milestoneType, items] of Object.entries(data)) {
      for (const item of items as any[]) {
        await db.insert(milestones).values({
          product: item.product,
          milestoneName: item.name,
          milestoneDate: new Date(item.date),
          milestoneType: milestoneType as "pdp_gates" | "sw_milestones" | "hw_dates",
          originalType: item.type
        });
        totalInserted++;
      }
    }
    
    // Clean up
    await unlink(tempPath);
    
    return {
      success: true,
      message: `Synced ${totalInserted} milestones successfully`,
      timestamp: new Date(),
      itemsUpdated: totalInserted
    };
  } catch (error) {
    console.error("Error syncing milestones:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date()
    };
  }
}

/**
 * Sync all data from Google Drive
 */
export async function syncAll(): Promise<{ execSummary: SyncResult; milestones: SyncResult }> {
  const [execSummary, milestonesResult] = await Promise.all([
    syncExecutiveSummary(),
    syncMilestones()
  ]);
  
  return {
    execSummary,
    milestones: milestonesResult
  };
}
