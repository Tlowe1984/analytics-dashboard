import { generateChangeSummaries } from './generate-change-summary';
import { notifyOwner } from './_core/notification';

interface SyncResult {
  success: boolean;
  message: string;
  timestamp: Date;
  itemsUpdated?: number;
  error?: string;
  duration?: number;
}

interface SyncResults {
  devices: SyncResult;
  software: SyncResult;
  systems: SyncResult;
  hearing: SyncResult;
  ai: SyncResult;
  decisions: SyncResult;
  milestones: SyncResult;
  upcomingReviews: SyncResult;
}

/**
 * Send daily sync report to project owner via Manus notification system
 */
export async function sendSyncReport(results: SyncResults): Promise<void> {
  try {
    // Generate AI summaries of changes
    console.log('🤖 Generating AI summaries of changes...');
    const changeSummaries = await generateChangeSummaries();
    console.log(`✅ Generated ${changeSummaries.length} AI summaries`);
    
    // Calculate totals
    const totalItems = Object.values(results).reduce((sum, r) => sum + (r.itemsUpdated || 0), 0);
    const successCount = Object.values(results).filter(r => r.success).length;
    const failureCount = 8 - successCount;
    
    // Get current week number
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    const weekStr = `W${week}`;
    
    // Build notification title
    const title = failureCount > 0 
      ? `⚠️ Dashboard Sync Report - ${failureCount} Errors (${weekStr})`
      : `✅ Dashboard Sync Report - All Sources Updated (${weekStr})`;
    
    // Build notification content (text format, max 20,000 chars)
    const content = formatTextReport(results, changeSummaries, weekStr, totalItems, successCount, failureCount);
    
    // Send via Manus notification system
    console.log('📧 Sending sync report via Manus notifications...');
    const sent = await notifyOwner({
      title,
      content
    });
    
    if (sent) {
      console.log('✅ Sync report sent successfully via Manus notifications');
      console.log('   You will receive this in your Manus notifications and email (if enabled)');
    } else {
      console.warn('⚠️  Manus notification service unavailable');
    }
    
    // Also log to console for debugging
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 SYNC REPORT GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Title: ${title}

${content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  } catch (error) {
    console.error(`❌ Failed to generate sync report:`, error);
    throw error;
  }
}

function formatTextReport(
  results: SyncResults,
  changeSummaries: any[],
  weekStr: string,
  totalItems: number,
  successCount: number,
  failureCount: number
): string {
  const report = `
Wearables Program Status & Decisions Dashboard
Daily Sync Report - ${weekStr}
${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'full', timeStyle: 'short' })} PST

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 SYNC SUMMARY

Total Items Synced: ${totalItems}
Successful Sources: ${successCount}/8
Failed Sources: ${failureCount}/8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 WHAT CHANGED - AI SUMMARY

${changeSummaries.map(change => `
${change.source} (${change.itemsChanged} items)
File: ${change.fileName}
Last Modified: ${new Date(change.lastModified).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}

Summary: ${change.summary}
${change.sourceUrl ? `\nSource: ${change.sourceUrl}` : ''}
`).join('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 SYNC STATUS DETAILS

${formatSourceText('Devices', results.devices)}
${formatSourceText('Software (I+E, AI, Hearing)', results.software)}
${formatSourceText('Systems', results.systems)}
${formatSourceText('Hearing', results.hearing)}
${formatSourceText('AI', results.ai)}
${formatSourceText('Decisions', results.decisions)}
${formatSourceText('Milestones', results.milestones)}
${formatSourceText('Upcoming Reviews', results.upcomingReviews)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 View Dashboard: https://3000-igce7qiubzimnqap2s96q-4a48a2c0.us2.manus.computer

${failureCount > 0 ? `
⚠️  ACTION REQUIRED: ${failureCount} data source(s) failed to sync.
Please check the dashboard logs or contact support if the issue persists.
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated report sent daily after the scheduled sync at 8:45 AM PST.
`.trim();

  // Ensure we're under 20,000 character limit
  if (report.length > 19500) {
    console.warn(`Report is ${report.length} chars, truncating to fit 20,000 limit`);
    return report.substring(0, 19500) + '\n\n[Report truncated - view full details in dashboard]';
  }
  
  return report;
}

function formatSourceText(name: string, result: SyncResult): string {
  const icon = result.success ? '✅' : '❌';
  const status = result.success ? 'SUCCESS' : 'FAILED';
  const items = result.itemsUpdated !== undefined ? `${result.itemsUpdated} items` : 'N/A';
  const duration = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : 'N/A';
  
  let line = `${icon} ${name.padEnd(30)} ${status.padEnd(10)} ${items.padEnd(15)} ${duration}`;
  
  if (!result.success && result.error) {
    line += `\n   Error: ${result.error.substring(0, 100)}${result.error.length > 100 ? '...' : ''}`;
  }
  
  return line;
}
