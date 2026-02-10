# Analytics Dashboard - Complete Data Source Documentation

## Overview
This document provides a comprehensive mapping of all dashboard sections, their data sources, file detection logic, and extracted data fields.

---

## Dashboard Sections & Data Sources

| Section | Tab/Subsection | Google Drive File Path | File Detection Logic | Extracted Data | Parser Script |
|---------|----------------|------------------------|---------------------|----------------|---------------|
| **WEARABLE WEEK X UPDATES** | Devices | `Wearables Everything/Reviews (Comment Only)/Device & Growth Program Reviews/Device & Growth Canonical Program Review.docx` | **Static canonical document** - Always pulls from this fixed file path | • Highlights (AI Glasses, Wrist, ARG/SSG)<br>• Risks/Opens (AI Glasses, Wrist, ARG/SSG)<br>• Upcoming (AI Glasses, Wrist, ARG/SSG)<br>• Blue text detection for new items<br>• Week number from title | `parse_exec_summary.py` |
| **DETAILED UPDATES** | Devices Tab | Same as above | Same as above | Same as above | Same as above |
| **DETAILED UPDATES** | Experiences & Interfaces Tab | `Wearables Everything/Reviews (Comment Only)/Software (I+E, AI, Hearing) Reviews/I+E Previous Reviews & Review Notes/W## Experiences & Interfaces Review.docx` | **Weekly archive detection:**<br>1. List all files matching pattern `W\d+ Experiences & Interfaces Review.docx`<br>2. Sort by modification time (most recent first)<br>3. Select latest file<br>4. Typically current or previous week | • **WINS:** Bullet list with category headers<br>• **EXEC SUMMARY:** Structured updates by category<br>• **DECISIONS:** Table with columns:<br>&nbsp;&nbsp;- Topic/Decision Doc<br>&nbsp;&nbsp;- DRI<br>&nbsp;&nbsp;- Decision Makers<br>&nbsp;&nbsp;- Decision Outcome<br>• Rich text formatting (bold, hyperlinks)<br>• Indentation levels | `parse_ie_review.py`<br>`extract_decision_tables.py` |
| **DETAILED UPDATES** | AI Tab | Same as above | Same as above | Same data structure as I+E tab, filtered for AI section | Same as above |
| **DETAILED UPDATES** | Hearing Tab | Same as above | Same as above | Same data structure as I+E tab, filtered for Hearing section | Same as above |
| **DETAILED UPDATES** | Systems Tab | `Wearables Everything/Reviews (Comment Only)/Systems Software Reviews/Archive/Wearables Systems Review-WK##-2026.docx` | **Weekly archive detection:**<br>1. List all files matching pattern `Wearables Systems Review[-\s]+WK?\d+[-\s]+2026.docx`<br>2. Sort by modification time (most recent first)<br>3. Select latest file<br>4. Typically current or previous week | • **WINS:** Architecture, Connectivity, Multimedia, Productivity & Infrastructure, System Health<br>• **EXEC SUMMARY:** Structured updates by category<br>• **HELP NEEDED:** Issues requiring leadership attention<br>• Rich text formatting (bold, hyperlinks)<br>• Indentation levels | `parse_systems_review.py` |
| **UPCOMING DATES** | PDP Gates | `Wearables Everything/Wearable Program Milestones SOT - For AI _ User Consumption.xlsx` | **Static spreadsheet** - Always pulls from this fixed file path | • Program name<br>• Milestone name<br>• Date<br>• Milestone type: `pdp_gates`<br>• Filter: Past 3 weeks + Next 1 month<br>• Completion status (checkmark for past dates) | `parse_milestones_xlsx.py` |
| **UPCOMING DATES** | Key Software Milestones | Same as above | Same as above | • Program name<br>• Milestone name<br>• Date<br>• Milestone type: `sw_milestones`<br>• Filter: Next 1 month<br>• Sorted chronologically | Same as above |
| **UPCOMING DATES** | Hardware Dates | Same as above | Same as above | • Program name<br>• Milestone name<br>• Date<br>• Milestone type: `hw_dates`<br>• Filter: Next 1 month<br>• Sorted chronologically | Same as above |
| **UPCOMING DATES** | Releases | Same as above | Same as above | • Program name<br>• Milestone name (version releases)<br>• Date<br>• Milestone type: `release_milestones`<br>• Filter: Next 12 months<br>• Sorted chronologically | Same as above |
| **UPCOMING DATES** | Go-to-Market Dates | Same as above | Same as above | • Program name<br>• Milestone name<br>• Date<br>• Milestone type: `gtm_milestones`<br>• Filter: Next 4 weeks<br>• Sorted chronologically | Same as above |
| **DECISIONS MADE** | Decisions Table | `Wearables Everything/Wearable Decisions Canonical.docx` | **Static canonical document** - Always pulls from this fixed file path | • Week number<br>• DRI (Decision Responsible Individual)<br>• Forum<br>• Status<br>• Decision Outcome<br>• Filter: Last 1 month only | `parse_decisions.py` |

---

## File Detection Logic Details

### 1. Static Canonical Documents
**Used for:** Devices, Decisions, Milestones

**Logic:**
- Always pull from the same fixed file path
- No version detection needed
- These are "living documents" that are continuously updated
- Cache clearing recommended on each sync to ensure fresh data

**Files:**
- `Device & Growth Canonical Program Review.docx`
- `Wearable Decisions Canonical.docx`
- `Wearable Program Milestones SOT - For AI _ User Consumption.xlsx`

### 2. Weekly Archive Detection
**Used for:** Software (I+E, AI, Hearing), Systems

**Logic:**
```python
1. Use rclone lsjson to list all files in archive folder with metadata
2. Filter files matching weekly pattern:
   - Software: r'W\d+ Experiences & Interfaces Review\.docx'
   - Systems: r'Wearables Systems Review[-\s]+WK?\d+[-\s]+2026\.docx'
3. Sort by ModTime (modification timestamp) in descending order
4. Select the first file (most recently modified)
5. Download and parse that file
```

**Why modification time instead of week number:**
- Handles cases where current week file isn't ready yet
- Automatically falls back to previous week
- More reliable than date-based logic
- Accounts for late uploads or corrections

**Cache Clearing:**
- Clear `/tmp/` cache before each download to prevent stale data
- Remove both .docx files and .json intermediate files

---

## Data Extraction Details

### Rich Text Formatting
All parsers extract:
- **Bold text:** Preserved using markdown `**text**` format
- **Hyperlinks:** Preserved using markdown `[text](url)` format
- **Blue text:** Detected via RGB color analysis, stored as `is_new` flag
- **Indentation:** Detected via Word numbering levels (`ilvl`), stored as `indent_level`

### Decision Tables
Special extraction logic for structured decision data:
- Locate tables with headers: "Topic/Decision Doc", "DRI", "Decision Makers", "Decision Outcome"
- Extract all paragraphs from each cell (not just first paragraph)
- Preserve rich text formatting in all cells
- Store as structured data with separate fields

### Week Number Detection
- Extract from document title using regex: `r'W(\d+)'` or `r'Week\s+(\d+)'`
- Used for dashboard header: "WEARABLE WEEK X UPDATES"
- Fallback to current ISO week if not found in document

---

## Sync Scripts

| Script | Purpose | Data Sources |
|--------|---------|--------------|
| `sync_from_gdrive.sh` | Devices (Exec Summary) | Device & Growth Canonical Program Review |
| `sync_software.sh` | Software I+E, AI, Hearing | Latest W## Experiences & Interfaces Review |
| `sync_systems.sh` | Systems | Latest Wearables Systems Review-WK##-2026 |
| `sync_decisions.sh` | Decisions Made | Wearable Decisions Canonical |
| `sync_milestones.sh` | All Upcoming Dates tiles | Wearable Program Milestones SOT |
| `sync_all_data.sh` | **Master sync** - runs all above scripts | All data sources |

---

## Database Schema

### Tables

**1. exec_summary_items**
- `product` (ai_glasses, wrist, arg_ssg)
- `section_type` (highlights, risks, upcoming)
- `content` (markdown text)
- `is_new` (boolean - blue text indicator)
- `indent_level` (0, 1, 2, ...)
- `order` (display order)

**2. software_items**
- `software_category` (software_ie, software_ai, software_hearing)
- `section_type` (wins, exec_summary, decisions)
- `content` (markdown text)
- `topic`, `dri`, `forum`, `status`, `decision_doc`, `decision_makers`, `decision_outcome` (for decisions)
- `is_new` (boolean)
- `indent_level` (0, 1, 2, ...)
- `order` (display order)

**3. systems_items**
- `section_type` (wins, exec_summary, help_needed)
- `content` (markdown text)
- `is_new` (boolean)
- `indent_level` (0, 1, 2, ...)
- `order` (display order)

**4. milestones**
- `program` (Artemis, Ceres, Malibu, etc.)
- `milestone_name`
- `milestone_date`
- `milestone_type` (pdp_gates, sw_milestones, hw_dates, release_milestones, gtm_milestones)

**5. decisions**
- `week`
- `dri`
- `forum`
- `status`
- `decision_outcome`

**6. sync_metadata**
- `section` (devices, software, systems)
- `source_url` (Google Drive folder link)
- `source_file_path` (actual file path used)
- `last_sync_time`

---

## Source Document Links

| Tab | Link Type | URL | Notes |
|-----|-----------|-----|-------|
| Devices | Static | `https://fburl.com/devicegrowthpr` | Shortlink to canonical doc |
| Software (All) | Folder | `https://drive.google.com/drive/folders/1WUVIL8v9oQS7Mvc7Snz5lHBhKth-8f9h` | Device & Growth Program Reviews folder |
| Systems | Folder | `https://drive.google.com/drive/folders/1Qf4aS6k4QbCd_0DF2OCz7AMSUiKFvFWw` | Systems Software Reviews/Archive folder |

---

## Verification Checklist

✅ **Devices Tab:**
- Pulls from canonical document (static path)
- Shows Highlights, Risks/Opens, Upcoming for 3 products
- Blue text indicates new information
- Week number in header

✅ **Software Tabs (I+E, AI, Hearing):**
- Pulls from latest W## weekly archive (modification time based)
- Shows WINS, EXEC SUMMARY, DECISIONS in 3-column layout
- Decision tables have 4 columns with rich text
- Green pastel color when selected
- Links to Device & Growth Program Reviews folder

✅ **Systems Tab:**
- Pulls from latest WK##-2026 weekly archive (modification time based)
- Shows WINS, EXEC SUMMARY, HELP NEEDED in 3-column layout
- Orange pastel color when selected
- Links to Systems Software Reviews/Archive folder

✅ **Upcoming Dates:**
- 5 tiles: PDP Gates, SW Milestones, HW Dates, Releases, GTM Dates
- All pull from same spreadsheet with different filters
- Week numbers shown for 2026 dates
- Checkmarks for completed PDP gates

✅ **Decisions Made:**
- Pulls from canonical document
- Shows last month of decisions only
- Table format with all decision details

---

## Cache Management

**Current Implementation:**
- Cache files stored in `/tmp/`
- Cleared at start of each sync script
- Files cleared:
  - `*.docx` (Word documents)
  - `*_data.json` (intermediate JSON files)

**Recommendation:**
- Systematic cache clearing before every refresh
- Prevents stale data from being displayed
- Ensures latest document versions are always used

---

## Last Updated
February 9, 2026 - Systems tab fixed to use weekly archive pattern
