# Daily Sync Schedule

## Overview
The Exec Summary section should be updated once per day at **6:00 AM PST (14:00 UTC)**.

## What Gets Synced
The unified sync script `sync_all_exec_summary.sh` syncs all three data sources:

1. **Devices Data** - From "W5 2026 Device & Growth Canonical Program Review.docx"
   - AI Glasses, Wrist, ARG/SSG sections
   - Highlights, Risks/Opens, Upcoming items
   - ~40 items with blue text detection for new information

2. **Software Data** - From "Software (I+E, AI, Hearing) Canonical Program Review.docx"
   - Wins, Exec Summary, Decisions sections
   - ~29 items

3. **Decisions Data** - From "Wearable Decisions Canonical .docx"
   - Strategic decisions from the last month (W5-W3 2026)
   - ~5 decisions with Week, DRI, Forum, Status, Decision Outcome

## Manual Sync Command
To manually sync all data:
```bash
cd /home/ubuntu/analytics-dashboard
./sync_all_exec_summary.sh
```

## Production Setup (Cron Job)
For production deployment with automatic daily sync at 6 AM PST, add this cron job:

```bash
# Daily sync at 6 AM PST (14:00 UTC)
0 14 * * * cd /home/ubuntu/analytics-dashboard && ./sync_all_exec_summary.sh >> /home/ubuntu/analytics-dashboard/sync.log 2>&1
```

### Installing the Cron Job
```bash
crontab -e
# Add the line above, save and exit
```

### Viewing Sync Logs
```bash
tail -f /home/ubuntu/analytics-dashboard/sync.log
```

## Sync Process
Each sync:
1. Downloads latest documents from Google Drive
2. Parses content using Python scripts
3. Clears old data from database
4. Inserts fresh data
5. Logs completion with timestamp

## Notes
- The sandbox environment doesn't support cron, so manual sync is required
- In production, the cron job will run automatically
- Sync logs are appended to `sync.log` for troubleshooting
- Each sync takes approximately 30-60 seconds to complete
