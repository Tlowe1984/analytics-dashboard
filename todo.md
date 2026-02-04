# Analytics Dashboard TODO

## Phase 1: Project Setup
- [x] Initialize full-stack web project with database and authentication
- [x] Create todo.md tracking file

## Phase 2: Google Docs Integration
- [x] Access and extract executive summary content from Google Doc
- [x] Parse document structure and identify sections
- [x] Map content to 3x3 grid structure (Highlights/Risks/Upcoming × AI Glasses/Wrist/ARG-SSG)
- [ ] Use sample data for initial dashboard build

## Phase 3: Backend Implementation
- [x] Design database schema for storing dashboard data
- [ ] Implement Google Docs API integration with OAuth
- [x] Create tRPC procedures for fetching and syncing data
- [x] Add data parsing and categorization logic
- [x] Set up real-time data sync mechanism

## Phase 4: Frontend UI Development
- [x] Implement glassmorphism design system (colors, shadows, blur effects)
- [x] Build topline view 3x3 grid layout component
- [x] Create dynamic icon system for highlights/risks/upcoming
- [x] Implement bullet-point content rendering
- [x] Add responsive layout for mobile/tablet/desktop
- [x] Create placeholder sections for future views (Device, Experience, System, Dates, Decisions)

## Phase 5: Testing & Deployment
- [ ] Test Google Docs API integration (deferred - using sample data)
- [x] Verify real-time data sync
- [x] Test responsive layout across devices
- [x] Create and run vitest tests for dashboard operations
- [x] Create checkpoint for deployment

## Layout Improvements
- [x] Restructure ToplineView to group sections by product category
- [x] Create 3 large product tiles instead of 9 separate section tiles
- [x] Each product tile contains all 3 sections (Highlights, Risks/Opens, Upcoming)

## Horizontal Layout Optimization
- [x] Adjust grid to display all 3 product tiles side-by-side horizontally
- [x] Optimize spacing and sizing for horizontal layout
- [x] Ensure responsive behavior on smaller screens

## AI Chat & Devices Section
- [x] Add Gemini-powered Q&A interface at the top of dashboard
- [x] Create compact chat bar that takes minimal screen space
- [x] Implement backend tRPC procedure to query dashboard data with LLM
- [x] Group all three product tiles into a "Devices" section with colored container
- [x] Add "Devices" section header with visual styling

## Layout Fix
- [x] Fix product tiles to display side-by-side on all screen sizes
- [x] Adjust breakpoint or grid configuration for horizontal layout (changed from xl to lg breakpoint)

## Data Population from Google Doc
- [x] Parse executive summary content from downloaded document
- [x] Populate AI Glasses section with highlights, risks, and upcoming items
- [x] Populate Wrist section with highlights, risks, and upcoming items
- [x] Populate ARG/SSG section with highlights, risks, and upcoming items
- [x] Add week number (W5) to dashboard header
- [x] Add red indicators for critical risks marked with 🔴 (emojis preserved in content)

## Upcoming Dates Section
- [x] Access Google Sheets data from Wearable Program Milestones SOT
- [x] Create database schema for milestone dates (PDP gates, SW milestones, HW dates)
- [x] Extract and parse milestone data from spreadsheet
- [x] Build Upcoming Dates UI section with 3 subsections
- [x] Display PDP gates, Key Software Milestones, and Hardware dates

## Text Visibility Fix
- [x] Fix white text color in Upcoming Dates section for better visibility
- [x] Ensure proper contrast between text and background

## Milestone Display Improvements
- [x] Swap program name to be larger/primary text and milestone name to be secondary
- [x] Sort milestones in chronological order (already sorted by database query)
- [x] Add week number for 2026 dates with format "W## (MMM d)"
- [x] Unify date font styling (single line with consistent font)

## PDP Gates Filtering & Completion Status
- [x] Update database query to filter PDP gates to past 3 weeks and next month
- [x] Add visual completion indicators for past milestones
- [x] Show checkmark and line-through styling for completed PDP gates

## Complete Milestone Data Import
- [x] Import all 666 milestones from spreadsheet JSON
- [x] Populate database with all programs (Artemis, Ceres, Malibu, Ceres2, Daiquiri, Hypernova, etc.)
- [x] Verify all milestone types are represented (186 PDP gates, 313 SW, 167 HW)

## Milestone Styling Updates
- [x] Remove line-through styling from completed PDP gates
- [x] Reduce vertical spacing between milestone rows (from space-y-3 to space-y-1.5)
- [x] Keep checkmark icon for completed milestones

## Real-Time Google Docs/Sheets Integration
- [x] Create backend sync service to download and parse Google Doc (executive summary)
- [x] Create backend sync service to download and parse Google Sheets (milestones)
- [x] Add tRPC procedure to trigger manual data sync
- [x] Implement automatic periodic sync (polling mechanism - every 5 minutes)
- [x] Add "Refresh Data" button to dashboard UI
- [x] Show last sync timestamp in dashboard
- [x] Handle sync errors gracefully with user feedback

## Shared Drive File Access
- [x] Find "Wearable everything" shared drive ID
- [x] Locate "Device & Growth Canonical Program Review" file in shared drive
- [x] Download and parse executive summary from the file
- [x] Populate Devices section with real data from the document
- [x] Update sync service to use shared drive file path (canonical document)

## Blue Text Highlighting & Week Number
- [x] Parse document to identify blue text (new information) - Found 87 blue items
- [x] Extract week number from document title - Found W5
- [x] Update database schema to track new/updated items (added is_new field)
- [x] Add visual highlighting for new information in UI (blue text with medium font weight)
- [x] Add legend/key showing blue text indicates new information (in header subtitle)
- [x] Update dashboard title to show "Week X Devices Update" dynamically (Week 5 Devices Update)

## Fix Google Doc Sync
- [x] Investigate why Google Doc sync is not pulling correct data
- [x] Ensure sync pulls only from first tab "Exec Summary" section
- [x] Verify data matches the Google Doc content exactly
- [x] Create Python parser script to extract executive summary data
- [x] Detect blue text for new information highlighting
- [x] Load real data from W5 2026 Google Doc into database
- [ ] Fix Python/Node.js integration for automatic sync button (workaround: manual sync script created)

## Manual Sync Workaround
- [x] Create standalone Python parser script
- [x] Create manual sync shell script (sync_from_gdrive.sh)
- [x] Document sync process in SYNC_README.md
- [x] Test manual sync process successfully

## Devices Section Redesign
- [x] Redesign Devices section to match Upcoming Dates style
- [x] Create cleaner, more scannable layout similar to milestone cards
- [x] Remove complex glassmorphism tiles in favor of simpler list format
- [x] Simplify sync mechanism for daily updates only
- [x] Remove auto-sync toggle and periodic refresh (not needed for daily updates)
- [x] Fix React hooks error in SyncStatus component

## Restore 3-Tile Product Layout
- [x] Restore 3 separate tiles for AI Glasses, Wrist, and ARG/SSG
- [x] Keep cleaner styling similar to Upcoming Dates cards
- [x] Maintain side-by-side horizontal layout

## Title and Styling Updates
- [x] Change main dashboard title to "Wearable Live Dashboard"
- [x] Update Devices section title to "Devices Week X" with current week number
- [x] Make section headers (Highlights, Risks/Opens, Upcoming) uppercase and larger

## Tabbed Interface for Devices Section
- [x] Add tab UI component (Devices, Software, Systems)
- [x] Keep Devices tab with current 3-tile format
- [x] Create Software tab with Wins, Product Decisions, Hotspots sections
- [x] Create Systems tab placeholder
- [x] Add database schema for Software review data (software_items table)
- [x] Create parser for Software (I+E, AI, Hearing) Canonical Program Review doc
- [x] Integrate Software doc sync into manual sync script (sync_software.sh)
- [x] Add tRPC endpoints for Software data (software.getAll, software.getBySection)
- [x] Implement Software tab UI with real data from Google Doc (29 wins items loaded)

## Software Tab 3-Section Layout
- [x] Redesign Software tab to show 3 sections side-by-side (Wins, Exec Summary, Decisions)
- [x] Update parser to extract Exec Summary section from Software doc
- [x] Update parser to extract Decisions section from Software doc
- [x] Update UI to display 3 tiles horizontally similar to Devices tab
- [x] Remove Hotspots section and replace with Exec Summary
- [x] Update database schema to support exec_summary and decisions section types
- [x] Update tRPC endpoints and db functions for new section types
- [x] Test with real data (8 wins, 21 exec summary items loaded)

## Update Section Title
- [x] Change "Devices Week X" to "Exec Summary Week X" for the tabbed section

## Remove Placeholder Sections
- [x] Remove Device View, Experience & Interface View, and System View from Additional Dashboard Sections

## Decisions Section Implementation
- [x] Locate Wearables Decision Canonical document in Wearables Everything folder
- [x] Create database schema for decisions (week, dri, forum, status, decision_outcome)
- [x] Create Python parser to extract data from Consolidated Summary table
- [x] Filter decisions from last month only (5 decisions from W5-W3 2026)
- [x] Build Decisions UI component with table display
- [x] Add link to Google Drive source document
- [x] Create manual sync script (sync_decisions.sh) for daily updates
- [x] Test with real data from Wearable Decisions Canonical doc
- [x] Remove duplicate Decisions placeholder from Additional Dashboard Sections

## Daily Auto-Sync at 6 AM PST
- [x] Create unified sync script combining Devices, Software, and Decisions syncs (sync_all_exec_summary.sh)
- [x] Document cron job setup for production (6 AM PST = 14:00 UTC)
- [x] Test unified sync script successfully (syncs all 3 data sources)
- [x] Create DAILY_SYNC_SCHEDULE.md with setup instructions

## Add Source Document Links
- [x] Add "View Source Document" link to Devices tab header
- [x] Add "View Source Document" link to Software tab header
- [x] Link to Google Drive paths for both documents

## Systems Tab Implementation
- [x] Locate Wearable Systems Review document in Systems Software Reviews folder
- [x] Create database schema for Systems review data (systems_items table)
- [x] Create Python parser for Systems review document (Wins, Exec Summary, Help Needed)
- [x] Create sync script for Systems data (sync_systems.sh)
- [x] Add tRPC endpoints for Systems data (systems.getAll, systems.getBySection)
- [x] Build Systems tab UI with 3-tile layout matching Devices/Software tabs
- [x] Add "View Source Document" link to Systems tab
- [x] Test with real data from Systems review document (658 items: 101 wins, 413 exec summary, 144 help needed)

## Elegant Indentation Solution (Numbering-Based)
- [x] Rollback to checkpoint before indentation feature was added (27f33433)
- [x] Analyze Word document structure using numbering levels (ilvl)
- [x] Implement numbering-based indentation detection in parse_exec_summary.py
- [x] Implement numbering-based indentation detection in parse_software_review.py
- [x] Implement numbering-based indentation detection in parse_systems_review.py
- [x] Update all sync scripts to include indent_level field
- [x] Update UI components to render indentation based on indent_level
- [x] Resync all data with new numbering-based logic
- [x] Verify indentation works correctly (Monoc P2, Modelo EVT now properly indented as sub-bullets)

## Fix Sync Errors and Daily Auto-Update
- [x] Diagnose rclone errors (paths not found)
- [x] Verify correct Google Drive folder structure and file paths
- [x] Rewrite googleDriveSync.ts to use shell scripts for all 4 data sources
- [x] Update SyncStatus.tsx to handle new sync response format
- [x] Test manual sync - Refresh Data button now works correctly
- [x] Set up automatic daily sync at 6 AM PST (scheduled task created)
- [ ] Add error handling and logging to sync scripts

## Fix Python SRE Module Mismatch Error
- [x] Diagnose Python environment issue (python3.13 vs python3.11)
- [x] Update shell scripts to use /usr/bin/python3.11 instead of python3
- [x] Update Python parser shebang lines to use #!/usr/bin/python3.11
- [x] Add PYTHONPATH and PYTHONHOME clearing to shell scripts
- [x] Create Python 3.11 virtual environment with python-docx
- [x] Update all sync scripts to use venv Python
- [x] Test all parsers (Devices, Software, Systems, Decisions) work correctly
- [x] Verify full sync completes without errors - ✅ Full sync complete! 732 items updated

## Optimize Sync Architecture for Speed
- [x] Analyze current sync bottlenecks (baseline: 26 seconds sequential)
- [x] Fix Google Drive file paths for Software, Systems, Decisions
- [x] Implement optimized architecture: sequential downloads (avoid rclone conflicts) + parallel parsing
- [x] Cache downloaded files with MD5 checksums to skip unchanged documents
- [x] Optimize database writes with single transaction
- [x] Test sync speed improvement - **12 seconds (54% faster!)**
- [x] Verify format and indentation remain intact

## UI Cleanup and In Market Release Dates
- [x] Remove "Load Sample Data" button from dashboard header
- [x] Add database schema for in-market release dates (using existing milestones table)
- [x] Create getReleaseDates query function to filter OSD/launch/release milestones
- [x] Add tRPC endpoint for release dates
- [x] Create "In Market Release Dates" tile in Upcoming Dates section
- [x] Show upcoming month with week numbers (W##)
- [x] Update grid layout to 4 columns (xl:grid-cols-4) for 4 tiles
- [x] Test and verify all changes work correctly
- [x] Load Sample Data button successfully removed from header
- [x] In Market Release Dates tile displays correctly with green rocket icon
- [x] 4-column grid layout works on large screens
- [x] Week numbers display correctly (W## format)

## Update In Market Release Dates to Use Spreadsheet Column
- [x] Confirmed milestone data comes from same SOT spreadsheet (already in milestones table)
- [x] Identified release date entries: "Launch Date", "OSD", "MP OSD" in milestone names
- [x] Verify current getReleaseDates query is correctly filtering these entries
- [x] Updated query date range from 1 month to 12 months to show upcoming launches
- [x] Fixed case sensitivity in query ("%Launch%" instead of "%launch%")
- [x] Test that release dates now display in UI - showing 8 upcoming launches through Dec 2026

## Open View Access to Dashboard
- [ ] Check current authentication requirements (currently requires login)
- [ ] Update App.tsx to remove authentication requirement for viewing
- [ ] Keep authentication only for admin actions (sync, etc.)
- [ ] Test dashboard loads without login
- [ ] Verify all data displays correctly for unauthenticated users

## Update In Market Release Dates to Show Software Milestones
- [x] Change query from product launch dates to software release milestones
- [x] Filter for milestone_type = 'sw_milestones' in next 1 month (changed from 12 months)
- [x] Update tile title to "Software Releases (Next Month)"
- [x] Test that software milestones display correctly - showing 8 software releases in next month

## Add Release Milestones as 4th Category
- [x] Find release milestones in Wearable Program Milestone SOT spreadsheet (same tab as other milestones)
- [x] Add release_milestones to milestones_data.json as 4th category (9 launch dates added)
- [x] Update database schema to support 'release_milestones' milestone_type
- [x] Load release milestones into database (9 release milestones loaded)
- [x] Update getReleaseDates query to filter for milestone_type = 'release_milestones' (12 months window)
- [x] Change tile title from "Software Releases (Next Month)" to "Releases"
- [x] Test that release milestones display correctly - showing 8 launch dates through Dec 2026

## Update Releases to Show Version Releases (vXX.X)
- [ ] Deferred - waiting for version release data from spreadsheet

## Preserve Bold and Links from Word Documents
- [x] Audit all parsers (Devices, Software, Systems, Decisions) for bold/link extraction
- [x] Create rich_text_parser.py helper to extract bold and hyperlinks
- [x] Update exec summary parser to extract rich text
- [x] Update software parser to extract rich text
- [x] Update systems parser to extract rich text
- [x] Update decisions parser to extract rich text from table cells
- [x] Install react-markdown library
- [x] Create MarkdownText component to render markdown with bold and links
- [x] Update ToplineView (Devices tab) to use MarkdownText
- [x] Update SystemsTab to use MarkdownText
- [x] Update DecisionsSection to use MarkdownText
- [x] Resync all data sources (Devices: 40 items, Software: 29 items, Systems: 658 items, Decisions: 0 items)
- [x] Test that bold and links display correctly across all tabs
