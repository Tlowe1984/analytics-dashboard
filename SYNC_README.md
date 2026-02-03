# Dashboard Data Sync Guide

## Current Status

The dashboard successfully displays executive summary data from your Google Doc with blue text highlighting for new information. However, due to a Python/Node.js environment conflict, the automatic "Refresh Data" button is currently not functional.

## Manual Sync Process

To update the dashboard with the latest data from your Google Doc, run the manual sync script:

```bash
cd /home/ubuntu/analytics-dashboard
./sync_from_gdrive.sh
```

This script will:
1. Download the latest Google Doc from Drive
2. Parse the executive summary content
3. Detect blue text for new information
4. Load the data into the database

After running the script, refresh your browser to see the updated data.

## What's Working

✅ Dashboard displays real data from Google Doc  
✅ Blue text highlighting for new information  
✅ All 3 product categories (AI Glasses, Wrist, ARG/SSG)  
✅ All 3 section types (Highlights, Risks/Opens, Upcoming)  
✅ Week number extraction from document title  
✅ Milestone dates display  
✅ AI chat interface for querying data  

## What Needs Manual Intervention

⚠️ Automatic sync button (Python/Node.js environment conflict)  
⚠️ Periodic auto-refresh (disabled due to sync issue)  

## Technical Details

The sync issue stems from a Python `json` module conflict when called from Node.js. The parser script works perfectly when run directly from the command line, but fails when invoked through Node.js's `child_process.exec()`.

**Workaround**: Use the manual sync script above, which runs the Python parser directly without Node.js interference.

## Future Improvements

- Resolve Python/Node.js environment conflict
- Re-enable automatic sync button
- Add scheduled background sync
- Implement change detection to only update modified items
