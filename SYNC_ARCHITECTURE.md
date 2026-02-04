# Unified Sync Architecture

**Last Updated:** February 4, 2026

---

## Overview

The dashboard uses a **unified sync architecture** where both daily auto-sync and manual refresh use the same TypeScript code path (`googleDriveSync.ts`). This ensures consistency, maintainability, and prevents configuration drift.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     SYNC ENTRY POINTS                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Daily Auto-Sync (6 AM PST)        2. Manual Refresh     │
│     ↓                                     ↓                  │
│  sync-scheduler.ts                    Refresh Data Button    │
│  (cron: 0 6 * * *)                    (Frontend UI)         │
│     ↓                                     ↓                  │
│     └─────────────────┬───────────────────┘                 │
│                       ↓                                       │
│              ┌─────────────────┐                            │
│              │  googleDriveSync.ts │                            │
│              │   syncAll(forceRefresh)  │                            │
│              └─────────────────┘                            │
│                       ↓                                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                  DATA SOURCE SYNC                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Devices (Word Doc)                                       │
│     - Path: Device & Growth Canonical Program Review.docx   │
│     - Parser: parse_exec_summary.py                         │
│     - Table: dashboardItems                                  │
│                                                               │
│  2. Software (Word Doc)                                      │
│     - Path: Software (I+E, AI, Hearing) Canonical...        │
│     - Parser: parse_software_review.py                      │
│     - Table: softwareItems                                   │
│                                                               │
│  3. Systems (Word Doc)                                       │
│     - Path: Wearables Systems Review.docx                   │
│     - Parser: parse_systems_review.py                       │
│     - Table: systemsItems                                    │
│                                                               │
│  4. Decisions (Word Doc)                                     │
│     - Path: Wearable Decisions Canonical .docx              │
│     - Parser: parse_decisions.py                            │
│     - Table: decisions                                       │
│                                                               │
│  5. Milestones (Excel Spreadsheet)                          │
│     - Path: Wearable Program Milestones SOT.xlsx            │
│     - Parser: parse_milestones_xlsx.py                      │
│     - Loader: load_milestones.mjs                           │
│     - Table: milestones                                      │
│                                                               │
│  6. Upcoming Reviews (3 Excel Spreadsheets)                 │
│     - Paths: 2026 Wearables Reviews Sign-Up Sheet .xlsx     │
│              2026 Product Reviews Sign-Up Sheet.xlsx        │
│              Systems Reviews Sign-Up Sheet .xlsx            │
│     - Parser: parse_upcoming_reviews.py                     │
│     - Loader: load_upcoming_reviews.mjs                     │
│     - Table: upcomingReviews                                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. **sync-scheduler.ts**
- **Purpose:** Cron scheduler for daily auto-sync at 6 AM PST
- **Schedule:** `0 6 * * *` (6:00 AM every day, America/Los_Angeles timezone)
- **Implementation:** Imports and calls `syncAll(true)` from `googleDriveSync.ts`
- **Logging:** Writes to `.manus-logs/sync-scheduler.log`
- **Notifications:** Sends owner notifications on failures

### 2. **googleDriveSync.ts**
- **Purpose:** Single source of truth for all sync logic
- **Function:** `syncAll(forceRefresh: boolean)`
- **Features:**
  - MD5 checksum-based caching (skips unchanged files)
  - Parallel downloads (sequential to avoid rclone conflicts)
  - Canonical shortcuts (not week-specific paths)
  - Error handling per source
  - Returns detailed status for each of 6 sources

### 3. **Refresh Data Button**
- **Location:** Dashboard header (frontend)
- **Implementation:** Calls `trpc.sync.syncAll.useMutation()`
- **Backend:** `server/routers.ts` → `sync.syncAll` procedure → `googleDriveSync.syncAll(true)`

---

## Sync Flow

### Daily Auto-Sync (6 AM PST)
1. Cron triggers `runSync()` in `sync-scheduler.ts`
2. Imports `syncAll` from `googleDriveSync.ts`
3. Calls `syncAll(true)` to force refresh
4. Logs results for each of 6 sources
5. Sends owner notification if any failures
6. Writes to `.manus-logs/sync-scheduler.log`

### Manual Refresh
1. User clicks "Refresh Data" button
2. Frontend calls `trpc.sync.syncAll.mutate({ forceRefresh: true })`
3. Backend procedure calls `syncAll(true)` from `googleDriveSync.ts`
4. Returns status to frontend
5. Frontend shows toast notification

---

## Data Source Paths

All paths use **canonical shortcuts** in Google Drive root (not week-specific paths):

| Source | Google Drive Path | Type |
|--------|------------------|------|
| Devices | `Device & Growth Canonical Program Review.docx` | Shortcut |
| Software | `Software (I+E, AI, Hearing) Canonical Program Review.docx` | Shortcut |
| Systems | `Wearables Systems Review.docx` | Shortcut |
| Decisions | `Wearable Decisions Canonical .docx` | Shortcut |
| Milestones | `Wearable Program Milestones SOT.xlsx` | Shortcut |
| Reviews (Wearables) | `2026 Wearables Reviews Sign-Up Sheet .xlsx` | Shortcut |
| Reviews (Product) | `2026 Product Reviews Sign-Up Sheet.xlsx` | Shortcut |
| Reviews (Systems) | `Systems Reviews Sign-Up Sheet .xlsx` | Shortcut |

**Why shortcuts?** Canonical shortcuts always point to the latest version, avoiding week-specific paths like "W5 2026" that break when weeks change.

---

## Caching Strategy

- **MD5 checksums** stored in `.manus-logs/sync-cache.json`
- Downloads skipped if file unchanged (saves ~50% sync time)
- `forceRefresh: true` bypasses cache and re-downloads all files
- Cache cleared on server restart

---

## Error Handling

### Per-Source Errors
- Each source syncs independently
- One source failure doesn't block others
- Status tracked per source: `{ success: boolean, message: string, cached: boolean }`

### Notification Strategy
- **All succeed:** No notification (silent success)
- **Partial failure:** Owner notified with count of successes/failures
- **Total failure:** Owner notified with error details

---

## Logs

| Log File | Purpose |
|----------|---------|
| `.manus-logs/sync-scheduler.log` | Daily auto-sync logs |
| `.manus-logs/devserver.log` | Server startup and sync initialization |
| `.manus-logs/sync-cache.json` | MD5 checksums for caching |

---

## Benefits of Unified Architecture

1. **Single Source of Truth:** Both daily and manual sync use same code
2. **Canonical Shortcuts:** No week-specific paths that break
3. **Consistent Behavior:** Same logic, same results
4. **Easier Maintenance:** Update sync logic in one place
5. **Better Caching:** Shared cache between daily and manual syncs
6. **Type Safety:** TypeScript ensures correctness

---

## Migration Notes

**Previous Architecture (Deprecated):**
- Daily auto-sync used shell scripts (`sync_all_data.sh` → individual `sync_*.sh`)
- Manual refresh used TypeScript (`googleDriveSync.ts`)
- **Problem:** Configuration drift, week-specific paths in shell scripts

**Current Architecture (Active):**
- Both use `googleDriveSync.ts`
- Shell scripts preserved for manual debugging but not used in production
- All paths use canonical shortcuts

---

## Testing

To test the unified sync:

```bash
# Test manual sync via tRPC
curl -X POST http://localhost:3000/api/trpc/sync.syncAll \
  -H "Content-Type: application/json" \
  -d '{"forceRefresh": true}'

# Check scheduler logs
tail -f /home/ubuntu/analytics-dashboard/.manus-logs/sync-scheduler.log

# Verify next scheduled run
grep "Next sync will run" /home/ubuntu/analytics-dashboard/.manus-logs/devserver.log
```

---

## Troubleshooting

### Sync Not Running at 6 AM
1. Check server is running: `ps aux | grep tsx`
2. Check scheduler initialized: `grep "Sync scheduler initialized" .manus-logs/devserver.log`
3. Check timezone: Should see "America/Los_Angeles" in logs

### Sync Failing
1. Check logs: `tail -100 .manus-logs/sync-scheduler.log`
2. Check Google Drive access: `rclone ls manus_google_drive: --config /home/ubuntu/.gdrive-rclone.ini`
3. Check Python environment: `/home/ubuntu/analytics-dashboard/venv/bin/python --version`

### Cache Issues
1. Clear cache: `rm /home/ubuntu/analytics-dashboard/.manus-logs/sync-cache.json`
2. Force refresh: Use `forceRefresh: true` parameter

---

## Future Enhancements

1. **Sync Progress UI:** Real-time progress indicator showing which source is syncing
2. **Sync History:** Database table tracking all sync runs with timestamps and results
3. **Selective Sync:** Allow syncing individual sources instead of all 6
4. **Webhook Triggers:** Sync when Google Drive files change (instead of polling)
