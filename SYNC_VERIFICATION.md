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
