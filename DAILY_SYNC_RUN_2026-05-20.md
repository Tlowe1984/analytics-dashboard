# Daily Sync Run — 2026-05-20 (W21)

**Run Time:** 2026-05-20 22:xx UTC (scheduled 8:45 AM PST)
**Status:** ⚠️ Blocked — Production deployment required

---

## Summary

The scheduled task ran successfully in a fresh sandbox environment. The repository was cloned from GitHub (`Tlowe1984/analytics-dashboard`) and Node.js dependencies were installed. However, the data sync could **not** complete because the required platform secrets are only available in the production WebDev deployment.

---

## Root Cause (Persistent)

This is the same blocker identified on 2026-05-05 and 2026-05-16. The scheduled task sandbox is a fresh isolated environment that does **not** have:

| Secret | Status | Notes |
|--------|--------|-------|
| `DATABASE_URL` | ❌ Not set | TiDB Cloud connection string — Manus WebDev platform secret |
| `GOOGLE_WORKSPACE_CLI_TOKEN` | ❌ Empty string | Google Drive Bearer token — Manus WebDev platform secret |
| `/home/ubuntu/.gdrive-rclone.ini` | ❌ Missing | rclone config — only in original dev sandbox |
| `/home/ubuntu/wearables-venv` | ❌ Missing | Python venv — only in original dev sandbox |

The Node.js-native sync (`server/scheduledSync.ts`) was built specifically to work around the rclone/Python limitations, but it still requires `GOOGLE_WORKSPACE_CLI_TOKEN` and `DATABASE_URL` — which are only injected by the Manus platform into the **production** WebDev deployment.

---

## What Was Completed This Run

- [x] Cloned repository from `Tlowe1984/analytics-dashboard` (commit `95b91011`)
- [x] Installed Node.js dependencies via `pnpm install`
- [x] Ran `setup.sh` (Python venv setup)
- [x] Confirmed server code is up-to-date (includes `x-sync-secret` auth bypass)
- [x] Confirmed all 8 sync sources are implemented in `server/scheduledSync.ts`
- [x] Confirmed production server URL (`https://3000-igce7qiubzimnqap2s96q-4a48a2c0.us2.manus.computer`) is currently **asleep** (old dev sandbox URL)

---

## Action Required (Manual)

To make the daily sync work automatically, the following **one-time manual step** is required:

> **Open the `analytics-dashboard` project in Manus and click the Publish button.**

This will:
1. Deploy the latest server code (including `x-sync-secret` auth bypass and `runScheduledSync()`)
2. Inject `DATABASE_URL` and `GOOGLE_WORKSPACE_CLI_TOKEN` into the production environment
3. Start the production server with the node-cron scheduler (daily at 8:45 AM PST)
4. Allow this scheduled task to call `/api/scheduled/sync` via `x-sync-secret` header

After publishing, the scheduled task can be updated to POST to:
```
POST https://<production-url>/api/scheduled/sync
Header: x-sync-secret: sync-secret-default
```

---

## Architecture Reference

The sync pipeline (once deployed) works as follows:

```
Scheduled Task Sandbox (this task)
    ↓ POST /api/scheduled/sync
    ↓ Header: x-sync-secret: sync-secret-default
Production WebDev Server (has DATABASE_URL + GOOGLE_WORKSPACE_CLI_TOKEN)
    ↓ runScheduledSync() — Node.js-native
    ↓ Google Drive API v3 (Bearer token auth)
8 Source Files (Drive)
    ↓ JSZip + xmldom (.docx) / exceljs (.xlsx)
TiDB Database
    ↓ tRPC queries + in-memory cache
React Dashboard UI
```

---

## 8 Data Sources (All Implemented in scheduledSync.ts)

| # | Source | File | Status |
|---|--------|------|--------|
| 1 | Devices | `Device Canonical Program Review.docx` | ✅ Implemented |
| 2 | Decisions | `Wearable Decisions Canonical .docx` | ✅ Implemented |
| 3 | Software (I+E) | `Software (I+E, AI, Hearing) Canonical Program Review.docx` | ✅ Implemented |
| 4 | Systems | Latest `Wearables Systems Review-WK##-2026.docx` in archive folder | ✅ Implemented |
| 5 | Milestones | `Wearables Device Program Milestones - Aggregation Sheet.xlsx` | ✅ Implemented |
| 6 | Upcoming Reviews | 3 xlsx sign-up sheets | ✅ Implemented |
| 7 | AI Review | Latest `AI W## ...Product Review.docx` | ✅ Implemented |
| 8 | Hearing/Health | Latest `WK## Health Canonical Program Review.docx` | ✅ Implemented |
