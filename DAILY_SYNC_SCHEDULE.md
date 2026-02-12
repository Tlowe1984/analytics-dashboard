# Daily Sync Schedule

## Overview
The dashboard should be updated once per day at **6:00 AM PST (14:00 UTC)** to sync all 7 data sources.

## What Gets Synced
The unified sync script `sync_all_dashboard.sh` syncs all seven data sources:

1. **Devices Data** - From "WXX Device & Growth Canonical Program Review.docx"
   - AI Glasses, Wrist, ARG/SSG sections
   - Highlights, Risks/Opens, Upcoming items
   - ~62 items with blue text detection for new information

2. **Software Data** - From "Software (I+E, AI, Hearing) Canonical Program Review.docx"
   - Wins, Exec Summary, Decisions sections
   - ~30 items with [wearables-tag] filtering

3. **Systems Data** - From "Wearable Systems Review.docx"
   - Wins, Exec Summary, Help Needed sections
   - ~30 items with [wearables-tag] filtering

4. **Hearing Data** - From "WXX Health Canonical Program Review.docx"
   - Wins, Exec Summary (stops after Fitness Algos), Decisions sections
   - ~45 items

5. **Decisions Data** - From "Wearable Decisions Canonical.docx"
   - Strategic decisions from current + previous week (W7 + W6)
   - ~17 decisions with Week, DRI, Forum, Status, Decision Outcome
   - MZ decisions stack-ranked to top

6. **Milestones Data** - From "Wearable Program Milestones SOT.xlsx"
   - PDP gates, SW milestones, HW dates, Release milestones, GTM dates
   - ~666 milestones across all programs

7. **Upcoming Reviews Data** - From review sign-up sheets
   - 2026 Wearables Reviews Sign-Up Sheet
   - 2026 Product Reviews Sign-Up Sheet
   - Systems Reviews Sign-Up Sheet
   - Upcoming decisions and review dates

## Manual Sync Command
To manually sync all data:
```bash
cd /home/ubuntu/analytics-dashboard
./sync_all_dashboard.sh
```

## Production Setup (Cron Job)
For production deployment with automatic daily sync at 6 AM PST, add this cron job:

```bash
# Daily sync at 6 AM PST (14:00 UTC)
0 14 * * * cd /home/ubuntu/analytics-dashboard && ./sync_all_dashboard.sh >> /home/ubuntu/analytics-dashboard/sync.log 2>&1
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
1. Downloads latest documents from Google Drive (with cache clearing)
2. Parses content using Python scripts
3. Clears old data from database
4. Inserts fresh data
5. Logs completion with timestamp

## Admin Refresh Button
The "Admin Refresh" button in the dashboard UI triggers the same comprehensive sync via the backend `syncAllBash()` function, which runs all 7 sync scripts in parallel for faster updates.

## Notes
- The sandbox environment doesn't support cron, so manual sync is required
- In production, the cron job will run automatically
- Sync logs are appended to `sync.log` for troubleshooting
- Each sync takes approximately 60-90 seconds to complete (all 7 sources)
- Admin Refresh runs syncs in parallel for speed (~30-40 seconds)
