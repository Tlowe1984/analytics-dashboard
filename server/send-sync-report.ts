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
 * Send daily sync report email to tlowe999@meta.com
 */
export async function sendSyncReport(results: SyncResults): Promise<void> {
  try {
    // Calculate totals
    const totalItems = Object.values(results).reduce((sum, r) => sum + (r.itemsUpdated || 0), 0);
    const successCount = Object.values(results).filter(r => r.success).length;
    const failureCount = 8 - successCount;
    
    // Get current week number
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    const weekStr = `W${week}`;
    
    // Build email subject
    const subject = failureCount > 0 
      ? `⚠️ Wearables Dashboard Sync Report - ${failureCount} Errors (${weekStr})`
      : `✅ Wearables Dashboard Sync Report - All Sources Updated (${weekStr})`;
    
    // Build email body with HTML formatting
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .summary-label { font-size: 14px; color: #666; margin-top: 5px; }
    .sources { margin-bottom: 30px; }
    .source-item { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    .source-name { font-weight: 600; flex: 1; }
    .source-status { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .status-success { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .source-meta { color: #666; font-size: 14px; }
    .error-msg { color: #721c24; font-size: 13px; margin-top: 8px; padding: 8px; background: #f8d7da; border-radius: 4px; }
    .footer { text-align: center; color: #666; font-size: 14px; padding-top: 30px; border-top: 1px solid #e0e0e0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Wearables Dashboard Sync Report</h1>
    <p>${weekStr} - ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'full', timeStyle: 'short' })} PST</p>
  </div>
  
  <div class="summary">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${totalItems}</div>
        <div class="summary-label">Total Items</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #28a745;">${successCount}</div>
        <div class="summary-label">Successful</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: ${failureCount > 0 ? '#dc3545' : '#28a745'};">${failureCount}</div>
        <div class="summary-label">Failed</div>
      </div>
    </div>
  </div>
  
  ${failureCount > 0 ? `
  <div class="alert">
    <strong>⚠️ Action Required:</strong> ${failureCount} data source(s) failed to sync. Please check the dashboard logs or contact support if the issue persists.
  </div>
  ` : ''}
  
  <div class="sources">
    <h2 style="margin-bottom: 20px;">Data Source Status</h2>
    ${formatSourceHtml('Devices', results.devices)}
    ${formatSourceHtml('Software (I+E, AI, Hearing)', results.software)}
    ${formatSourceHtml('Systems', results.systems)}
    ${formatSourceHtml('Hearing', results.hearing)}
    ${formatSourceHtml('AI', results.ai)}
    ${formatSourceHtml('Decisions', results.decisions)}
    ${formatSourceHtml('Milestones', results.milestones)}
    ${formatSourceHtml('Upcoming Reviews', results.upcomingReviews)}
  </div>
  
  <div style="text-align: center;">
    <a href="https://3000-igce7qiubzimnqap2s96q-4a48a2c0.us2.manus.computer" class="button">View Dashboard →</a>
  </div>
  
  <div class="footer">
    <p>This is an automated report sent daily after the scheduled sync at 8:45 AM PST.</p>
    <p style="margin-top: 10px; font-size: 12px; color: #999;">Wearables Program Status & Decisions Dashboard</p>
  </div>
</body>
</html>
`;

    // Send email using fetch to a simple email API
    // For now, we'll use console.log - in production, integrate with SendGrid, AWS SES, or similar
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 EMAIL REPORT GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To: tlowe999@meta.com
Subject: ${subject}

${formatTextReport(results, weekStr, totalItems, successCount, failureCount)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

    // TODO: Integrate with actual email service
    // Example with SendGrid:
    // await fetch('https://api.sendgrid.com/v3/mail/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     personalizations: [{ to: [{ email: 'tlowe999@meta.com' }] }],
    //     from: { email: 'noreply@manus.space', name: 'Wearables Dashboard' },
    //     subject,
    //     content: [{ type: 'text/html', value: htmlBody }]
    //   })
    // });

  } catch (error) {
    console.error(`❌ Failed to generate sync report:`, error);
    throw error;
  }
}

function formatSourceHtml(name: string, result: SyncResult): string {
  const statusClass = result.success ? 'status-success' : 'status-failed';
  const statusText = result.success ? 'SUCCESS' : 'FAILED';
  const items = result.itemsUpdated !== undefined ? `${result.itemsUpdated} items` : 'N/A';
  const duration = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : 'N/A';
  
  return `
    <div class="source-item">
      <div class="source-name">${result.success ? '✅' : '❌'} ${name}</div>
      <div class="source-meta">${items} • ${duration}</div>
      <div class="source-status ${statusClass}">${statusText}</div>
    </div>
    ${!result.success && result.error ? `<div class="error-msg">Error: ${result.error.substring(0, 150)}${result.error.length > 150 ? '...' : ''}</div>` : ''}
  `;
}

function formatTextReport(results: SyncResults, weekStr: string, totalItems: number, successCount: number, failureCount: number): string {
  return `
Wearables Program Status & Decisions Dashboard
Daily Sync Report - ${weekStr}
${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'full', timeStyle: 'short' })} PST

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 SYNC SUMMARY

Total Items Synced: ${totalItems}
Successful Sources: ${successCount}/8
Failed Sources: ${failureCount}/8

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 DATA SOURCE STATUS

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
