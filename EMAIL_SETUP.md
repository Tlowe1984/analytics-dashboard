# Email Report Setup Guide

The dashboard is configured to send daily sync reports to **tlowe999@meta.com** after each scheduled sync at 8:45 AM PST.

## Current Status

✅ **Email report generation is implemented** - The system generates a comprehensive HTML email report with:
- Sync summary (total items, success/failure counts)
- Detailed status for all 8 data sources
- Item counts and sync duration for each source
- Error messages for failed syncs
- Current week number (W##)
- Link to dashboard

⚠️ **Email delivery requires configuration** - The report is currently logged to console. To enable actual email delivery, you need to integrate an email service provider.

## Email Report Contents

The daily report includes:

### Summary Section
- Total items synced across all sources
- Number of successful sources
- Number of failed sources
- Current week number

### Data Source Status
For each of the 8 data sources:
- ✅/❌ Status indicator
- Item count
- Sync duration
- Error details (if failed)

### Sources Monitored
1. Devices (Device & Growth Canonical Program Review)
2. Software (I+E, AI, Hearing Canonical Program Review)
3. Systems (Systems Canonical Program Review)
4. Hearing (Health Canonical Program Review)
5. AI (AI Hotspots and Product Review)
6. Decisions (Wearable Decisions Canonical)
7. Milestones (Wearable Program Milestones SOT)
8. Upcoming Reviews (Review sign-up sheets)

## Email Service Integration Options

To enable actual email delivery, choose one of these options:

### Option 1: SendGrid (Recommended)

1. Sign up for SendGrid: https://sendgrid.com
2. Create an API key with "Mail Send" permissions
3. Add API key as environment variable:
   ```bash
   # Via Manus UI: Settings > Secrets
   SENDGRID_API_KEY=your_api_key_here
   ```

4. Update `server/send-sync-report.ts` to uncomment the SendGrid integration code (lines 158-171)

### Option 2: AWS SES

1. Set up AWS SES: https://aws.amazon.com/ses/
2. Verify tlowe999@meta.com as a recipient
3. Add AWS credentials as environment variables:
   ```bash
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=us-east-1
   ```

4. Install AWS SDK:
   ```bash
   cd /home/ubuntu/analytics-dashboard
   pnpm add @aws-sdk/client-ses
   ```

5. Update `server/send-sync-report.ts` to use AWS SES client

### Option 3: Resend (Modern Alternative)

1. Sign up for Resend: https://resend.com
2. Create an API key
3. Add API key as environment variable:
   ```bash
   RESEND_API_KEY=your_api_key_here
   ```

4. Install Resend SDK:
   ```bash
   cd /home/ubuntu/analytics-dashboard
   pnpm add resend
   ```

5. Update `server/send-sync-report.ts`:
   ```typescript
   import { Resend } from 'resend';
   const resend = new Resend(process.env.RESEND_API_KEY);
   
   await resend.emails.send({
     from: 'Wearables Dashboard <noreply@manus.space>',
     to: 'tlowe999@meta.com',
     subject,
     html: htmlBody
   });
   ```

## Testing Email Delivery

After configuring an email service:

1. **Test with manual sync:**
   ```bash
   cd /home/ubuntu/analytics-dashboard
   # Trigger admin refresh via UI or API
   ```

2. **Check logs:**
   ```bash
   tail -f /home/ubuntu/analytics-dashboard/.manus-logs/sync-scheduler.log
   ```

3. **Verify email received:**
   - Check tlowe999@meta.com inbox
   - Check spam folder if not in inbox
   - Verify all 8 data sources are listed
   - Confirm item counts are accurate

## Scheduled Delivery

Once email service is configured, reports will be sent automatically:

- **When**: Daily at 8:45 AM PST (after scheduled sync)
- **Trigger**: Automatic via node-cron scheduler
- **Recipient**: tlowe999@meta.com
- **Format**: HTML email with text fallback

## Troubleshooting

### Email not sending

1. Check environment variables are set correctly
2. Verify API key has correct permissions
3. Check logs for error messages:
   ```bash
   grep "email" /home/ubuntu/analytics-dashboard/.manus-logs/sync-scheduler.log
   ```

### Email goes to spam

1. Configure SPF/DKIM records for your domain
2. Use a verified sender domain
3. Avoid spam trigger words in subject line

### Wrong data in report

1. Verify all 8 syncs are completing successfully
2. Check item counts in database:
   ```bash
   cd /home/ubuntu/analytics-dashboard
   node -e "require('./server/db').getDashboardItems().then(r => console.log('Devices:', r.length))"
   ```

## Current Implementation

The email report is generated in `server/send-sync-report.ts` and called from `server/sync-scheduler.ts` after each sync completes. The report is currently logged to console - you just need to add the email service integration code to enable delivery.

**Location of email generation code:**
- `server/send-sync-report.ts` - Report generation logic
- `server/sync-scheduler.ts` - Calls sendSyncReport() after sync

**To enable email delivery:**
1. Choose an email service provider (SendGrid, AWS SES, or Resend)
2. Add API credentials as environment variables
3. Update `server/send-sync-report.ts` with service integration code
4. Test with manual sync
5. Verify scheduled delivery works

## Support

For questions or issues with email setup:
- Check SYNC_VERIFICATION.md for sync troubleshooting
- Review .manus-logs/sync-scheduler.log for error details
- Verify email service provider status/quotas
