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
