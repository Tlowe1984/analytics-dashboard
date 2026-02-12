# Dashboard Data Sync Logic Documentation

This document describes how the Admin Refresh function pulls data from Google Drive sources.

## Overview

When you click **Admin Refresh**, the system syncs **7 data sources** from Google Drive:

1. Devices
2. Software (I+E, AI, Hearing combined)
3. Systems
4. Hearing (Health)
5. Decisions
6. Milestones
7. Upcoming Reviews

## File Sourcing Logic Table

| Source | Google Drive Folder Path | File Selection Logic | File Pattern | Notes |
|--------|-------------------------|---------------------|--------------|-------|
| **Devices** | `Wearables Everything/Reviews (Comment Only)/Device & Growth Reviews/Previous Reviews & Review Notes` | Most recent file matching `WXX Device & Growth Canonical Program Review.docx` where XX is current or previous week | `W[0-9]{2} Device & Growth Canonical Program Review\.docx` | Static document name, changes weekly |
| **Software (I+E)** | `Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/I+E Previous reviews & Review notes` | Most recent file matching `WXX Experiences & Interfaces Review.docx` where XX is current or previous week | `W[0-9]{2} Experiences & Interfaces Review\.docx` | Parses Wins, Exec Summary, Decisions sections |
| **Software (AI)** | `Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/AI Previous Reviews & Review Notes` | Most recent file matching `WXX AI Canonical Program Review.docx` where XX is current or previous week | `W[0-9]{2} AI Canonical Program Review\.docx` | Parses Wins, Exec Summary, Decisions sections |
| **Software (Hearing)** | `Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/Hearing/Previous Reviews & Review Notes` | Most recent file matching `WXX Hearing Canonical Program Review.docx` where XX is current or previous week | `W[0-9]{2} Hearing Canonical Program Review\.docx` | Separate from Health tab |
| **Systems** | `Wearables Everything/Reviews (Comment Only)/Systems Reviews/Previous Reviews & Review Notes` | Most recent file matching `WXX Wearables Systems Review.docx` where XX is current or previous week | `W[0-9]{2} Wearables Systems Review\.docx` | Parses Wins, Exec Summary, Decisions sections |
| **Hearing (Health)** | `Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/Health/Previous Reviews & Review Notes` | Most recent file matching `WXX Health Canonical Program Review.docx` where XX is current or previous week | `W[0-9]{2} Health Canonical Program Review\.docx` | Parses Wins, Exec Summary, Decisions table |
| **Decisions** | `Wearables Everything/Reviews (Comment Only)/Decisions/Wearable Decisions Canonical .docx` | Static file (does not change weekly) | `Wearable Decisions Canonical .docx` | Single canonical decisions document |
| **Milestones** | `Wearables Everything/Reviews (Comment Only)/Wearable Program Milestones SOT - For AI ／ User Consumption.xlsx` | Static Excel file | `Wearable Program Milestones SOT - For AI ／ User Consumption.xlsx` | Parses milestone dates and types |
| **Upcoming Reviews** | `Wearables Everything/Reviews (Comment Only)/2026 Wearables Reviews Sign-Up Sheet .xlsx` (and similar) | Searches for multiple review sign-up sheets (Product, Systems, Wearables) | `2026 (Product|Systems|Wearables) Reviews Sign-Up Sheet\.xlsx` | Combines data from multiple sheets |

## Week Detection Logic

For weekly documents (Devices, Software, Systems, Hearing):

1. **Calculate current week**: Determine the current ISO week number (e.g., W07 for week 7 of 2026)
2. **Calculate previous week**: Previous week number (e.g., W06)
3. **Search pattern**: Look for files matching `WXX [Document Type].docx` where XX is either current or previous week
4. **Sort by modified date**: Select the most recently modified file matching the pattern
5. **Fallback**: If no current/previous week file found, use the most recent file in the folder

This logic ensures the dashboard always shows the latest available data, even if the current week's document hasn't been created yet.

## Cache Clearing

Every time Admin Refresh is clicked:
- All query caches are invalidated
- Fresh downloads are performed (no temp file reuse)
- Database is updated with new data
- Frontend automatically refreshes to show updated content

## Sync Timing

- **Manual**: Click "Admin Refresh" button (admin only)
- **Automatic**: Daily at 6:00 AM PST via Node.js cron scheduler

## Error Handling

If any source fails to sync:
- Other sources continue syncing (parallel execution)
- Error toast shows which sources failed
- Logs are written to `.manus-logs/sync.log`
- Owner notification sent for failures

## Data Parsing

Each source document is parsed to extract:
- **Wins**: Bullet points under "Wins" or "🏆 Wins" heading
- **Exec Summary**: Bullet points under "Exec Summary" or "🚀 Exec Summary" heading
- **Decisions**: Either bullet points or table rows under "Decisions" heading
- **Indentation**: Preserved from source document (nested bullets maintain hierarchy)
- **Rich text**: Links, bold text, and formatting preserved where possible

## Source Document Links

The dashboard provides "View Source Document" links that:
- For weekly documents: Link to the **folder** (not specific file) since files change weekly
- For static documents: Link directly to the specific document
- Fallback URLs provided if database link is unavailable
