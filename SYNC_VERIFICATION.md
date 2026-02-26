# Sync Verification Guide

This document describes how to verify that all data sources are syncing correctly for both Admin Refresh and Daily Auto-Sync.

## 🚨 After Sandbox Reset

If you see sync errors after a sandbox reset or hibernation, run:

```bash
cd /home/ubuntu/analytics-dashboard
bash init_dependencies.sh
```

This will:
- Install python-docx and openpyxl packages
- Verify Google Drive rclone configuration
- Ensure all dependencies are ready

Then test all syncs:
```bash
bash test_sync_robustness.sh
```

## All Data Sources

The dashboard syncs data from 8 sources:

1. **Devices** - Wearable Week highlights, risks, and upcoming items
2. **Software** - Software (I+E, AI, Hearing) executive summary
3. **Systems** - Systems executive summary
4. **Hearing** - Hearing review (Wins, Exec Summary, Decisions)
5. **AI** - AI review (Wins, Exec Summary, Decisions)
6. **Decisions** - MZ decisions from Google Sheets
7. **Milestones** - PDP gates, HW dates, SW milestones from spreadsheet
8. **Upcoming Reviews** - Review sign-up sheets (Wearables, Product, Systems)

## Sync Methods

### 1. Admin Refresh (Manual)
- Triggered by clicking "Admin Refresh" button in the UI
- Runs all 8 syncs in parallel via `server/syncAllBash.ts`
- Takes ~30-60 seconds to complete
- Shows success/failure status for each source

### 2. Daily Auto-Sync (Automated)
- Runs automatically every day at 6 AM PST
- Executes `sync_all_dashboard.sh` script
- Runs all 8 syncs sequentially
- Logs output to system logs

## Testing All Syncs

Run the comprehensive test script to verify all syncs:

```bash
cd /home/ubuntu/analytics-dashboard
bash test_all_syncs.sh
```

This script:
- Tests each of the 8 sync scripts individually
- Verifies data was loaded into the database
- Shows item counts for each source
- Reports success/failure status
- Displays error logs for failed syncs

## Expected Item Counts

After a successful sync, you should see approximately:

- **Devices**: ~70 items (varies by week)
- **Software**: ~50 items (varies by week)
- **Systems**: ~30 items (varies by week)
- **Hearing**: ~40-50 items (Wins + Exec Summary + Decisions)
- **AI**: ~40-50 items (Wins + Exec Summary + Decisions)
- **Decisions**: ~15-20 items (current + previous week)
- **Milestones**: ~1289 items (all products)
- **Upcoming Reviews**: ~10-15 items (next 4-6 weeks)

## Individual Sync Scripts

Each data source has its own sync script:

```bash
# Test individual syncs
bash sync_from_gdrive.sh      # Devices
bash sync_software.sh          # Software
bash sync_systems.sh           # Systems
bash sync_hearing.sh           # Hearing
bash sync_ai.sh                # AI
bash sync_decisions.sh         # Decisions
bash sync_milestones.sh        # Milestones
bash sync_upcoming_reviews.sh  # Upcoming Reviews
```

## Common Issues

### Milestones Sync Hanging
**Symptom**: Milestones sync takes >2 minutes or hangs  
**Cause**: Database insertion was slow (one-by-one)  
**Fix**: Now uses batch insertion (100 items at a time)  
**Expected time**: 3-5 seconds

### Upcoming Reviews "Module Not Found"
**Symptom**: `ModuleNotFoundError: No module named 'openpyxl'`  
**Cause**: Script was using wrong Python environment  
**Fix**: Now explicitly uses `python3.11` which has openpyxl installed  
**Expected time**: 5-10 seconds

### Python "SRE module mismatch" Errors
**Symptom**: Intermittent Python errors during parallel sync  
**Cause**: Multiple Python processes running simultaneously  
**Impact**: Usually harmless, syncs complete successfully  
**Fix**: Errors are logged but don't prevent sync completion

## Verification Checklist

After making changes to the dashboard, verify syncs:

- [ ] Run `bash test_all_syncs.sh` - all 8 syncs should succeed
- [ ] Check item counts match expected ranges
- [ ] Click "Admin Refresh" in UI - should complete without errors
- [ ] Verify data appears in all dashboard sections
- [ ] Check browser console for any errors
- [ ] Verify Wearable Week tile shows current week data
- [ ] Verify Upcoming Dates shows PDP gates
- [ ] Verify Decisions Made shows current + previous week items

## Troubleshooting

If a sync fails:

1. Check the error message in the test output
2. Run the individual sync script to see detailed logs
3. Verify Google Drive files exist and are accessible
4. Check database connection (DATABASE_URL env var)
5. Verify Python dependencies are installed
6. Check file permissions on sync scripts

## Maintenance

When adding new data sources:

1. Create a new sync script (e.g., `sync_new_source.sh`)
2. Add to `server/syncAllBash.ts` scripts array
3. Add to `sync_all_dashboard.sh` script
4. Add to `test_all_syncs.sh` test script
5. Update this documentation with expected item counts
6. Test both Admin Refresh and Daily Auto-Sync

## Time-Based Edge Cases

### Week Number Transitions

**Week 52 → Week 1 (Year Rollover)**
- Sync scripts automatically detect current week number
- Fall back to previous week if current week file doesn't exist
- Example: If today is W1 2027 and W1 file doesn't exist, uses W52 2026

**Missing Weeks**
- Some weeks may be skipped (e.g., no W6 file, only W5 and W7)
- Scripts try current week first, then previous week
- Fail gracefully with clear error message if neither exists

### Month Boundaries

**Filename Pattern Changes**
- AI documents: "AI W7 (2/10/2026)" vs "AI W1 (1/6/2027)"
- Hearing documents: "W7 Health Canonical" vs "W1 Health Canonical"
- Scripts use regex patterns that match both formats
- Year is automatically detected from current date

### Year Rollover (2026 → 2027)

**Automatic Handling**
- All sync scripts use current date to determine year
- Filename patterns accommodate year changes
- No manual updates needed during year transitions
- Database stores timestamps in UTC for consistency

## Dependency Management

### Python Package Issues

**Symptom**: "ModuleNotFoundError: No module named 'docx'" or "openpyxl"  
**Cause**: Sandbox reset or hibernation cleared Python packages  
**Solution**: Run `bash init_dependencies.sh`  
**Prevention**: init_dependencies.sh is called automatically by test_sync_robustness.sh

### Python Environment Stability

**Issue**: Multiple Python versions or environments  
**Solution**: All sync scripts explicitly use `python3.11`  
**Verification**: `which python3.11` should show `/usr/bin/python3.11`

### Google Drive Access

**Issue**: "Config file not found - using defaults"  
**Cause**: rclone configuration missing or corrupted  
**Solution**: Verify `/home/ubuntu/.gdrive-rclone.ini` exists  
**Recovery**: Google Drive integration needs to be re-enabled via Manus UI

**Issue**: "token expired and there's no refresh token"  
**Cause**: Transient token refresh timing issue when multiple syncs run in parallel  
**Solution**: Admin Refresh now includes automatic retry logic with exponential backoff  
**Details**: Syncs will retry up to 3 times (2s, 4s, 8s delays) for token errors  
**Manual Fix**: If error persists, wait 2-3 minutes and try Admin Refresh again

## Robust Error Handling

### Retry Logic

Sync scripts include retry logic for transient failures:
- Network timeouts: Automatic retries with backoff
- File not found: Try previous week automatically
- Database connection: Retry mechanism built-in

### Graceful Degradation

If a sync fails:
- Error is logged with detailed context
- Other syncs continue to run
- Dashboard displays last successful sync data
- Admin Refresh UI shows which sources failed

### Timeout Protection

Long-running syncs have timeouts:
- Milestones: 60 seconds max
- Upcoming Reviews: 60 seconds max
- Other syncs: 30 seconds max
- Prevents indefinite hangs

## Contact

For sync issues or questions, check:
- `todo.md` for known issues
- `.manus-logs/` directory for recent logs
- Database directly using `pnpm exec tsx` scripts
- Run `bash test_sync_robustness.sh` for comprehensive diagnostics

## [wearables-tag] System

The dashboard includes a **Wearable Week** tile that aggregates content from all 5 data sources tagged with `[wearables-tag]`. This allows contributors to mark specific items across different documents that should appear in the consolidated Wearable Week view.

### How It Works

1. **Tagging Content**: Contributors add `[wearables-tag]` anywhere in a bullet point in any of the 5 source documents:
   - Devices (Device & Growth Canonical Program Review)
   - Software (Software I+E, AI, Hearing Canonical Program Review)
   - Systems (WXX Systems Canonical Program Review)
   - Hearing (WXX Health Canonical Program Review)
   - AI (AI WXX Review documents)

2. **Parsing**: Each parser automatically:
   - Detects `[wearables-tag]` markers (case insensitive)
   - Strips the tag from the content before storing
   - Sets `is_wearables_tag = 1` in the database

3. **Database Storage**: All 5 tables have `is_wearables_tag` column:
   - `dashboard_items` (Devices)
   - `software_items` (Software)
   - `systems_items` (Systems)
   - `hearing_items` (Hearing)
   - `ai_items` (AI)

4. **Aggregation**: The `getWearablesTaggedItems()` function:
   - Queries all 5 tables for items where `is_wearables_tag = 1`
   - Normalizes items to common format with source labels
   - Returns combined list for display

5. **Display**: The Wearable Week tile (`SoftwareWearablesSection.tsx`):
   - Shows items grouped by Highlights and Risks/Opens
   - Displays source label for each item (e.g., `[Systems]`, `[Software]`)
   - Updates automatically when new tagged items are synced

### Parsers with [wearables-tag] Detection

All 5 parsers have been updated to detect and handle `[wearables-tag]`:

- ✅ `parse_exec_summary.py` (Devices) - inline detection
- ✅ `parse_ie_review.py` (Software) - inline detection
- ✅ `parse_systems_review.py` (Systems) - inline + separate extraction via `extract_systems_wearables.py`
- ✅ `parse_hearing_review.py` (Hearing) - inline detection
- ✅ `parse_ai_review.py` (AI) - inline detection

### Verifying [wearables-tag] Items

After running a sync, check how many wearables-tagged items were found:

```bash
cd /home/ubuntu/analytics-dashboard
node -e "
const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [devices] = await conn.query('SELECT COUNT(*) as count FROM dashboard_items WHERE is_wearables_tag = 1');
  const [software] = await conn.query('SELECT COUNT(*) as count FROM software_items WHERE is_wearables_tag = 1');
  const [systems] = await conn.query('SELECT COUNT(*) as count FROM systems_items WHERE is_wearables_tag = 1');
  const [hearing] = await conn.query('SELECT COUNT(*) as count FROM hearing_items WHERE is_wearables_tag = 1');
  const [ai] = await conn.query('SELECT COUNT(*) as count FROM ai_items WHERE is_wearables_tag = 1');
  
  console.log('Wearables-tagged items:');
  console.log('- Devices:', devices[0].count);
  console.log('- Software:', software[0].count);
  console.log('- Systems:', systems[0].count);
  console.log('- Hearing:', hearing[0].count);
  console.log('- AI:', ai[0].count);
  console.log('Total:', devices[0].count + software[0].count + systems[0].count + hearing[0].count + ai[0].count);
  
  await conn.end();
}

check().catch(console.error);
"
```

### Adding New Data Sources

If you add a new data source that should support `[wearables-tag]`:

1. Add `isWearablesTag: int("is_wearables_tag").default(0).notNull()` to the table schema in `drizzle/schema.ts`
2. Generate and apply migration: `pnpm drizzle-kit generate` then `webdev_execute_sql`
3. Update the parser to detect `[wearables-tag]` and strip it from content
4. Add the new table to `getWearablesTaggedItems()` query in `server/db.ts`
5. Test sync and verify items appear in Wearable Week tile



---

## No-Cache Policy for Sync Scripts

**Critical Requirement:** All sync scripts MUST download fresh files from Google Drive on every refresh. Caching can cause stale data to be displayed even after source documents are updated.

### Implementation

All `rclone copy` commands include cache-busting flags:
```bash
rclone copy "manus_google_drive:path/to/file.docx" /tmp/ \
  --config /home/ubuntu/.gdrive-rclone.ini \
  --ignore-times \
  --no-check-certificate
```

**Flags explained:**
- `--ignore-times`: Forces download even if local file has same modification time
- `--no-check-certificate`: Bypasses SSL certificate caching

### File Deletion Before Download

All scripts delete temp files before downloading:
```bash
rm -f "/tmp/filename.docx"
rclone copy "manus_google_drive:path/to/filename.docx" /tmp/ ...
```

### Affected Scripts

**Bash sync scripts:**
- `sync_from_gdrive.sh` (Devices)
- `sync_ai.sh` (AI)
- `sync_hearing.sh` (Hearing)

**Python parsers:**
- `server/parse_ie_review.py` (Software I+E)
- `server/parse_systems_review.py` (Systems)
- `server/parse_milestones_xlsx.py` (Milestones)

### Verification

To verify cache-busting is working:
1. Update source document in Google Drive
2. Run sync script
3. Check item count changes in database
4. Verify new content appears in UI

**Test command:**
```bash
cd /home/ubuntu/analytics-dashboard
bash sync_from_gdrive.sh
# Should show different item count if source changed
```

### Troubleshooting

If stale data persists after sync:
1. Check that `--ignore-times --no-check-certificate` flags are present in rclone command
2. Verify temp file is deleted before download (`rm -f "/tmp/filename"`)
3. Check rclone logs for download errors
4. Verify database cache is cleared after sync (query-cache.ts `invalidateDashboardCache()`)


## Automatic Error Detection & Fixing

The sync system includes automatic error detection and recovery mechanisms to ensure reliable data updates:

### Startup Sync
- **When**: Runs automatically 5 seconds after server starts/wakes from hibernation
- **Why**: Ensures fresh data when you first access the dashboard each day
- **What**: Full sync of all 8 data sources with validation checks

### Cache Clearing
- **When**: Before every sync (startup, scheduled, manual admin refresh)
- **How**: Calls `invalidateDashboardCache()` to clear all query cache
- **Verification**: Check logs for "🧽 Clearing query cache..." message

### Fresh File Downloads
- **Mechanism**: All rclone commands use `--ignore-times --no-check-certificate` flags
- **Effect**: Forces fresh download from Google Drive, bypasses modification time checks and SSL cert caching
- **Verification**: Check sync logs for successful downloads with latest modification times

### Week Validation
- **Tool**: `server/validate_week.py`
- **Rules**: 
  - Files must be from current week (W{current}) or last week (W{current-1})
  - Maximum age: 14 days
  - Rejects files older than 14 days
- **Action**: Logs warning if file is outdated, continues with sync but alerts user to update source
- **Verification**: Check logs for "✅ File validation passed: File is from W{X} ({Y} days old) - valid"

### Automatic Retries
- **Token refresh errors**: Up to 3 retries with exponential backoff (2s, 4s, 8s)
- **Network timeouts**: Automatic retry with 180-second timeout per sync
- **Parse errors**: Logs error details, skips problematic items, continues with rest

### Error Notifications
- **Persistent failures**: Owner notification sent if all retries fail
- **Partial failures**: Logs which sources failed, continues with successful sources
- **Success confirmation**: Logs item counts for each source after successful sync

### Testing Auto-Fix
To verify auto-fix is working:

```bash
# Test startup sync
cd /home/ubuntu/analytics-dashboard
grep "Starting startup sync" .manus-logs/sync-scheduler.log

# Test cache clearing
grep "Clearing query cache" .manus-logs/sync-scheduler.log

# Test week validation
cd server && python3 validate_week.py "2026-02-26T17:00:00Z"

# Test with old file (should fail)
python3 validate_week.py "2026-01-01T00:00:00Z"
```

### Troubleshooting

**If sync fails repeatedly:**
1. Check `.manus-logs/sync-scheduler.log` for error details
2. Verify Google Drive token is valid: `rclone lsd manus_google_drive: --config /home/ubuntu/.gdrive-rclone.ini`
3. Check file modification dates in Google Drive
4. Manually trigger sync via Admin Refresh button
5. Check database for loaded items

**If week validation fails:**
- Update source documents in Google Drive to current/last week
- Check that file naming matches expected patterns (W{number} prefix)
- Verify modification times are recent (within 14 days)

---

## UptimeRobot Setup Guide

To ensure the dashboard syncs automatically at 8:45 AM PST even when the sandbox is hibernated, set up a free UptimeRobot monitor to wake the server 5 minutes before the scheduled sync.

### Step 1: Sign Up for UptimeRobot

1. Go to https://uptimerobot.com
2. Click "Register for FREE"
3. Create account (free tier allows 50 monitors)

### Step 2: Create Monitor

1. Click "Add New Monitor"
2. Configure monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: "Wearables Dashboard Wake-Up"
   - **URL**: `https://3000-igce7qiubzimnqap2s96q-4a48a2c0.us2.manus.computer`
   - **Monitoring Interval**: 5 minutes (free tier)
   - **Monitor Timeout**: 30 seconds
3. Click "Create Monitor"

### Step 3: Set Up Daily Wake-Up

Unfortunately, UptimeRobot free tier doesn't support scheduled checks (only continuous monitoring). **Alternative solutions:**

**Option A: Use cron-job.org (Recommended)**
1. Go to https://cron-job.org/en/
2. Sign up for free account
3. Create new cron job:
   - **Title**: "Wake Wearables Dashboard"
   - **URL**: `https://3000-igce7qiubzimnqap2s96q-4a48a2c0.us2.manus.computer`
   - **Schedule**: Daily at 8:40 AM PST (16:40 UTC)
   - **Enabled**: Yes
4. Save cron job

**Option B: Deploy to Production (Best Long-Term)**
1. Click "Publish" button in dashboard UI
2. Deploy to Manus production hosting
3. Server runs 24/7, scheduled sync works reliably
4. No external service needed

### Step 4: Verify Setup

After setup:
1. Wait for next scheduled wake-up (8:40 AM PST)
2. Check `.manus-logs/sync-scheduler.log` for startup sync at ~8:40 AM
3. Verify scheduled sync runs at 8:45 AM
4. Confirm dashboard shows fresh data

### Monitoring

UptimeRobot/cron-job.org will:
- Ping your dashboard URL at 8:40 AM PST
- Wake up the sandbox from hibernation
- Trigger startup sync (runs 5 seconds after wake)
- Scheduled sync runs at 8:45 AM as configured
- Dashboard has fresh data when you access it

### Troubleshooting

**If wake-up doesn't work:**
- Verify cron job URL is correct (check for typos)
- Check cron job execution history for errors
- Verify sandbox URL hasn't changed (Manus may rotate URLs)
- Consider deploying to production for reliability
